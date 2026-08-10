import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  private genAI: GoogleGenerativeAI;
  private model;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolResolver: SchoolResolver,
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

  async findAll(schoolId: string, filters: {
    page?: number; limit?: number; status?: string; priority?: string; banner?: boolean;
  }) {
    const { page = 1, limit: rawLimit = 20, status, priority, banner } = filters;
    const limit = Math.min(rawLimit, 100);

    const where: any = { schoolId, deletedAt: null };
    if (status) where.status = status;
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

    const data = rows.map(r => this.mapRow(r));

    // Banner consumer expects a plain array of published, non-expired announcements.
    if (banner) {
      const now = new Date();
      const published = rows.filter(r => r.status === 'published' && (!r.expiresAt || new Date(r.expiresAt) > now));
      return published.map(r => this.mapRow(r)) as any;
    }

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const ann = await this.prisma.announcement.findUnique({
      where: { id },
      include: this.listInclude,
    });
    if (!ann || ann.deletedAt) throw new NotFoundException('Announcement not found');
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

    if (dto.publishedAt !== undefined) {
      data.status = 'published';
      data.publishAt = new Date(dto.publishedAt);
    }

    const ann = await this.prisma.announcement.update({
      where: { id },
      data,
      include: this.listInclude,
    });
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