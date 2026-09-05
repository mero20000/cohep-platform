import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateAllocationDto, UpdateAllocationDto, ReorderAllocationDto } from './dto/curriculum.dto';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { parseCopticChurchHtml } from './html-parser';
import { join } from 'path';
import { access, unlink } from 'fs/promises';

@Injectable()
export class CurriculumService {
  constructor(
    private prisma: PrismaService,
    private schoolResolver: SchoolResolver,
    private readonly audit: AuditService,
  ) {}

  async getLevels(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.level.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { number: 'asc' },
      include: {
        levelSubjects: {
          include: { subject: true },
        },
        _count: { select: { lessons: true, students: true } },
      },
    });
  }

  async createLevel(schoolIdentifier: string, data: { name: string; nameAr?: string; number?: number; description?: string }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const existing = await this.prisma.level.findFirst({
      where: { schoolId, name: data.name, deletedAt: null },
    });
    if (existing) throw new ConflictException(`Level "${data.name}" already exists`);
    const max = await this.prisma.level.findFirst({
      where: { schoolId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const level = await this.prisma.level.create({
      data: {
        schoolId,
        name: data.name,
        nameAr: data.nameAr || null,
        number: data.number || (max ? max.number + 1 : 1),
        description: data.description || `${data.name} description`,
        status: 'active',
      },
    });
    await this.audit.log({ schoolId, action: 'CREATE', entityType: 'level', entityId: level.id, newValues: { name: level.name, number: level.number } });
    return level;
  }

  async updateLevel(id: string, data: { name?: string; nameAr?: string; status?: string; description?: string; number?: number }) {
    const existing = await this.prisma.level.findUnique({ where: { id }, select: { name: true, number: true, status: true, schoolId: true } });
    if (!existing) throw new NotFoundException('Level not found');
    if (data.name !== undefined) {
      const dup = await this.prisma.level.findFirst({
        where: { schoolId: existing.schoolId, name: data.name, deletedAt: null, id: { not: id } },
      });
      if (dup) throw new ConflictException(`Level "${data.name}" already exists`);
    }
    const updated = await this.prisma.level.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.number !== undefined && { number: data.number }),
      },
    });
    await this.audit.log({
      schoolId: existing.schoolId,
      action: 'UPDATE', entityType: 'level', entityId: id,
      oldValues: { name: existing.name, number: existing.number, status: existing.status },
      newValues: { name: updated.name, number: updated.number, status: updated.status },
    });
    return updated;
  }

  async getSubjects(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.subject.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async createSubject(schoolIdentifier: string, data: { name: string; nameAr?: string; description?: string }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const count = await this.prisma.subject.count({ where: { schoolId } });
    const subject = await this.prisma.subject.create({
      data: {
        schoolId,
        name: data.name,
        nameAr: data.nameAr,
        description: data.description,
        orderIndex: count,
      },
    });
    await this.audit.log({ schoolId, action: 'CREATE', entityType: 'subject', entityId: subject.id, newValues: { name: subject.name } });
    return subject;
  }

  async updateSubject(schoolIdentifier: string, id: string, data: { name?: string; nameAr?: string; description?: string }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const old = await this.prisma.subject.findUnique({ where: { id }, select: { name: true } });
    const updated = await this.prisma.subject.update({
      where: { id },
      data,
    });
    await this.audit.log({ schoolId, action: 'UPDATE', entityType: 'subject', entityId: id, oldValues: { name: old?.name }, newValues: { name: updated.name } });
    return updated;
  }

  async deleteSubject(schoolIdentifier: string, id: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const subj = await this.prisma.subject.findUnique({ where: { id }, select: { name: true } });
    await this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ schoolId, action: 'DELETE', entityType: 'subject', entityId: id, oldValues: { name: subj?.name } });
    return { success: true };
  }

  async getSubjectItems(schoolIdentifier: string, subjectId: string) {
    await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.subjectItem.findMany({
      where: { subjectId },
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: { select: { lessons: true } },
        levels: { select: { levelNumber: true } },
      },
    });
  }

  async getAllItems(schoolIdentifier: string, levelNumber?: number) {
    await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.subjectItem.findMany({
      where: levelNumber ? { levels: { some: { levelNumber } } } : {},
      orderBy: [{ subjectId: 'asc' }, { orderIndex: 'asc' }],
      include: {
        _count: { select: { lessons: true } },
        levels: { select: { levelNumber: true } },
        subject: { select: { id: true, name: true, nameAr: true, nameCoptic: true, color: true } },
      },
    });
  }

  async createSubjectItem(schoolIdentifier: string, subjectId: string, data: any) {
    await this.schoolResolver.resolve(schoolIdentifier);
    const count = await this.prisma.subjectItem.count({ where: { subjectId } });
    const levelNumbers: number[] = data.levels ?? (data.level ? [data.level] : [1]);
    return this.prisma.subjectItem.create({
      data: {
        subjectId,
        whenLabel: data.whenLabel,
        name: data.name,
        nameAr: data.nameAr,
        nameCoptic: data.nameCoptic,
        descriptionAr: data.descriptionAr,
        sessionsGroup1: data.sessionsGroup1 || 0,
        sessionsGroup2: data.sessionsGroup2 || 0,
        sessionsGroup3: data.sessionsGroup3 || 0,
        sessionsGroup4: data.sessionsGroup4 || 0,
        orderIndex: count,
        presentationUrl: data.presentationUrl || data.presentationHtml || null,
        presentationData: data.presentationData || null,
        hazzat: data.hazzat || null,
        active: data.active ?? true,
        educationLanguages: data.educationLanguages || null,
        levels: {
          create: levelNumbers.map((n: number) => ({ levelNumber: n })),
        },
      },
      include: { levels: { select: { levelNumber: true } } },
    });
  }

  async updateSubjectItem(schoolIdentifier: string, id: string, data: any) {
    await this.schoolResolver.resolve(schoolIdentifier);
    const { level, levels, ...rest } = data;
    const levelNumbers: number[] = levels || (level ? [level] : []);
    if (levelNumbers.length > 0) {
      await this.prisma.subjectItemLevel.deleteMany({ where: { subjectItemId: id } });
      await this.prisma.subjectItemLevel.createMany({
        data: levelNumbers.map((n: number) => ({ subjectItemId: id, levelNumber: n })),
      });
    }
    return this.prisma.subjectItem.update({
      where: { id },
      data: rest,
      include: { levels: { select: { levelNumber: true } } },
    });
  }

  async setItemRecording(id: string, recordingUrl: string, recordingMeta: any) {
    return this.prisma.subjectItem.update({ where: { id }, data: { recordingUrl, recordingMeta } });
  }

  async clearItemRecording(id: string) {
    return this.prisma.subjectItem.update({ where: { id }, data: { recordingUrl: null, recordingMeta: Prisma.JsonNull } });
  }

  async updateItemStatus(id: string, status: string) {
    return this.prisma.subjectItem.update({
      where: { id },
      data: { status },
    });
  }

  async deleteSubjectItem(schoolIdentifier: string, id: string) {
    await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.subjectItem.delete({
      where: { id },
    });
  }

  async getLessons(schoolIdentifier: string, levelId?: string, subjectId?: string, skip = 0, take = 200) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const where: any = { schoolId, deletedAt: null };
    if (levelId) where.levelId = levelId;
    if (subjectId) where.subjectId = subjectId;

    return this.prisma.lesson.findMany({
      where,
      include: {
        level: { select: { number: true, name: true } },
        subject: { select: { name: true, nameCoptic: true } },
        subjectItem: { select: { id: true, name: true, nameAr: true, nameCoptic: true, presentationData: true } },
        sessions: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { sessions: true } },
      },
      orderBy: { orderIndex: 'asc' },
      skip,
      take,
    });
  }

  async getLesson(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        level: { select: { number: true, name: true } },
        subject: { select: { name: true, nameCoptic: true } },
        subjectItem: { select: { id: true, name: true, nameAr: true, nameCoptic: true, presentationData: true } },
        sessions: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { sessions: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async getAllocations(schoolIdentifier: string, academicYearId: string, levelId?: string, subjectId?: string, term?: number) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const where: any = { academicYear: { schoolId } };
    if (academicYearId) where.academicYearId = academicYearId;
    if (levelId) where.levelId = levelId;
    if (subjectId) where.subjectId = subjectId;
    if (term) where.term = term;

    return this.prisma.curriculumAllocation.findMany({
      where,
      include: {
        academicYear: { select: { name: true } },
        level: { select: { number: true, name: true } },
        subject: { select: { name: true, nameCoptic: true } },
        lesson: {
          select: {
            id: true, title: true, titleAr: true, titleCoptic: true,
            description: true, estimatedDurationMinutes: true, sessionsCount: true,
            status: true,
          },
        },
      },
      orderBy: [{ term: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async getCalendarView(schoolIdentifier: string, academicYearId: string, levelId?: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const where: any = { academicYear: { schoolId } };
    if (academicYearId) where.academicYearId = academicYearId;
    if (levelId) where.levelId = levelId;
    where.scheduledDate = { not: null };

    const allocations = await this.prisma.curriculumAllocation.findMany({
      where,
      include: {
        level: { select: { number: true, name: true } },
        subject: { select: { name: true, color: true } },
        lesson: {
          select: {
            id: true, title: true, titleAr: true, titleCoptic: true,
            estimatedDurationMinutes: true, sessionsCount: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return allocations.map(a => ({
      id: a.id,
      title: a.lesson.title,
      titleAr: a.lesson.titleAr,
      titleCoptic: a.lesson.titleCoptic,
      date: a.scheduledDate,
      term: a.term,
      weekNumber: a.weekNumber,
      level: a.level,
      subject: a.subject,
      duration: a.lesson.estimatedDurationMinutes,
      sessions: a.lesson.sessionsCount,
      status: a.status,
      groupNumber: a.groupNumber,
      updatedBy: a.updatedBy,
    }));
  }

  async createAllocation(dto: CreateAllocationDto) {
    const alloc = await this.prisma.curriculumAllocation.create({
      data: {
        academicYearId: dto.academicYearId,
        levelId: dto.levelId,
        subjectId: dto.subjectId,
        lessonId: dto.lessonId,
        groupNumber: dto.groupNumber ?? 1,
        term: dto.term,
        weekNumber: dto.weekNumber,
        orderIndex: dto.orderIndex,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        status: dto.status || 'draft',
        notes: dto.notes,
      },
    });
    const level = await this.prisma.level.findUnique({ where: { id: dto.levelId }, select: { schoolId: true } });
    await this.audit.log({
      schoolId: level?.schoolId || '',
      action: 'CREATE',
      entityType: 'allocation',
      entityId: alloc.id,
      newValues: { lessonId: dto.lessonId, levelId: dto.levelId, groupNumber: alloc.groupNumber, term: dto.term, weekNumber: dto.weekNumber }
    });
    return alloc;
  }

  async updateAllocation(id: string, dto: UpdateAllocationDto, userId?: string) {
    const old = await this.prisma.curriculumAllocation.findUnique({
      where: { id },
      select: { lessonId: true, term: true, weekNumber: true, status: true, level: { select: { schoolId: true } } }
    });
    const updated = await this.prisma.curriculumAllocation.update({
      where: { id },
      data: {
        ...(dto.lessonId !== undefined && { lessonId: dto.lessonId }),
        ...(dto.term !== undefined && { term: dto.term }),
        ...(dto.weekNumber !== undefined && { weekNumber: dto.weekNumber }),
        ...(dto.weekId !== undefined && { weekId: dto.weekId || null }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
        ...(dto.scheduledDate !== undefined && { scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(userId && { updatedBy: userId }),
      },
    });
    await this.audit.log({
      schoolId: old?.level?.schoolId || '',
      action: 'UPDATE',
      entityType: 'allocation',
      entityId: id,
      oldValues: { lessonId: old?.lessonId, status: old?.status },
      newValues: { lessonId: updated.lessonId, status: updated.status }
    });
    return updated;
  }

  async deleteAllocation(id: string) {
    const alloc = await this.prisma.curriculumAllocation.findUnique({
      where: { id },
      select: {
        lessonId: true,
        levelId: true,
        level: { select: { schoolId: true } }
      }
    });
    await this.prisma.curriculumAllocation.delete({ where: { id } });
    await this.audit.log({
      schoolId: alloc?.level?.schoolId || '',
      action: 'DELETE',
      entityType: 'allocation',
      entityId: id,
      oldValues: { lessonId: alloc?.lessonId }
    });
    return { success: true };
  }

  async deleteAllocations(filter: { academicYearId: string; term?: number; levelId?: string }) {
    const where: any = { academicYearId: filter.academicYearId };
    if (filter.term !== undefined) where.term = filter.term;
    if (filter.levelId) where.levelId = filter.levelId;
    return this.prisma.curriculumAllocation.deleteMany({ where });
  }

  private assertSameSchool(recordSchoolId: string | null | undefined, user?: { schoolId?: string | null; roles?: string[] } | null) {
    if (!user) return;
    if (user.roles?.includes('super_admin')) return;
    if (user.schoolId && recordSchoolId && recordSchoolId !== user.schoolId) {
      throw new NotFoundException('Record not found');
    }
  }

  async deleteLevel(id: string, requestingUser?: { schoolId?: string | null; roles?: string[] } | null) {
    const level = await this.prisma.level.findUnique({ where: { id }, select: { schoolId: true, name: true, number: true, deletedAt: true } });
    if (!level || level.deletedAt) throw new NotFoundException('Level not found');
    this.assertSameSchool(level.schoolId, requestingUser);
    await this.prisma.$transaction([
      this.prisma.level.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.lesson.updateMany({ where: { levelId: id, deletedAt: null }, data: { deletedAt: new Date() } }),
    ]);
    await this.audit.log({ schoolId: level.schoolId, action: 'DELETE', entityType: 'level', entityId: id, oldValues: { name: level.name, number: level.number } });
    return { success: true };
  }

  async reorderAllocations(allocations: ReorderAllocationDto[], requestingUser?: { schoolId?: string | null; roles?: string[] } | null) {
    const ids = allocations.map(a => a.allocationId);
    const records = await this.prisma.curriculumAllocation.findMany({
      where: { id: { in: ids } },
      select: { id: true, academicYear: { select: { schoolId: true } } },
    });
    const byId = new Map(records.map(r => [r.id, r]));
    for (const a of allocations) {
      const rec = byId.get(a.allocationId) as any;
      const recSchoolId = rec?.academicYear?.schoolId;
      if (!rec || (requestingUser && !requestingUser.roles?.includes('super_admin') && requestingUser.schoolId && recSchoolId !== requestingUser.schoolId)) {
        throw new NotFoundException('Allocation not found');
      }
    }
    const operations = allocations.map(a =>
      this.prisma.curriculumAllocation.update({
        where: { id: a.allocationId },
        data: { orderIndex: a.newOrderIndex, term: a.newTerm },
      })
    );
    return this.prisma.$transaction(operations);
  }

  async getAcademicYears(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.academicYear.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicYear(schoolIdentifier: string, data: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    const year = await this.prisma.academicYear.create({
      data: {
        schoolId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isCurrent: data.isCurrent || false,
      },
    });
    await this.audit.log({ schoolId, action: 'CREATE', entityType: 'academic_year', entityId: year.id, newValues: { name: year.name, isCurrent: year.isCurrent } });
    return year;
  }

  async updateAcademicYear(id: string, data: any) {
    const old = await this.prisma.academicYear.findUnique({ where: { id }, select: { schoolId: true, name: true, isCurrent: true } });
    if (!old) throw new NotFoundException('Academic year not found');
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { schoolId: old.schoolId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    const updated = await this.prisma.academicYear.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.isCurrent !== undefined && { isCurrent: data.isCurrent }),
        ...(data.activeDays !== undefined && { activeDays: data.activeDays }),
      },
    });
    await this.audit.log({ schoolId: old.schoolId, action: 'UPDATE', entityType: 'academic_year', entityId: id, oldValues: { name: old.name, isCurrent: old.isCurrent }, newValues: { name: updated.name, isCurrent: updated.isCurrent } });
    return updated;
  }

  async deleteAcademicYear(id: string, requestingUser?: { schoolId?: string | null; roles?: string[] } | null) {
    const year = await this.prisma.academicYear.findUnique({ where: { id }, select: { schoolId: true, name: true, deletedAt: true } });
    if (!year || year.deletedAt) throw new NotFoundException('Academic year not found');
    this.assertSameSchool(year.schoolId, requestingUser);
    await this.prisma.academicYear.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({ schoolId: year.schoolId, action: 'DELETE', entityType: 'academic_year', entityId: id, oldValues: { name: year.name } });
    return { success: true };
  }

  async generateWeekends(academicYearId: string) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    const activeDays = (year.activeDays as number[] | null)?.length ? (year.activeDays as number[]) : [6, 0];

    // Ensure activeDays are persisted
    if (!(year.activeDays as number[] | null)?.length) {
      await this.prisma.academicYear.update({
        where: { id: academicYearId },
        data: { activeDays },
      });
    }

    // Delete existing weeks and regenerate from scratch
    await this.prisma.academicWeek.deleteMany({
      where: { academicYearId },
    });

    const start = new Date(year.startDate);
    const end = new Date(year.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Find the first active day on or after startDate
    const sortedDays = [...(activeDays as number[])].sort((a, b) => a - b);
    const firstActive = new Date(start);
    while (!(sortedDays as number[]).includes(firstActive.getDay())) firstActive.setDate(firstActive.getDate() + 1);

    // Determine term boundaries from actual academic year
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const termLength = totalDays / 3;

    const weeks: Array<{ academicYearId: string; weekNumber: number; term: number; startDate: Date; endDate: Date; isAvailable: boolean }> = [];
    let weekNumber = 1;
    const cursor = new Date(firstActive);

    while (cursor <= end) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 1);
      if (weekEnd > end) weekEnd.setTime(end.getTime());

      const dayOffset = (weekStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      let term = 1;
      if (dayOffset >= termLength * 2) term = 3;
      else if (dayOffset >= termLength) term = 2;

      weeks.push({
        academicYearId,
        weekNumber,
        term,
        startDate: weekStart,
        endDate: weekEnd,
        isAvailable: true,
      });
      weekNumber++;
      cursor.setDate(cursor.getDate() + 7);
    }

    if (weeks.length > 0) {
      await this.prisma.academicWeek.createMany({ data: weeks });
    }

    return { message: `Weekends set. Generated ${weeks.length} weeks.`, weeksGenerated: weeks.length };
  }

  async createLesson(schoolIdentifier: string, data: any, userId?: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const lesson = await this.prisma.lesson.create({
      data: {
        schoolId,
        levelId: data.levelId,
        subjectId: data.subjectId,
        title: data.title,
        titleAr: data.titleAr || null,
        titleCoptic: data.titleCoptic || null,
        description: data.description || null,
        descriptionAr: data.descriptionAr || null,
        descriptionCoptic: data.descriptionCoptic || null,
        estimatedDurationMinutes: data.estimatedDurationMinutes || 30,
        sessionsCount: data.sessionsCount || 1,
        orderIndex: data.orderIndex ?? 0,
        status: data.status || 'draft',
        subjectItemId: data.subjectItemId || null,
        presentationUrl: data.presentationHtml || data.presentationUrl || null,
        presentationData: data.presentationData || null,
        createdBy: userId || 'system',
      },
    });
    await this.audit.log({ schoolId, action: 'CREATE', entityType: 'lesson', entityId: lesson.id, newValues: { title: lesson.title } });
    return lesson;
  }

  async updateLesson(id: string, data: any) {
    const old = await this.prisma.lesson.findUnique({ where: { id }, select: { schoolId: true, title: true, audioUrl: true } });
    if (!old) throw new NotFoundException('Lesson not found');
    if (data.audioUrl && old.audioUrl && old.audioUrl !== data.audioUrl) {
      const oldPath = join(process.cwd(), old.audioUrl)
      try { await access(oldPath); await unlink(oldPath) } catch {}
    }
    const updated = await this.prisma.lesson.update({
      where: { id },
      data: {
        ...(data.levelId !== undefined && { levelId: data.levelId }),
        ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.titleAr !== undefined && { titleAr: data.titleAr }),
        ...(data.titleCoptic !== undefined && { titleCoptic: data.titleCoptic }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.descriptionAr !== undefined && { descriptionAr: data.descriptionAr }),
        ...(data.descriptionCoptic !== undefined && { descriptionCoptic: data.descriptionCoptic }),
        ...(data.estimatedDurationMinutes !== undefined && { estimatedDurationMinutes: data.estimatedDurationMinutes }),
        ...(data.sessionsCount !== undefined && { sessionsCount: data.sessionsCount }),
        ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.subjectItemId !== undefined && { subjectItemId: data.subjectItemId }),
        ...(data.presentationHtml !== undefined && { presentationUrl: data.presentationHtml }),
        ...(data.audioUrl !== undefined && { audioUrl: data.audioUrl }),
        ...(data.audioOriginalName !== undefined && { audioOriginalName: data.audioOriginalName }),
        ...(data.audioDuration !== undefined && { audioDuration: data.audioDuration }),
        ...(data.presentationData !== undefined && { presentationData: data.presentationData }),
      },
    });
    await this.audit.log({ schoolId: old.schoolId, action: 'UPDATE', entityType: 'lesson', entityId: id, oldValues: { title: old.title }, newValues: { title: updated.title } });
    return updated;
  }

  async deleteLesson(id: string, requestingUser?: { schoolId?: string | null; roles?: string[] } | null) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id }, select: { schoolId: true, title: true, deletedAt: true } });
    if (!lesson || lesson.deletedAt) throw new NotFoundException('Lesson not found');
    this.assertSameSchool(lesson.schoolId, requestingUser);
    const allocationCount = await this.prisma.curriculumAllocation.count({ where: { lessonId: id } });
    if (allocationCount > 0) {
      throw new BadRequestException('Unlink allocations first');
    }
    await this.prisma.lesson.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({ schoolId: lesson.schoolId, action: 'DELETE', entityType: 'lesson', entityId: id, oldValues: { title: lesson.title } });
    return { success: true };
  }

  parseCopticChurchHtml(html: string) {
    return parseCopticChurchHtml(html);
  }

  async bulkCreateLessons(schoolIdentifier: string, lessons: any[], userId?: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const lessonData = lessons.map(data => ({
      schoolId,
      levelId: data.levelId,
      subjectId: data.subjectId,
      title: data.title,
      titleAr: data.titleAr || null,
      titleCoptic: data.titleCoptic || null,
      description: data.description || null,
      descriptionAr: data.descriptionAr || null,
      descriptionCoptic: data.descriptionCoptic || null,
      estimatedDurationMinutes: data.estimatedDurationMinutes || 30,
      sessionsCount: data.sessionsCount || 1,
      orderIndex: data.orderIndex ?? 0,
      status: data.status || 'published',
      publishedAt: new Date(),
      createdBy: userId || 'system',
    }));

    const results = await this.prisma.$transaction(
      lessonData.map(data =>
        this.prisma.lesson.create({ data })
      )
    );

    return { created: results.length, lessons: results };
  }

  async getWeeks(schoolIdentifier: string, academicYearId: string) {
    return this.prisma.academicWeek.findMany({
      where: { academicYearId },
      orderBy: { weekNumber: 'asc' },
    });
  }

  async updateWeek(id: string, data: any) {
    return this.prisma.academicWeek.update({
      where: { id },
      data: {
        ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.reason !== undefined && { reason: data.reason }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  async bulkUpdateWeeks(weeks: Array<{ id: string; isAvailable?: boolean; label?: string; reason?: string; status?: string }>) {
    const ops = weeks.map(w =>
      this.prisma.academicWeek.update({
        where: { id: w.id },
        data: {
          ...(w.isAvailable !== undefined && { isAvailable: w.isAvailable }),
          ...(w.label !== undefined && { label: w.label }),
          ...(w.reason !== undefined && { reason: w.reason }),
          ...(w.status !== undefined && { status: w.status }),
        },
      })
    );
    return this.prisma.$transaction(ops);
  }

  // Calendar Events
  async getCalendarEvents(academicYearId: string) {
    return this.prisma.calendarEvent.findMany({
      where: { academicYearId },
      orderBy: { date: 'asc' },
    });
  }

  async createCalendarEvent(data: { academicYearId: string; date: string; label: string; type: string; description?: string }) {
    return this.prisma.calendarEvent.create({
      data: {
        academicYearId: data.academicYearId,
        date: new Date(data.date),
        label: data.label,
        type: data.type,
        description: data.description,
      },
    });
  }

  async updateCalendarEvent(id: string, data: { date?: string; label?: string; type?: string; description?: string }) {
    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
  }

  async deleteCalendarEvent(id: string) {
    return this.prisma.calendarEvent.delete({ where: { id } });
  }
}
