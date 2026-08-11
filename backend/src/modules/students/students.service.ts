import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AnalyticsService } from '../analytics/analytics.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentDto } from './dto/query-student.dto';
import { BulkImportStudentDto } from './dto/bulk-import-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly schoolResolver: SchoolResolver,
    private readonly analytics: AnalyticsService,
  ) {}

  async findAll(queryDto: QueryStudentDto, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { levelId, groupId, status, churchName, gradeId, gender, search, page = 1, limit: rawLimit = 20, sortBy, sortDir } = queryDto;
    const limit = Math.min(rawLimit, 100);

    const where: any = {
      schoolId,
      deletedAt: null,
    };

    if (levelId) where.levelId = levelId;
    if (groupId) where.groupId = groupId;
    if (status) where.status = status;
    if (churchName) where.churchName = churchName;
    if (gradeId) where.gradeId = gradeId;
    if (gender) where.gender = gender;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const dir = sortDir === 'desc' ? 'desc' : 'asc';
    const orderMap: Record<string, any> = {
      name: [{ firstName: dir }, { lastName: dir }],
      code: [{ studentCode: dir }],
      age: [{ dateOfBirth: dir }],
      gender: [{ gender: dir }],
      church: [{ churchName: dir }],
      grade: [{ grade: { name: dir } }],
      status: [{ status: dir }],
      level: [{ level: { number: dir } }],
      group: [{ group: { name: dir } }],
      createdAt: [{ createdAt: dir }],
    };
    const orderBy: any = (sortBy && orderMap[sortBy]) || [{ createdAt: 'desc' }];

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          level: { select: { id: true, name: true, number: true } },
          group: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
          profile: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        schoolId,
        deletedAt: null,
      },
      include: {
        level: true,
        group: true,
        profile: true,
        studentParents: {
          include: {
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        },
        medicalNotes: {
          where: { isActive: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async create(createStudentDto: CreateStudentDto, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const studentCode = await this.generateStudentCode(schoolId);

    let currentYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!currentYear) {
      currentYear = await this.prisma.academicYear.findFirst({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!currentYear) {
      throw new NotFoundException('No academic year found. Create one in Settings > Calendar first.');
    }

    const metadata: Record<string, string> = {};
    if (createStudentDto.phone) metadata.phone = createStudentDto.phone;
    if (createStudentDto.email) metadata.email = createStudentDto.email;
    if (createStudentDto.address) metadata.address = createStudentDto.address;
    if (createStudentDto.notes) metadata.notes = createStudentDto.notes;
    if (createStudentDto.churchToolId) metadata.churchToolId = createStudentDto.churchToolId;

    let groupId: string;
    if (createStudentDto.gradeId) {
      const grade = await this.prisma.schoolGrade.findFirst({
        where: { id: createStudentDto.gradeId, schoolId, deletedAt: null },
        select: { id: true, groupId: true },
      });
      if (!grade) throw new BadRequestException('Grade not found');
      groupId = grade.groupId;
    } else if (createStudentDto.groupId) {
      const group = await this.prisma.group.findFirst({
        where: { id: createStudentDto.groupId, schoolId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new BadRequestException('Group not found');
      groupId = createStudentDto.groupId;
    } else {
      throw new BadRequestException('Grade or group is required');
    }

    const student = await this.prisma.student.create({
      data: {
        firstName: createStudentDto.firstName,
        lastName: createStudentDto.lastName,
        firstNameAr: createStudentDto.firstNameAr,
        lastNameAr: createStudentDto.lastNameAr,
        dateOfBirth: new Date(createStudentDto.dateOfBirth),
        gender: createStudentDto.gender,
        churchName: createStudentDto.churchName,
        photoUrl: createStudentDto.photoUrl,
        levelId: createStudentDto.levelId,
        gradeId: createStudentDto.gradeId || null,
        groupId,
        schoolId,
        studentCode,
        academicYearId: currentYear.id,
        parentEmail: createStudentDto.parentEmail || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        status: createStudentDto.status || 'active',
        enrollmentDate: new Date(),
      },
      include: {
        level: true,
        group: true,
        grade: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      schoolId,
      action: 'CREATE',
      entityType: 'student',
      entityId: student.id,
      newValues: { firstName: student.firstName, lastName: student.lastName, levelId: student.levelId, groupId: student.groupId },
    });

    // MEASURE (C4): record creation events for actions-per-session funnels.
    this.analytics.record({
      name: 'student.created',
      category: 'action',
      schoolId,
      properties: { studentId: student.id },
    });

    return student;
  }

  async update(id: string, updateStudentDto: UpdateStudentDto, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const student = await this.findOne(id, schoolId);

    const data = { ...updateStudentDto } as any;
    if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);

    if (data.groupId === null) delete data.groupId;

    if (data.gradeId) {
      const grade = await this.prisma.schoolGrade.findFirst({
        where: { id: data.gradeId, schoolId, deletedAt: null },
        select: { id: true, groupId: true },
      });
      if (!grade) throw new BadRequestException('Grade not found');
      data.groupId = grade.groupId;
    } else if (data.groupId) {
      const group = await this.prisma.group.findFirst({
        where: { id: data.groupId, schoolId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new BadRequestException('Group not found');
    } else if (data.gradeId === null) {
      delete data.groupId;
    }

    // Merge contact fields into metadata
    const existingMeta = (student as any).metadata || {};
    const metaFields: (keyof typeof data)[] = ['phone', 'email', 'address', 'notes', 'churchToolId'];
    const hasMetaUpdate = metaFields.some(f => data[f] !== undefined);
    if (hasMetaUpdate) {
      const newMeta: Record<string, string> = { ...existingMeta };
      for (const f of metaFields) {
        if (data[f] !== undefined) {
          if (data[f]) newMeta[f as string] = data[f];
          else delete newMeta[f as string];
          delete data[f];
        }
      }
      data.metadata = newMeta;
    }

    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data,
      include: {
        level: true,
        group: true,
        grade: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      schoolId,
      action: 'UPDATE',
      entityType: 'student',
      entityId: student.id,
      oldValues: { firstName: student.firstName, lastName: student.lastName, levelId: student.levelId, groupId: student.groupId, status: student.status },
      newValues: { firstName: updated.firstName, lastName: updated.lastName, levelId: updated.levelId, groupId: updated.groupId, status: updated.status },
    });

    return updated;
  }

  async remove(id: string, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const student = await this.findOne(id, schoolId);

    await this.prisma.student.update({
      where: { id: student.id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      schoolId,
      action: 'DELETE',
      entityType: 'student',
      entityId: student.id,
      oldValues: { firstName: student.firstName, lastName: student.lastName, studentCode: student.studentCode },
    });

    return { success: true };
  }

  async getAttendanceHistory(studentId: string, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    await this.findOne(studentId, schoolId);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        attendanceSession: { schoolId },
      },
      include: {
        attendanceSession: {
          include: {
            level: { select: { name: true, number: true } },
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
    });

    return records;
  }

  async getProgress(studentId: string, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    await this.findOne(studentId, schoolId);

    const progress = await this.prisma.studentProgress.findMany({
      where: { studentId },
      include: {
        level: true,
        academicYear: true,
      },
    });

    return progress;
  }

  async bulkCreate(dto: BulkImportStudentDto, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    let currentYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!currentYear) {
      currentYear = await this.prisma.academicYear.findFirst({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!currentYear) throw new NotFoundException('No academic year found. Create one in Settings > Calendar first.');

    const levels = await this.prisma.level.findMany({ where: { schoolId, deletedAt: null } });
    const levelMap = new Map<string, string>();
    for (const l of levels) { levelMap.set(l.id, l.id); levelMap.set(l.name.toLowerCase(), l.id); }

    const grades = await this.prisma.schoolGrade.findMany({ where: { schoolId, deletedAt: null } });
    const gradeMap = new Map(grades.map(g => [g.name.trim().toLowerCase(), g]));

    const errors: { row: number; message: string }[] = [];
    const seenInBatch = new Set<string>();

    // M9: collect existing codes up-front so import codes never collide with
    // soft-deleted or previously-assigned rows.
    const existingCodes = await this.prisma.student.findMany({
      where: { schoolId },
      select: { studentCode: true },
    });
    const taken = new Set(existingCodes.map(e => e.studentCode));

    const nextFreeCode = (): string => {
      let n = existingCodes.length + 1;
      let code = `STU-${String(n).padStart(5, '0')}`;
      while (taken.has(code)) {
        n++;
        code = `STU-${String(n).padStart(5, '0')}`;
      }
      taken.add(code);
      return code;
    };

    const studentData = await Promise.all(dto.students.map(async (s, i) => {
      const rowNum = i + 2;
      const dupKey = `${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}|${s.dateOfBirth.trim()}`;
      if (seenInBatch.has(dupKey)) {
        errors.push({ row: rowNum, message: 'Duplicate student in import (same name + date of birth)' });
      }
      seenInBatch.add(dupKey);

      const resolvedLevelId = levelMap.get(s.levelId.trim().toLowerCase()) || levelMap.get(s.levelId.trim());
      if (!resolvedLevelId) errors.push({ row: rowNum, message: `Level "${s.levelId}" not found` });
      const resolvedGrade = s.grade ? gradeMap.get(s.grade.trim().toLowerCase()) : undefined;
      if (s.grade && !resolvedGrade) errors.push({ row: rowNum, message: `Grade "${s.grade}" not found` });

      let gradeId: string | null = null;
      let groupId = '';
      if (resolvedGrade) {
        gradeId = resolvedGrade.id;
        groupId = resolvedGrade.groupId;
      } else if (s.groupId) {
        const group = await this.prisma.group.findFirst({
          where: { id: s.groupId.trim(), schoolId, deletedAt: null },
          select: { id: true },
        });
        if (!group) {
          errors.push({ row: rowNum, message: `Group "${s.groupId}" not found` });
        } else {
          groupId = group.id;
        }
      }
      if (!s.grade && !s.groupId) errors.push({ row: rowNum, message: 'Grade or group is required' });

      let dob: Date;
      const rawDate = s.dateOfBirth.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
        dob = new Date(rawDate);
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
        const [d, m, y] = rawDate.split('/');
        dob = new Date(`${y}-${m}-${d}`);
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
        const [d, m, y] = rawDate.split('.');
        dob = new Date(`${y}-${m}-${d}`);
      } else {
        dob = new Date(rawDate);
      }
      if (isNaN(dob.getTime())) errors.push({ row: rowNum, message: `Invalid date "${s.dateOfBirth}"` });

      const metadata: Record<string, string> = {};
      if (s.phone) metadata.phone = s.phone.replace(/[^+\d]/g, '');
      if (s.email) metadata.email = s.email;
      if (s.address) metadata.address = s.address;
      if (s.notes) metadata.notes = s.notes;
      if (s.churchToolId) metadata.churchToolId = s.churchToolId;

      return {
        firstName: s.firstName,
        lastName: s.lastName,
        firstNameAr: s.firstNameAr,
        lastNameAr: s.lastNameAr,
        dateOfBirth: dob,
        gender: s.gender,
        churchName: s.churchName,
        levelId: resolvedLevelId || '',
        gradeId,
        groupId,
        schoolId,
        studentCode: nextFreeCode(),
        academicYearId: currentYear.id,
        status: 'active',
        enrollmentDate: new Date(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    }));

    if (errors.length > 0) {
      throw new BadRequestException(
        `Import failed:\n${errors.map(e => `Row ${e.row}: ${e.message}`).join('\n')}`
      );
    }

    const results = await this.prisma.$transaction(
      studentData.map(data =>
        this.prisma.student.create({
          data,
          include: { level: true, group: true, grade: { select: { id: true, name: true } } },
        })
      )
    );

    await this.audit.log({
      schoolId,
      action: 'BULK_CREATE',
      entityType: 'student',
      newValues: { count: results.length },
    });

    // MEASURE (C4): bulk import — the power-user retention lever.
    this.analytics.record({
      name: 'bulk.action',
      category: 'action',
      schoolId,
      properties: { action: 'students.import', count: results.length },
    });

    return { imported: results.length, students: results };
  }

  async bulkUpdate(ids: string[], data: Partial<UpdateStudentDto>, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('ids are required');

    const allowed = ['status', 'levelId', 'gradeId', 'groupId'] as const;
    const updateData: any = {};
    for (const key of allowed) {
      if (data?.[key] !== undefined && !(key === 'groupId' && data[key] === null)) {
        updateData[key] = data[key];
      }
    }
    if (Object.keys(updateData).length === 0) throw new BadRequestException('No supported fields to update');

    if (updateData.gradeId) {
      const grade = await this.prisma.schoolGrade.findFirst({
        where: { id: updateData.gradeId, schoolId, deletedAt: null },
        select: { id: true, groupId: true },
      });
      if (!grade) throw new BadRequestException('Grade not found');
      updateData.groupId = grade.groupId;
    }

    const result = await this.prisma.student.updateMany({
      where: { id: { in: ids }, schoolId, deletedAt: null },
      data: updateData,
    });

    await this.audit.log({
      schoolId,
      action: 'BULK_UPDATE',
      entityType: 'student',
      newValues: { ids, data: updateData, count: result.count },
    });

    return { updated: result.count };
  }

  async bulkDelete(ids: string[], schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('ids are required');

    const result = await this.prisma.student.updateMany({
      where: { id: { in: ids }, schoolId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      schoolId,
      action: 'BULK_DELETE',
      entityType: 'student',
      oldValues: { ids, count: result.count },
    });

    // MEASURE (C4): power-user bulk workflow.
    this.analytics.record({
      name: 'bulk.action',
      category: 'action',
      schoolId,
      properties: { action: 'students.delete', count: result.count },
    });

    return { deleted: result.count };
  }

  async getLevels(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.level.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true, number: true },
      orderBy: { number: 'asc' },
    });
  }

  async getGroups(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.group.findMany({
      where: { schoolId, deletedAt: null },
      select: {
        id: true,
        name: true,
        nameAr: true,
        description: true,
        orderIndex: true,
        status: true,
        _count: { select: { students: true } },
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async createGroup(schoolIdentifier: string, data: { name: string; nameAr?: string; description?: string }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const existing = await this.prisma.group.findFirst({
      where: { schoolId, name: data.name, deletedAt: null },
    });
    if (existing) throw new BadRequestException(`Group "${data.name}" already exists`);
    const maxOrder = await this.prisma.group.findFirst({
      where: { schoolId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return this.prisma.group.create({
      data: {
        schoolId,
        name: data.name,
        nameAr: data.nameAr || null,
        description: data.description || null,
        orderIndex: maxOrder ? maxOrder.orderIndex + 1 : 1,
        status: 'active',
      },
    });
  }

  async updateGroup(id: string, data: { name?: string; nameAr?: string; description?: string; status?: string }) {
    const group = await this.prisma.group.findUnique({ where: { id }, select: { schoolId: true } });
    if (group && data.name !== undefined) {
      const existing = await this.prisma.group.findFirst({
        where: { schoolId: group.schoolId, name: data.name, deletedAt: null, id: { not: id } },
      });
      if (existing) throw new BadRequestException(`Group "${data.name}" already exists`);
    }
    return this.prisma.group.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  async deleteGroup(id: string) {
    await this.prisma.group.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async deleteAllGroups(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { count } = await this.prisma.group.updateMany({
      where: { schoolId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { deletedCount: count };
  }

async getPortalData(portalAccessKey: string) {
    const student = await this.prisma.student.findFirst({
      where: { portalAccessKey, deletedAt: null },
      include: {
        level: { select: { id: true, name: true, number: true, nameAr: true } },
        group: { select: { id: true, name: true, nameAr: true } },
        school: {
          select: { id: true, name: true, nameAr: true, logoUrl: true, church: { select: { name: true, nameAr: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [attRecords, badges, xpResult, upcoming] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        include: { attendanceSession: { select: { scheduledDate: true, scheduledTime: true } } },
        orderBy: { attendanceSession: { scheduledDate: 'desc' } },
        take: 10,
      }),
      this.prisma.studentBadge.findMany({
        where: { studentId: student.id },
        include: { badge: { select: { id: true, name: true, nameAr: true, description: true, iconUrl: true } } },
        orderBy: { awardedAt: 'desc' },
        take: 20,
      }),
      this.prisma.xPTransaction.aggregate({
        where: { studentId: student.id },
        _sum: { amount: true },
      }),
      this.prisma.attendanceSession.findMany({
        where: { groupId: student.groupId, scheduledDate: { gte: new Date() }, deletedAt: null },
        orderBy: { scheduledDate: 'asc' },
        take: 5,
      }),
    ]);

    const attendanceSummary = {
      present: attRecords.filter(r => r.status === 'present').length,
      late: attRecords.filter(r => r.status === 'late').length,
      absent: attRecords.filter(r => r.status === 'absent').length,
      excused: attRecords.filter(r => r.status === 'excused').length,
      total: attRecords.length,
    };

    const totalXp = xpResult._sum?.amount || 0;

    const recentHomework = attRecords
      .filter(r => r.homeworkStatus && r.homeworkStatus !== 'not_assigned')
      .slice(0, 5)
      .map(r => ({
        date: r.attendanceSession.scheduledDate,
        status: r.homeworkStatus,
      }));

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameAr: student.firstNameAr,
        lastNameAr: student.lastNameAr,
        studentCode: student.studentCode,
        level: student.level,
        group: student.group,
        photoUrl: student.photoUrl,
      },
      school: student.school
        ? {
            name: student.school.name,
            nameAr: student.school.nameAr,
            logoUrl: student.school.logoUrl,
            churchName: student.school.church?.name,
            churchNameAr: student.school.church?.nameAr,
          }
        : null,
      attendance: attendanceSummary,
      recentAttendance: attRecords.map(r => ({
        date: r.attendanceSession.scheduledDate,
        time: r.attendanceSession.scheduledTime,
        status: r.status,
        homeworkStatus: r.homeworkStatus,
      })),
      badges: (badges as any[]).map(b => ({
        id: b.id,
        name: b.badge?.name,
        nameAr: b.badge?.nameAr,
        description: b.badge?.description,
        iconUrl: b.badge?.iconUrl,
        earnedAt: b.awardedAt,
      })),
      totalXp,
      upcomingSessions: upcoming.map(s => ({
        id: s.id,
        date: s.scheduledDate,
        time: s.scheduledTime,
      })),
      recentHomework,
    };
  }

  async getStats(schoolIdentifier: string, filters?: {
    levelId?: string; groupId?: string; status?: string; gradeId?: string;
    gender?: string; churchName?: string; search?: string;
  }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const where: any = { deletedAt: null, schoolId };

    if (filters?.levelId) where.levelId = filters.levelId;
    if (filters?.groupId) where.groupId = filters.groupId;
    if (filters?.status) where.status = filters.status;
    if (filters?.gradeId) where.gradeId = filters.gradeId;
    if (filters?.gender) where.gender = filters.gender;
    if (filters?.churchName) where.churchName = filters.churchName;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { studentCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, active, inactive, graduated, male, female] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.count({ where: { ...where, status: 'active' } }),
      this.prisma.student.count({ where: { ...where, status: 'inactive' } }),
      this.prisma.student.count({ where: { ...where, status: 'graduated' } }),
      this.prisma.student.count({ where: { ...where, gender: 'male' } }),
      this.prisma.student.count({ where: { ...where, gender: 'female' } }),
    ]);

    const gradeGroups = await this.prisma.student.groupBy({
      by: ['gradeId'],
      where: { ...where, gradeId: { not: null } },
      _count: { id: true },
    });

    const grades = await this.prisma.schoolGrade.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true, orderIndex: true },
    });
    const gradeOrder = new Map<string, number>();
    const gradeNameMap = new Map<string, string>();
    for (const g of grades) {
      gradeNameMap.set(g.id, g.name);
      gradeOrder.set(g.id, g.orderIndex);
    }

    const gradeDistribution = gradeGroups
      .map(g => ({ gradeId: g.gradeId!, count: g._count.id, orderIndex: gradeOrder.get(g.gradeId!) ?? 0 }))
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(({ gradeId, count }) => ({ grade: gradeNameMap.get(gradeId) ?? gradeId, count }));

    const studentsWithoutGrade = await this.prisma.student.count({
      where: { ...where, schoolId, gradeId: null },
    });

    return { total, active, inactive, graduated, male, female, studentsWithoutGrade, gradeDistribution };
  }

  private async generateStudentCode(schoolId: string): Promise<string> {
    const count = await this.prisma.student.count({ where: { schoolId } });

    // Iterative, bounded search for the next free code. Avoids unbounded recursion
    // that would occur if many high-numbered codes are already taken.
    let n = count + 1;
    const start = n;
    let code = `STU-${String(n).padStart(5, '0')}`;
    let exists = await this.prisma.student.findFirst({
      where: { schoolId, studentCode: code },
      select: { id: true },
    });

    while (exists) {
      n++;
      if (n - start > 100000) {
        throw new BadRequestException('Unable to allocate a student code');
      }
      code = `STU-${String(n).padStart(5, '0')}`;
      exists = await this.prisma.student.findFirst({
        where: { schoolId, studentCode: code },
        select: { id: true },
      });
    }

    return code;
  }
}
