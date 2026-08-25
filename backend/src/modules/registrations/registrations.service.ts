import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { uploadRecording } from '../../common/storage/r2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  private async resolveSchool(schoolSlug: string) {
    const school = await this.prisma.school.findFirst({ where: { slug: schoolSlug, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  private async verifyTurnstile(token?: string) {
    const secret = this.configService.get('TURNSTILE_SECRET_KEY');
    if (!secret || !token) return true; // skip if not configured (dev) or no token
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, response: token }),
      });
      const data: any = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  private async generateStudentCode(schoolId: string) {
    const existing = await this.prisma.student.findMany({ where: { schoolId }, select: { studentCode: true } });
    const taken = new Set(existing.map(e => e.studentCode));
    let n = existing.length + 1;
    let code = `STU-${String(n).padStart(5, '0')}`;
    while (taken.has(code)) {
      n++;
      code = `STU-${String(n).padStart(5, '0')}`;
    }
    return code;
  }

  async getMeta(schoolSlug: string) {
    const school = await this.resolveSchool(schoolSlug);
    const [levels, groups, grades] = await Promise.all([
      this.prisma.level.findMany({ where: { schoolId: school.id, deletedAt: null }, orderBy: { number: 'asc' }, select: { id: true, name: true, number: true } }),
      this.prisma.group.findMany({ where: { schoolId: school.id, deletedAt: null }, orderBy: { orderIndex: 'asc' }, select: { id: true, name: true } }),
      this.prisma.schoolGrade.findMany({ where: { schoolId: school.id, deletedAt: null }, select: { id: true, name: true, groupId: true } }),
    ]);
    return { school: { id: school.id, name: school.name, nameAr: school.nameAr, slug: school.slug, logoUrl: school.logoUrl }, levels, groups, grades };
  }

  async create(schoolSlug: string, dto: any, files?: { voiceFile?: Express.Multer.File[]; photoFile?: Express.Multer.File[] }) {
    const school = await this.resolveSchool(schoolSlug);
    const ok = await this.verifyTurnstile(dto.turnstileToken);
    if (!ok) throw new BadRequestException('Captcha verification failed');

    const studentData = typeof dto.studentData === 'string' ? JSON.parse(dto.studentData) : (dto.studentData || {});
    // Basic required validation
    if (!studentData.name || !studentData.dateOfBirth || !studentData.parentEmail) {
      throw new BadRequestException('Missing required fields: name, dateOfBirth, parentEmail');
    }
    if (!dto.hymnChoice || !['amen_be_mawteka', 'be_shafaat', 'both'].includes(dto.hymnChoice)) {
      throw new BadRequestException('Invalid hymn choice');
    }

    const voiceFile = files?.voiceFile?.[0];
    const photoFile = files?.photoFile?.[0];
    let voiceUrl: string | undefined;
    if (voiceFile) {
      const ext = voiceFile.mimetype.includes('mp4') ? 'mp4' : 'webm';
      const key = `recordings/registrations/${schoolSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      voiceUrl = await uploadRecording(voiceFile.buffer, key, voiceFile.mimetype);
    } else if (dto.voiceRecordingUrl) {
      voiceUrl = dto.voiceRecordingUrl;
    }
    let photoUrl: string | undefined = studentData.photoUrl;
    if (photoFile) {
      const ext = photoFile.mimetype.split('/')[1] || 'jpg';
      const key = `student-photos/registrations/${schoolSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      photoUrl = await uploadRecording(photoFile.buffer, key, photoFile.mimetype);
      studentData.photoUrl = photoUrl;
    }

    const voiceMeta = voiceFile ? { originalName: voiceFile.originalname, mimeType: voiceFile.mimetype, size: voiceFile.size } : undefined
    const app = await this.prisma.registrationApplication.create({
      data: {
        schoolId: school.id,
        hymnChoice: dto.hymnChoice,
        voiceRecordingUrl: voiceUrl,
        voiceRecordingMeta: voiceMeta,
        studentData,
        submittedByEmail: studentData.parentEmail,
        status: 'pending',
      },
    });

    // Notify admins/servants of this school (best-effort, don't block)
    this.notifyStaff(school.id, app).catch(() => {});

    return app;
  }

  private async notifyStaff(schoolId: string, app: any) {
    // Find admins/servants for this school to notify — we just create in-app notifications if needed
    // For now, also send email to school email if exists
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { email: true, name: true } });
    if (school?.email) {
      const sd: any = app.studentData || {};
      const name = sd.name || `${sd.firstName || ''} ${sd.lastName || ''}`.trim() || 'New applicant';
      try {
        await this.mailService.sendMail(
          school.email,
          `New registration: ${name} — ${school.name}`,
          `<p>New registration for <strong>${name}</strong> (${app.hymnChoice})</p><p>Review in <a href="${process.env.FRONTEND_URL || 'https://cohep-platform.vercel.app'}/dashboard/pending-registrations">Dashboard → Registrations</a></p>`,
        );
      } catch {}
    }
  }

  async list(schoolIdOrSlug: string, status?: string, user?: any) {
    // schoolIdOrSlug may be UUID or slug — resolve
    let schoolId = schoolIdOrSlug;
    if (schoolIdOrSlug && !schoolIdOrSlug.match(/^[0-9a-f-]{36}$/i)) {
      try {
        const s = await this.resolveSchool(schoolIdOrSlug);
        schoolId = s.id;
      } catch {
        schoolId = user?.schoolId || schoolIdOrSlug;
      }
    } else if (!schoolId) {
      schoolId = user?.schoolId;
    }
    if (!schoolId) throw new BadRequestException('schoolId is required');

    // Servants see only their group's pending (if they have groupId)
    const where: any = { schoolId };
    if (status) where.status = status;
    // For non-admin, filter by group if servant has assignment — optional, keep simple for now: all pending for school
    // But enforce same-school

    return this.prisma.registrationApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getOne(id: string, user?: any) {
    const app = await this.prisma.registrationApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async update(id: string, dto: any, user: any) {
    const app = await this.prisma.registrationApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== 'pending') throw new BadRequestException('Only pending applications can be edited');
    // Same-school check
    if (user?.schoolId && app.schoolId !== user.schoolId && !user.roles?.includes('super_admin')) {
      throw new ForbiddenException('Not allowed for this school');
    }
    return this.prisma.registrationApplication.update({
      where: { id },
      data: {
        ...(dto.hymnChoice !== undefined && { hymnChoice: dto.hymnChoice }),
        ...(dto.studentData !== undefined && { studentData: dto.studentData }),
        ...(dto.voiceRecordingUrl !== undefined && { voiceRecordingUrl: dto.voiceRecordingUrl }),
      },
    });
  }

  async approve(id: string, user: any, levelId?: string, groupId?: string, gradeId?: string) {
    const app = await this.prisma.registrationApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== 'pending') throw new BadRequestException('Already reviewed');
    if (user?.schoolId && app.schoolId !== user.schoolId && !user.roles?.includes('super_admin')) {
      throw new ForbiddenException('Not allowed for this school');
    }

    const sd: any = app.studentData || {};
    const schoolId = app.schoolId;

    // Resolve academic year
    let year = await this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
    if (!year) year = await this.prisma.academicYear.findFirst({ where: { schoolId }, orderBy: { createdAt: 'desc' } });
    if (!year) throw new NotFoundException('No academic year found. Create one in Settings > Calendar first.');

    // Resolve group via gradeId or direct groupId/levelId
    let resolvedGroupId = groupId;
    let resolvedLevelId = levelId;
    let resolvedGradeId: string | null = sd.gradeId || gradeId || null;

    if (gradeId) {
      const grade = await this.prisma.schoolGrade.findFirst({ where: { id: gradeId, schoolId, deletedAt: null } });
      if (!grade) throw new BadRequestException('Grade not found');
      resolvedGroupId = grade.groupId;
      // Find level for this grade's group? Use levelId if provided, else try to infer
    } else if (sd.gradeId) {
      const grade = await this.prisma.schoolGrade.findFirst({ where: { id: sd.gradeId, schoolId, deletedAt: null } });
      if (grade) {
        resolvedGradeId = grade.id;
        resolvedGroupId = grade.groupId;
      }
    }

    if (!resolvedGroupId && sd.groupId) resolvedGroupId = sd.groupId;
    if (!resolvedLevelId && sd.levelId) resolvedLevelId = sd.levelId;

    // If still no level, try to find level by number or pick first active
    if (!resolvedLevelId) {
      const firstLevel = await this.prisma.level.findFirst({ where: { schoolId, deletedAt: null }, orderBy: { number: 'asc' } });
      if (!firstLevel) throw new BadRequestException('No levels found');
      resolvedLevelId = firstLevel.id;
    }
    if (!resolvedGroupId) {
      const grp = await this.prisma.group.findFirst({ where: { schoolId, deletedAt: null } });
      if (!grp) throw new BadRequestException('No groups found');
      resolvedGroupId = grp.id;
    }

    // Generate student code
    const studentCode = await this.generateStudentCode(schoolId);
    const parts = (sd.name || `${sd.firstName || ''} ${sd.lastName || ''}`.trim()).split(/\s+/);
    const firstName = parts[0] || 'New';
    const lastName = parts.slice(1).join(' ') || 'Student';

    const metadata: Record<string, string> = {};
    if (sd.phone) metadata.phone = sd.phone;
    if (sd.email) metadata.email = sd.email;
    if (sd.address) metadata.address = sd.address;
    if (sd.notes) metadata.notes = sd.notes;

    const student = await this.prisma.student.create({
      data: {
        firstName,
        lastName,
        firstNameAr: sd.firstNameAr || undefined,
        lastNameAr: sd.lastNameAr || undefined,
        dateOfBirth: sd.dateOfBirth ? new Date(sd.dateOfBirth) : new Date(),
        gender: sd.gender || 'male',
        churchName: sd.churchName || undefined,
        photoUrl: sd.photoUrl || undefined,
        levelId: resolvedLevelId,
        groupId: resolvedGroupId,
        gradeId: resolvedGradeId,
        schoolId,
        studentCode,
        academicYearId: year.id,
        parentEmail: sd.parentEmail || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        status: 'active',
        enrollmentDate: new Date(),
      },
    });

    await this.prisma.registrationApplication.update({
      where: { id },
      data: { status: 'approved', reviewedBy: user?.id || null, reviewNote: null },
    });

    // Confirmation email to parent (hard-coded FROM like church registration)
    try {
      const parentEmail = sd.parentEmail || app.submittedByEmail;
      if (parentEmail) {
        await this.mailService.sendMail(
          parentEmail,
          `Welcome to ${year.name || 'COHEP'} — ${firstName} is enrolled`,
          `<p>Dear parent,</p><p>Your application for <strong>${firstName} ${lastName}</strong> has been <strong>approved</strong>.</p><p>Student code: <strong>${studentCode}</strong></p><p><a href="${process.env.FRONTEND_URL || 'https://cohep-platform.vercel.app'}/portal">Open Parent Portal</a></p><p>Voice hymn: ${app.hymnChoice}</p>`,
        );
      }
    } catch {}

    return { student, application: app };
  }

  async reject(id: string, user: any, reason?: string) {
    const app = await this.prisma.registrationApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== 'pending') throw new BadRequestException('Already reviewed');
    if (user?.schoolId && app.schoolId !== user.schoolId && !user.roles?.includes('super_admin')) {
      throw new ForbiddenException('Not allowed for this school');
    }
    const updated = await this.prisma.registrationApplication.update({
      where: { id },
      data: { status: 'rejected', reviewedBy: user?.id || null, reviewNote: reason || null },
    });
    try {
      const sd: any = app.studentData || {};
      const parentEmail = sd.parentEmail || app.submittedByEmail;
      if (parentEmail) {
        await this.mailService.sendMail(
          parentEmail,
          `Update on your application — ${sd.name || 'Student'}`,
          `<p>Your application for <strong>${sd.name || 'Student'}</strong> was not approved at this time.</p>${reason ? `<p>Reason: ${reason}</p>` : ''}<p>You may reapply via <a href="${process.env.FRONTEND_URL || 'https://cohep-platform.vercel.app'}/register">registration</a>.</p>`,
        );
      }
    } catch {}
    return updated;
  }
}
