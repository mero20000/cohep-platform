import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { MailService } from '../mail/mail.service';
import { NewsletterService } from '../newsletter/newsletter.service';
import { emailTemplate, emailParagraph } from '../mail/email-template';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';
import { STAFF_ROLES } from '../../common/decorators/roles.decorator';

@Injectable()
export class AnnouncementsService {
  private genAI: GoogleGenerativeAI;
  private model;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolResolver: SchoolResolver,
    private readonly mailService: MailService,
    private readonly newsletterService: NewsletterService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model });
    }
  }

  private mapRow(row: any): any {
    const attachments = (row.attachments as any) || {};
    const isPublished = row.status === 'published';
    return {
      id: row.id,
      title: row.title,
      titleAr: row.titleAr || '',
      body: row.content,
      bodyAr: row.contentAr || '',
      priority: row.priority || 'normal',
      targetRoles: Array.isArray(attachments?.targetRoles) ? attachments.targetRoles : [],
      targetSubscribers: attachments?.targetSubscribers ?? false,
      createdBy: row.creator
        ? { id: row.creator.id, firstName: row.creator.firstName, lastName: row.creator.lastName }
        : { id: row.createdBy, firstName: '', lastName: '' },
      publishedAt: isPublished ? new Date(row.publishAt).toISOString() : undefined,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  private readonly listInclude = {
    creator: { select: { id: true, firstName: true, lastName: true } },
  } as const;

  private async sendAnnouncementEmails(announcement: any, schoolId: string) {
    const attachments = (announcement.attachments as any) || {};
    const targetRoles: string[] = Array.isArray(attachments.targetRoles) ? attachments.targetRoles : [];
    const targetSubscribers: boolean = attachments.targetSubscribers ?? false;

    const title = announcement.title;
    const titleAr = announcement.titleAr || '';
    const body = announcement.content;
    const bodyAr = announcement.contentAr || '';
    const priority = announcement.priority || 'normal';

    const priorityLabel = priority === 'urgent' ? '🔴 Urgent' : priority === 'important' ? '🟡 Important' : '🔵 Normal';
    const priorityLabelAr = priority === 'urgent' ? '🔴 عاجل' : priority === 'important' ? '🟡 هام' : '🔵 عادي';

    const emails: string[] = [];

    // Collect newsletter subscriber emails
    if (targetSubscribers) {
      try {
        const subscriberEmails = await this.newsletterService.getActiveSubscriberEmails();
        emails.push(...subscriberEmails);
      } catch (err) {
        console.error('[announcements] Failed to get subscriber emails', err);
      }
    }

    // Collect user emails by roles
    if (targetRoles.length > 0) {
      try {
        const users = await this.prisma.user.findMany({
          where: {
            schoolId,
            isActive: true,
            userRoles: {
              some: {
                role: {
                  name: { in: targetRoles },
                },
              },
            },
          },
          select: { email: true },
        });
        emails.push(...users.map(u => u.email));
      } catch (err) {
        console.error('[announcements] Failed to get user emails by role', err);
      }
    }

    // If no specific target, send to all active users in the school
    if (targetRoles.length === 0 && !targetSubscribers) {
      try {
        const users = await this.prisma.user.findMany({
          where: { schoolId, isActive: true },
          select: { email: true },
        });
        emails.push(...users.map(u => u.email));
      } catch (err) {
        console.error('[announcements] Failed to get all user emails', err);
      }
    }

    // Deduplicate emails
    const uniqueEmails = [...new Set(emails)];

    if (uniqueEmails.length === 0) {
      console.log('[announcements] No recipients found for announcement emails');
      return;
    }

    console.log(`[announcements] Sending announcement "${title}" to ${uniqueEmails.length} recipients`);

    const html = emailTemplate({
      title: `${priorityLabel} ${title}`,
      content: `
        ${emailParagraph(titleAr ? `${title} — ${titleAr}` : title)}
        ${emailParagraph(bodyAr ? `${body}\n\n${bodyAr}` : body)}
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
          <tr><td style="padding:8px 0;color:#6b7280;">Priority</td><td style="padding:8px 0;font-weight:600;color:#111827;">${priorityLabel}</td></tr>
          ${targetRoles.length > 0 ? `<tr><td style="padding:8px 0;color:#6b7280;">Target</td><td style="padding:8px 0;font-weight:600;color:#111827;">${targetRoles.join(', ')}</td></tr>` : ''}
          ${targetSubscribers ? `<tr><td style="padding:8px 0;color:#6b7280;">Audience</td><td style="padding:8px 0;font-weight:600;color:#111827;">Newsletter Subscribers</td></tr>` : ''}
        </table>
      `,
      variant: priority === 'urgent' ? 'red' : priority === 'important' ? 'gold' : 'blue',
      footer: 'COHEP — Coptic Orthodox Hymn Education Platform',
    });

    // Send emails in batches to avoid rate limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
      const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(email =>
          this.mailService.sendMail(email, `${priorityLabel}: ${title}`, html).catch(err => {
            console.error(`[announcements] Failed to send to ${email}`, err);
          })
        )
      );
    }
  }

  async findAll(schoolId: string, filters: {
    page?: number; limit?: number; status?: string; priority?: string; banner?: boolean;
  }, user?: any) {
    const { page = 1, limit: rawLimit = 20, status, priority, banner } = filters;
    const limit = Math.min(rawLimit, 100);

    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const isStaff = roles.some(r => (STAFF_ROLES as readonly string[]).includes(r));

    const where: any = { schoolId, deletedAt: null };
    if (!isStaff) {
      where.status = 'published';
    } else if (status) {
      where.status = status;
    }
    if (priority) where.priority = priority;

    const [rows, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: this.listInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.announcement.count({ where }),
    ]);

    const visibleRows = isStaff
      ? rows
      : rows.filter(r => {
          if (r.targetAudience === 'all') return true;
          const targetRoles: string[] = Array.isArray((r.attachments as any)?.targetRoles)
            ? (r.attachments as any).targetRoles
            : [];
          return targetRoles.some(tr => roles.includes(tr));
        });

    const data = visibleRows.map(r => this.mapRow(r));

    // Banner consumer expects a plain array of published, non-expired announcements.
    if (banner) {
      const now = new Date();
      const published = visibleRows.filter(r => r.status === 'published' && (!r.expiresAt || new Date(r.expiresAt) > now));
      return published.map(r => this.mapRow(r)) as any;
    }

    return { data, pagination: { page, limit, total: visibleRows.length, totalPages: Math.ceil(visibleRows.length / limit) } };
  }

  async findOne(id: string, user?: any) {
    const ann = await this.prisma.announcement.findUnique({
      where: { id },
      include: this.listInclude,
    });
    if (!ann || ann.deletedAt) throw new NotFoundException('Announcement not found');

    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const isStaff = roles.some(r => (STAFF_ROLES as readonly string[]).includes(r));

    if (!isStaff) {
      if (ann.status !== 'published') throw new NotFoundException('Announcement not found');
      if (ann.targetAudience !== 'all') {
        const targetRoles: string[] = Array.isArray((ann.attachments as any)?.targetRoles)
          ? (ann.attachments as any).targetRoles
          : [];
        if (!targetRoles.some(tr => roles.includes(tr))) throw new NotFoundException('Announcement not found');
      }
    }

    return this.mapRow(ann);
  }

  async create(schoolIdentifier: string, dto: CreateAnnouncementDto, userId: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier || dto.schoolId || '');
    const isPublished = !!dto.publishedAt;
    const ann = await this.prisma.announcement.create({
      data: {
        schoolId,
        title: dto.title,
        titleAr: dto.titleAr ?? null,
        content: dto.body,
        contentAr: dto.bodyAr ?? null,
        targetAudience: 'all',
        priority: dto.priority || 'normal',
        isPinned: false,
        publishAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        status: isPublished ? 'published' : 'draft',
        attachments: { targetRoles: dto.targetRoles ?? [], targetSubscribers: dto.targetSubscribers ?? false },
        createdBy: userId,
      },
      include: this.listInclude,
    });

    // Send emails if publishing immediately
    if (isPublished) {
      this.sendAnnouncementEmails(ann, schoolId).catch(err => {
        console.error('[announcements] Failed to send announcement emails', err);
      });
    }

    return this.mapRow(ann);
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Announcement not found');

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.titleAr !== undefined) data.titleAr = dto.titleAr;
    if (dto.body !== undefined) data.content = dto.body;
    if (dto.bodyAr !== undefined) data.contentAr = dto.bodyAr;
    if (dto.priority !== undefined) data.priority = dto.priority;

    if (dto.targetRoles !== undefined) {
      const attachments = (existing.attachments as any) || {};
      data.attachments = { ...attachments, targetRoles: dto.targetRoles, targetSubscribers: dto.targetSubscribers ?? attachments.targetSubscribers ?? false };
    } else if (dto.targetSubscribers !== undefined) {
      const attachments = (existing.attachments as any) || {};
      data.attachments = { ...attachments, targetSubscribers: dto.targetSubscribers };
    }

    const wasDraft = existing.status === 'draft';
    if (dto.publishedAt !== undefined) {
      data.status = 'published';
      data.publishAt = new Date(dto.publishedAt);
    }

    const ann = await this.prisma.announcement.update({
      where: { id },
      data,
      include: this.listInclude,
    });

    // Send emails if transitioning from draft to published
    if (wasDraft && ann.status === 'published') {
      this.sendAnnouncementEmails(ann, existing.schoolId).catch(err => {
        console.error('[announcements] Failed to send announcement emails', err);
      });
    }

    return this.mapRow(ann);
  }

  async publish(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Announcement not found');

    const ann = await this.prisma.announcement.update({
      where: { id },
      data: { status: 'published', publishAt: new Date() },
      include: this.listInclude,
    });

    // Send emails on publish
    this.sendAnnouncementEmails(ann, existing.schoolId).catch(err => {
      console.error('[announcements] Failed to send announcement emails', err);
    });

    return this.mapRow(ann);
  }

  async remove(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Announcement not found');

    await this.prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async draft(prompt: string) {
    if (!this.model) throw new BadRequestException('GEMINI_API_KEY not configured');
    if (!prompt?.trim()) throw new BadRequestException('Prompt is required');

    const systemInstruction = `You are a church announcement writer for COHEP (Coptic Orthodox Hymn Education Platform). 
Generate a church announcement in English and Arabic based on the user's topic.
Return JSON with: title (English), titleAr (Arabic), body (English), bodyAr (Arabic).
Keep titles under 80 chars, bodies under 500 chars. Be warm and pastoral.`;

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    });

    const text = result.response.text();
    const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { title: prompt, titleAr: '', body: text, bodyAr: '' };
    }
  }
}
