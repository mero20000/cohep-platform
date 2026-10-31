import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { localToday, studentBirthdayWindow } from '../../common/utils/birthday';
import { AnalyticsService } from '../analytics/analytics.service';
import { LIFECYCLE_WHERE, assessmentGender, isEligible, liveByKey, scoreOf } from '../assessments/assessment-lifecycle';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentDto } from './dto/query-student.dto';
import { BulkImportStudentDto } from './dto/bulk-import-student.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * NOTE: The `student` User role is currently orphaned — it exists in the role seed
 * (11 roles) but has no `@Roles('student')` decorator on any controller. Students
 * authenticate via `portalAccessKey` (12h session JWT) exchanged at `/auth/login`,
 * not through RBAC role checks. This is intentional: the student portal uses a
 * capability-based key system rather than role-based access control. The `student`
 * role remains available for future RBAC assignment if needed.
 */
@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly schoolResolver: SchoolResolver,
    private readonly analytics: AnalyticsService,
  ) {}

  async findAll(queryDto: QueryStudentDto, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { levelId, groupId, status, churchName, gradeId, gender, search, page = 1, limit: rawLimit = 20, sortBy, sortDir, assignedServantId, engagementStatus, ids: rawIds } = queryDto;
    const ids = rawIds ? rawIds.split(',').map(i => i.trim()).filter(Boolean).slice(0, 200) : undefined;
    const limit = Math.min(rawLimit, 100);

    const where: any = {
      schoolId,
      deletedAt: null,
    };

    // Explicit query filters first; the caller's assignment scope is applied afterwards so it always wins.
    if (levelId) where.levelId = levelId;
    if (groupId) where.groupId = groupId;
    if (status) where.status = status;
    if (churchName) where.churchName = churchName;
    if (gradeId) where.gradeId = gradeId;
    if (gender) where.gender = gender;
    if (ids?.length) where.id = { in: ids };
    Object.assign(where, await this.getAccessScope(user));

    // Filter by assigned servant ID using JSON array containment
    if (assignedServantId) {
      where.metadata = {
        path: ['assignedServantIds'],
        array_contains: [assignedServantId],
      };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { firstNameAr: { contains: search, mode: 'insensitive' } },
        { lastNameAr: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
        { parentEmail: { contains: search, mode: 'insensitive' } },
        { churchName: { contains: search, mode: 'insensitive' } },
        { metadata: { path: ['phone'], string_contains: search } },
        { metadata: { path: ['studentPhone'], string_contains: search } },
        { studentParents: { some: { parent: { phone: { contains: search, mode: 'insensitive' } } } } },
        { studentParents: { some: { parent: { email: { contains: search, mode: 'insensitive' } } } } },
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
    const orderBy: any = (sortBy && orderMap[sortBy]) || [{ firstName: 'asc' }, { lastName: 'asc' }];

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          level: { select: { id: true, name: true, number: true } },
          group: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
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

  private static readonly APPROVER_ROLES = ['super_admin', 'admin', 'principal'];
  private static readonly STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'transferred', 'pending'];

  /**
   * Row-level scope for assigned servants (servant / group_leader / level_leader):
   * the where-fragment that limits which students they may touch. `{}` means
   * unrestricted (admins, principals, internal callers with no user).
   */
  private async getAccessScope(user?: any): Promise<Record<string, any>> {
    if (!user?.id) return {};
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { metadata: true, userRoles: { select: { role: { select: { name: true } } } } },
    });
    const meta = (userRecord?.metadata as any) || {};
    const roleNames = (userRecord?.userRoles || []).map((ur: any) => ur.role?.name).filter(Boolean);
    const isAdmin = roleNames.some((r: string) => ['super_admin', 'admin', 'principal'].includes(r));
    const isServant = !isAdmin && roleNames.some((r: string) =>
      ['servant', 'group_leader', 'level_leader'].includes(r),
    );
    const scope: Record<string, any> = {};
    if (!isServant) return scope;
    if (meta.groupId) scope.groupId = meta.groupId;
    if (meta.levelId) scope.levelId = meta.levelId;
    if (meta.gradeId) scope.gradeId = meta.gradeId;
    if (meta.teachingGender && meta.teachingGender !== 'both') scope.gender = meta.teachingGender;
    return scope;
  }

  /** 404 (not 403, so existence isn't leaked) when the student is outside the caller's scope. */
  private async assertStudentAccess(id: string, schoolId: string, user?: any) {
    const scope = await this.getAccessScope(user);
    const found = await this.prisma.student.findFirst({
      where: { id, schoolId, deletedAt: null, ...scope },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Student not found');
  }

  /** A scoped user may not move a student into a level/group/grade outside their own assignment. */
  private assertTargetInScope(scope: Record<string, any>, target: { levelId?: string; groupId?: string; gradeId?: string | null }) {
    for (const key of ['levelId', 'groupId', 'gradeId'] as const) {
      if (scope[key] && target[key] !== undefined && target[key] !== null && target[key] !== scope[key]) {
        throw new ForbiddenException('You can only assign students within your own level, group and grade');
      }
    }
  }

  private isApprover(user?: any): boolean {
    const roles: string[] = this.getUserRoleNames(user);
    return roles.some(r => StudentsService.APPROVER_ROLES.includes(r));
  }

  private assertValidStatus(status: unknown) {
    if (typeof status !== 'string' || !StudentsService.STUDENT_STATUSES.includes(status)) {
      throw new BadRequestException('Invalid status');
    }
  }

  /** Level / group / grade must belong to the caller's school (never trust ids from the body). */
  private async assertSchoolOwns(schoolId: string, ref: { levelId?: string | null; groupId?: string | null }) {
    if (ref.levelId) {
      const level = await this.prisma.level.findFirst({ where: { id: ref.levelId, schoolId, deletedAt: null }, select: { id: true } });
      if (!level) throw new BadRequestException('Level not found');
    }
    if (ref.groupId) {
      const group = await this.prisma.group.findFirst({ where: { id: ref.groupId, schoolId, deletedAt: null }, select: { id: true } });
      if (!group) throw new BadRequestException('Group not found');
    }
  }

  async findOne(id: string, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const scope = await this.getAccessScope(user);
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        schoolId,
        deletedAt: null,
        ...scope,
      },
      include: {
        level: true,
        group: true,
        profile: true,
        creator: { select: { id: true, firstName: true, lastName: true } },
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

  async create(createStudentDto: CreateStudentDto, schoolIdentifier: string, creatorRoles: string[] = [], creatorUserId?: string) {
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
    if (!currentYear) {
      throw new NotFoundException('No academic year found. Create one in Settings > Calendar first.');
    }

    const metadata: Record<string, string> = {};
    if (createStudentDto.phone) metadata.phone = createStudentDto.phone;
    if (createStudentDto.email) metadata.email = createStudentDto.email;
    if (createStudentDto.address) metadata.address = createStudentDto.address;
    if (createStudentDto.notes) metadata.notes = createStudentDto.notes;
    if (createStudentDto.churchToolId) metadata.churchToolId = createStudentDto.churchToolId;
    if (createStudentDto.studentPhone) metadata.studentPhone = createStudentDto.studentPhone;

    await this.assertSchoolOwns(schoolId, { levelId: createStudentDto.levelId });

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

    const createOnce = async () => {
      const studentCode = await this.generateStudentCode(schoolId);
      return this.prisma.student.create({
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
        status: creatorRoles.some(r => ['super_admin', 'admin'].includes(r))
          ? (createStudentDto.status || 'active')
          : 'pending',
        enrollmentDate: new Date(),
        createdBy: creatorUserId || undefined,
      },
      include: {
        level: true,
        group: true,
        grade: { select: { id: true, name: true } },
        creator: creatorUserId ? { select: { id: true, firstName: true, lastName: true } } : false,
      },
      });
    };

    // Two concurrent creates can be handed the same next code; the unique
    // (schoolId, studentCode) index rejects the loser, which simply asks again.
    let student: Awaited<ReturnType<typeof createOnce>>;
    for (let attempt = 0; ; attempt++) {
      try {
        student = await createOnce();
        break;
      } catch (e: any) {
        const isCodeConflict = e?.code === 'P2002' && /code/i.test(JSON.stringify(e?.meta?.target ?? ''));
        if (!isCodeConflict || attempt >= 4) throw e;
      }
    }

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

  async update(id: string, updateStudentDto: UpdateStudentDto, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const student = await this.findOne(id, schoolId, user);

    const data = { ...updateStudentDto } as any;

    if (data.status !== undefined) {
      this.assertValidStatus(data.status);
      // Pending students were added by a servant and wait for an admin/principal to approve them.
      if (student.status === 'pending' && data.status !== 'pending' && !this.isApprover(user)) {
        throw new ForbiddenException('Only an admin or principal can approve a pending student');
      }
    }
    await this.assertSchoolOwns(schoolId, { levelId: data.levelId });
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

    this.assertTargetInScope(await this.getAccessScope(user), { levelId: data.levelId, groupId: data.groupId, gradeId: data.gradeId });

    // Merge contact fields into metadata
    const existingMeta = (student as any).metadata || {};
    const metaFields: (keyof typeof data)[] = ['phone', 'studentPhone', 'email', 'address', 'notes', 'churchToolId'];
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

  async remove(id: string, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const student = await this.findOne(id, schoolId, user);

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

  async getAttendanceHistory(studentId: string, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    await this.findOne(studentId, schoolId, user);

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

  async getProgress(studentId: string, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    await this.findOne(studentId, schoolId, user);

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
    for (const l of levels) {
      levelMap.set(l.id, l.id); // By UUID
      levelMap.set(l.name.toLowerCase(), l.id); // By name (lowercase)
      levelMap.set(l.name.trim().toLowerCase(), l.id); // By name (trimmed, lowercase)
      levelMap.set(String(l.number), l.id); // By number: "1" → Level 1
      levelMap.set(`level ${l.number}`, l.id); // By "Level 1" format
      levelMap.set(`level${l.number}`, l.id); // By "Level1" format
    }

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

      const levelInput = s.levelId.trim();
      let resolvedLevelId = levelMap.get(levelInput.toLowerCase());
      if (!resolvedLevelId) resolvedLevelId = levelMap.get(levelInput); // Try exact match
      if (!resolvedLevelId && /^\d+$/.test(levelInput)) resolvedLevelId = levelMap.get(levelInput); // Try as number
      if (!resolvedLevelId) {
        const availableLevels = Array.from(levelMap.keys()).filter(k => !k.match(/^[a-f0-9-]{36}$/)); // Exclude UUIDs
        errors.push({ row: rowNum, message: `Level "${s.levelId}" not found. Available: ${availableLevels.join(', ')}` });
      }
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

      let dob: Date | null = null;
      const rawDate = s.dateOfBirth.trim();
      try {
        if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
          // YYYY-MM-DD format
          dob = new Date(rawDate + 'T00:00:00Z');
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
          // DD/MM/YYYY format
          const [d, m, y] = rawDate.split('/');
          const day = String(d).padStart(2, '0');
          const month = String(m).padStart(2, '0');
          dob = new Date(`${y}-${month}-${day}T00:00:00Z`);
        } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
          // DD.MM.YYYY format
          const [d, m, y] = rawDate.split('.');
          const day = String(d).padStart(2, '0');
          const month = String(m).padStart(2, '0');
          dob = new Date(`${y}-${month}-${day}T00:00:00Z`);
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
          // D/M/YYYY or DD/MM/YYYY (flexible)
          const parts = rawDate.split('/');
          const day = String(parts[0]).padStart(2, '0');
          const month = String(parts[1]).padStart(2, '0');
          dob = new Date(`${parts[2]}-${month}-${day}T00:00:00Z`);
        } else {
          dob = new Date(rawDate);
        }
        if (dob && isNaN(dob.getTime())) {
          errors.push({ row: rowNum, message: `Invalid date "${s.dateOfBirth}" - use DD/MM/YYYY or YYYY-MM-DD format` });
          dob = null;
        }
      } catch (e) {
        errors.push({ row: rowNum, message: `Invalid date "${s.dateOfBirth}" - use DD/MM/YYYY or YYYY-MM-DD format` });
        dob = null;
      }

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
        dateOfBirth: dob || new Date(),
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

  async bulkUpdate(ids: string[], data: Partial<UpdateStudentDto>, schoolIdentifier: string, user?: any) {
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

    if (updateData.status !== undefined) this.assertValidStatus(updateData.status);
    await this.assertSchoolOwns(schoolId, { levelId: updateData.levelId, groupId: updateData.groupId });

    const scope = await this.getAccessScope(user);
    this.assertTargetInScope(scope, updateData);

    const where: any = { id: { in: ids }, schoolId, deletedAt: null, ...scope };
    // Only an approver may move students out of 'pending'; those rows are skipped, not failed.
    if (updateData.status !== undefined && updateData.status !== 'pending' && !this.isApprover(user)) {
      where.status = { not: 'pending' };
    }

    const result = await this.prisma.student.updateMany({ where, data: updateData });

    await this.audit.log({
      schoolId,
      action: 'BULK_UPDATE',
      entityType: 'student',
      newValues: { ids, data: updateData, count: result.count },
    });

    return { updated: result.count, skipped: ids.length - result.count };
  }

  async bulkDelete(ids: string[], schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('ids are required');

    const result = await this.prisma.student.updateMany({
      where: { id: { in: ids }, schoolId, deletedAt: null, ...(await this.getAccessScope(user)) },
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

  async bulkAssignServant(ids: string[], servantId: string, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('ids are required');
    if (!servantId) throw new BadRequestException('servantId is required');

    const servant = await this.prisma.user.findFirst({ where: { id: servantId, schoolId, deletedAt: null } });
    if (!servant) throw new BadRequestException('Servant not found');

    const students = await this.prisma.student.findMany({
      where: { id: { in: ids }, schoolId, deletedAt: null, ...(await this.getAccessScope(user)) },
      select: { id: true, metadata: true },
    });

    await this.prisma.$transaction(
      students.map(s => {
        const meta = (s.metadata as any) || {};
        const current: string[] = Array.isArray(meta.assignedServantIds) ? meta.assignedServantIds : [];
        const next = current.includes(servantId) ? current : [...current, servantId];
        return this.prisma.student.update({
          where: { id: s.id },
          data: { metadata: { ...meta, assignedServantIds: next } },
        });
      }),
    );

    await this.audit.log({
      schoolId,
      action: 'BULK_ASSIGN_SERVANT',
      entityType: 'student',
      newValues: { ids, servantId, count: students.length },
    });

    return { assigned: students.length };
  }

  async updateTags(id: string, tags: string[], schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const student = await this.findOne(id, schoolId, user);
    const meta = ((student as any).metadata as any) || {};
    const cleanTags = [...new Set(tags.map(t => t.trim()).filter(Boolean))].slice(0, 10);

    const updated = await this.prisma.student.update({
      where: { id },
      data: { metadata: { ...meta, tags: cleanTags } },
    });

    await this.audit.log({
      schoolId,
      action: 'UPDATE_TAGS',
      entityType: 'student',
      entityId: id,
      newValues: { tags: cleanTags },
    });

    return { tags: cleanTags, student: updated };
  }

  async findDuplicates(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, dateOfBirth: true, studentCode: true,
        status: true, photoUrl: true, metadata: true, createdAt: true,
        level: { select: { name: true } }, group: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const groups = new Map<string, typeof students>();
    for (const s of students) {
      const nameKey = `name:${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}|${s.dateOfBirth.toISOString().slice(0, 10)}`;
      if (!groups.has(nameKey)) groups.set(nameKey, []);
      groups.get(nameKey)!.push(s);

      const phone = (s.metadata as any)?.phone;
      if (phone) {
        const phoneKey = `phone:${phone.replace(/\D/g, '')}`;
        if (!groups.has(phoneKey)) groups.set(phoneKey, []);
        groups.get(phoneKey)!.push(s);
      }

      const email = (s.metadata as any)?.email;
      if (email) {
        const emailKey = `email:${email.trim().toLowerCase()}`;
        if (!groups.has(emailKey)) groups.set(emailKey, []);
        groups.get(emailKey)!.push(s);
      }
    }

    const seenPairs = new Set<string>();
    const duplicateGroups: { reason: string; students: typeof students }[] = [];
    for (const [key, group] of groups.entries()) {
      const uniqueIds = [...new Set(group.map(s => s.id))];
      if (uniqueIds.length < 2) continue;
      const pairKey = uniqueIds.sort().join(',');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      const reason = key.startsWith('name:') ? 'same_name_dob' : key.startsWith('phone:') ? 'same_phone' : 'same_email';
      const uniqueStudents = uniqueIds.map(id => group.find(s => s.id === id)!);
      duplicateGroups.push({ reason, students: uniqueStudents });
    }

    return { groups: duplicateGroups, totalGroups: duplicateGroups.length };
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
          select: { id: true, name: true, nameAr: true, logoUrl: true, timezone: true, church: { select: { name: true, nameAr: true, logoUrl: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [attRecords, badges, xpResult, upcoming, assignedAssessments, familyLiturgies, servantLiturgyRecords] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: {
          studentId: student.id,
          attendanceSession: {
            schoolId: student.schoolId,
            deletedAt: null,
            OR: [{ notes: null }, { notes: { not: 'liturgy' } }],
          },
        },
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
      // Every live record, not "the newest 20": the live one per assessment is chosen below by the
      // same rule the teacher screens use, so the two can never disagree about done vs pending.
      this.prisma.assessmentSubmission.findMany({
        where: {
          studentId: student.id,
          ...LIFECYCLE_WHERE,
          assessment: { status: 'published', deletedAt: null, schoolId: student.schoolId },
        },
        include: {
          assessment: {
            select: {
              id: true, title: true, titleAr: true, type: true, totalPoints: true,
              passingScore: true, dueDate: true, status: true, deletedAt: true,
              levelId: true, groupId: true, metadata: true,
              level: { select: { id: true, name: true } },
              subject: { select: { id: true, name: true, nameAr: true } },
            },
          },
          grades: { select: { questionId: true, score: true, maxScore: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Liturgy attendance (FamilyLiturgy) — self-reported by student/parent
      this.prisma.familyLiturgy.findMany({
        where: { studentId: student.id },
        orderBy: { date: 'desc' },
        take: 10,
        select: { date: true, status: true, notes: true, servantNote: true },
      }),
      // Liturgy attendance (AttendanceRecord) — recorded by servants via roll-call
      this.prisma.attendanceRecord.findMany({
        where: {
          studentId: student.id,
          attendedLiturgy: true,
          attendanceSession: { schoolId: student.schoolId, deletedAt: null },
        },
        include: { attendanceSession: { select: { scheduledDate: true } } },
        orderBy: { attendanceSession: { scheduledDate: 'desc' } },
        take: 10,
      }),
    ]);

    // Servant attribution for manually awarded badges
    const awardedByIds = [...new Set(badges.map((b: any) => b.awardedBy).filter(Boolean))] as string[];
    const awarders = awardedByIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: awardedByIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const awarderNames = new Map(awarders.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    // Cancelled sessions require no recording from the student — their records
    // (status 'cancelled') are excluded from the summary/rate, same as the
    // staff-facing attendance stats.
    const gradableAttRecords = attRecords.filter(r => r.status !== 'cancelled');
    const attendanceSummary = {
      present: gradableAttRecords.filter(r => r.status === 'present').length,
      late: gradableAttRecords.filter(r => r.status === 'late').length,
      absent: gradableAttRecords.filter(r => r.status === 'absent').length,
      excused: gradableAttRecords.filter(r => r.status === 'excused').length,
      total: gradableAttRecords.length,
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
            churchLogoUrl: student.school.church?.logoUrl ?? null,
          }
        : null,
      // Birthday card signal, computed here so the date of birth itself never reaches the browser.
      birthday: this.portalBirthday(student),
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
        // Servant attribution — who offered this badge and why
        awardedBy: b.awardedBy ? awarderNames.get(b.awardedBy) || null : null,
        reason: b.reason || null,
      })),
      liturgy: (() => {
        // Merge both liturgy sources: FamilyLiturgy (self-reported) and
        // AttendanceRecord (servant roll-call). Deduplicate by date so a date
        // that appears in both counts only once, preferring the richer record.
        const dateKey = (d: Date | string) => new Date(d).toISOString().split('T')[0];
        const merged = new Map<string, { date: Date | string; status: string; servantNote?: string | null }>();
        for (const r of servantLiturgyRecords) {
          const dk = dateKey(r.attendanceSession.scheduledDate);
          merged.set(dk, { date: r.attendanceSession.scheduledDate, status: 'verified', servantNote: null });
        }
        for (const l of familyLiturgies as any[]) {
          const dk = dateKey(l.date);
          if (!merged.has(dk) || l.status === 'verified') {
            merged.set(dk, { date: l.date, status: l.status, servantNote: l.servantNote });
          }
        }
        const all = [...merged.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return {
          verifiedCount: all.filter(l => l.status === 'verified').length,
          pendingCount: all.filter(l => l.status !== 'verified').length,
          recent: all.slice(0, 5).map(l => ({ date: l.date, status: l.status, servantNote: l.servantNote })),
        };
      })(),
      totalXp,
      upcomingSessions: upcoming.map(s => ({
        id: s.id,
        date: s.scheduledDate,
        time: s.scheduledTime,
      })),
      recentHomework,
      assessments: this.portalAssessments(student, assignedAssessments as any[]),
    };
  }

  /**
   * Set from the student's birthday until a week after it, so the portal can show a birthday card.
   * A family can opt out with metadata.birthdayOptOut. Null otherwise.
   */
  private portalBirthday(student: { dateOfBirth: Date; metadata: any; school?: { timezone?: string | null } | null }) {
    if ((student.metadata as any)?.birthdayOptOut === true) return null;
    const today = localToday(new Date(), student.school?.timezone || 'UTC');
    const w = studentBirthdayWindow(new Date(student.dateOfBirth), today);
    if (!w || w.daysAway > 0 || w.daysAway < -7) return null;
    return { daysSince: -w.daysAway || 0, turningAge: w.turningAge, year: w.year };
  }

  /**
   * The assessments a student sees: one entry per assessment, taken from its live record.
   * An untouched assignment for an assessment that is not for this student's level or group is
   * stale (old test data, a change of group) and is hidden; anything with work on it stays.
   */
  private portalAssessments(student: { levelId: string; groupId: string | null; gender?: string | null }, rows: any[]) {
    const live = liveByKey(
      rows.filter((r) => r.assessment && !r.assessment.deletedAt),
      (r) => r.assessment.id,
    );
    return Array.from(live.values())
      .filter((sub) => sub.status !== 'assigned' || isEligible(student, { ...sub.assessment, gender: assessmentGender(sub.assessment.metadata) }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map((sub) => {
        const mark = scoreOf(sub.grades ?? []);
        return {
          id: sub.assessment.id,
          title: sub.assessment.title,
          titleAr: sub.assessment.titleAr,
          type: sub.assessment.type,
          totalPoints: Number(sub.assessment.totalPoints),
          passingScore: Number(sub.assessment.passingScore),
          dueDate: sub.assessment.dueDate,
          level: sub.assessment.level,
          subject: sub.assessment.subject,
          submissionStatus: sub.status,
          submissionId: sub.id,
          submittedAt: sub.submittedAt,
          earnedScore: sub.status === 'completed' ? (mark?.score ?? 0) : null,
        };
      });
  }

  async getStats(schoolIdentifier: string, filters?: {
    levelId?: string; groupId?: string; status?: string; gradeId?: string;
    gender?: string; churchName?: string; search?: string; assignedServantId?: string;
  }, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const where: any = { deletedAt: null, schoolId };

    // Auto-filter by servant's metadata assignments
    // Explicit filters first; the caller's assignment scope is applied afterwards so it always wins.
    if (filters?.levelId) where.levelId = filters.levelId;
    if (filters?.groupId) where.groupId = filters.groupId;
    if (filters?.status) where.status = filters.status;
    if (filters?.gradeId) where.gradeId = filters.gradeId;
    if (filters?.gender) where.gender = filters.gender;
    if (filters?.churchName) where.churchName = filters.churchName;
    Object.assign(where, await this.getAccessScope(user));

    if (filters?.assignedServantId) {
      where.metadata = {
        path: ['assignedServantIds'],
        array_contains: [filters.assignedServantId],
      };
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { firstNameAr: { contains: filters.search, mode: 'insensitive' } },
        { lastNameAr: { contains: filters.search, mode: 'insensitive' } },
        { studentCode: { contains: filters.search, mode: 'insensitive' } },
        { parentEmail: { contains: filters.search, mode: 'insensitive' } },
        { churchName: { contains: filters.search, mode: 'insensitive' } },
        { metadata: { path: ['parentPhone'], string_contains: filters.search } },
        { studentParents: { some: { parent: { phone: { contains: filters.search, mode: 'insensitive' } } } } },
        { studentParents: { some: { parent: { email: { contains: filters.search, mode: 'insensitive' } } } } },
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

  private static readonly PASS_ROLES = ['servant', 'group_leader', 'level_leader', 'admin', 'super_admin'];

  private getUserRoleNames(user: any): string[] {
    if (!user) return [];
    if (Array.isArray(user.roles)) return user.roles;
    if (Array.isArray(user.userRoles)) {
      return user.userRoles.map((ur: any) => ur?.role?.name ?? ur?.roleName ?? ur).filter(Boolean);
    }
    return [];
  }

  /**
   * Gate for the subject-item endpoints, which look students up by bare id: the caller must be in
   * the student's school and, if assigned to a level/group/grade, the student must be inside it.
   * Parents only reach their own linked children.
   */
  private async assertCanAccessStudentRecord(student: { id: string; schoolId: string }, user: any) {
    const roles = this.getUserRoleNames(user);
    if (roles.includes('super_admin')) return;
    if (!user?.schoolId || user.schoolId !== student.schoolId) throw new NotFoundException('Student not found');
    if (roles.some(r => StudentsService.PASS_ROLES.includes(r))) {
      const scope = await this.getAccessScope(user);
      if (Object.keys(scope).length) {
        const inScope = await this.prisma.student.findFirst({ where: { id: student.id, ...scope }, select: { id: true } });
        if (!inScope) throw new NotFoundException('Student not found');
      }
      return;
    }
    const link = await this.prisma.studentParent.findFirst({ where: { studentId: student.id, parentId: user.id }, select: { id: true } });
    if (!link) throw new NotFoundException('Student not found');
  }

  async toggleSubjectItemPass(studentId: string, subjectItemId: string, user: any, dto: { note?: string } = {}) {
    const roleNames = this.getUserRoleNames(user);
    if (!roleNames.some((r) => StudentsService.PASS_ROLES.includes(r))) {
      throw new ForbiddenException('Not allowed to toggle subject item pass');
    }
    if (!user?.id) throw new BadRequestException('Authenticated user is required');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { id: true, schoolId: true, level: { select: { number: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    await this.assertCanAccessStudentRecord(student, user);

    const subjectItem = await this.prisma.subjectItem.findFirst({
      where: { id: subjectItemId, subject: { deletedAt: null } },
      select: { id: true, subjectId: true, subject: { select: { schoolId: true } }, levels: { select: { levelNumber: true } } },
    });
    if (!subjectItem) throw new NotFoundException('Subject item not found');
    if (subjectItem.subject.schoolId !== student.schoolId) {
      throw new BadRequestException('Subject item does not belong to the same school as the student');
    }
    const allocated = (student.level?.number != null) &&
      subjectItem.levels.some((l) => l.levelNumber === student.level.number);
    if (!allocated) throw new BadRequestException('Subject item not allocated to student level');

    const active = await this.prisma.studentSubjectPass.findFirst({
      where: { studentId, subjectItemId, revokedAt: null },
      orderBy: { passedAt: 'desc' },
    });

    if (active) {
      const record = await this.prisma.studentSubjectPass.update({
        where: { id: active.id },
        data: { revokedAt: new Date(), revokedBy: user.id },
      });
      return { passed: false, record };
    }

    const record = await this.prisma.studentSubjectPass.create({
      data: {
        studentId,
        subjectItemId,
        status: 'passed',
        passedBy: user.id,
        note: dto.note ?? null,
      },
    });
    return { passed: true, record };
  }

  async getStudentSubjectItems(studentId: string, user: any, opts?: { portal?: boolean }) {
    if (!opts?.portal) {
      const roleNames = this.getUserRoleNames(user);
      const allowed = [...StudentsService.PASS_ROLES, 'parent'];
      if (!roleNames.some((r) => allowed.includes(r))) {
        throw new ForbiddenException('Not allowed to view subject items');
      }
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { id: true, schoolId: true, level: { select: { number: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!opts?.portal) await this.assertCanAccessStudentRecord(student, user);

    const items = await this.prisma.subjectItem.findMany({
      where: {
        active: true,
        subject: { deletedAt: null },
        levels: student.level ? { some: { levelNumber: student.level.number } } : undefined,
      },
      include: { subject: true },
      orderBy: { orderIndex: 'asc' },
    });

    const passes = await this.prisma.studentSubjectPass.findMany({
      where: { studentId, subjectItemId: { in: items.map((i) => i.id) } },
      orderBy: { passedAt: 'desc' },
      include: {
        passer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return items.map((item) => {
      const history = passes.filter((p) => p.subjectItemId === item.id);
      const active = history.find((p) => p.revokedAt === null) ?? null;
      const activeWithPasser = active as (typeof active & { passer?: { id: string; firstName: string; lastName: string } | null }) | null;
      return {
        subjectItem: item,
        status: active ? 'passed' : 'not_started',
        passedAt: active?.passedAt ?? null,
        passedBy: active?.passedBy ?? null,
        passedByUser: activeWithPasser?.passer
          ? {
              id: activeWithPasser.passer.id,
              firstName: activeWithPasser.passer.firstName,
              lastName: activeWithPasser.passer.lastName,
            }
          : null,
        history,
      };
    });
  }

  async getStudentPassHistory(studentId: string, user: any, opts?: { portal?: boolean }) {
    if (!opts?.portal) {
      const roleNames = this.getUserRoleNames(user);
      const allowed = [...StudentsService.PASS_ROLES, 'parent'];
      if (!roleNames.some((r) => allowed.includes(r))) {
        throw new ForbiddenException('Not allowed to view pass history');
      }
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { id: true, schoolId: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!opts?.portal) await this.assertCanAccessStudentRecord(student, user);

return this.prisma.studentSubjectPass.findMany({
      where: { studentId },
      orderBy: { passedAt: 'desc' },
    });
  }

  /** Approve a pending student (admin / principal only — enforced by the controller's @Roles). */
  async approve(id: string, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const student = await this.findOne(id, schoolId, user);
    if (student.status !== 'pending') throw new BadRequestException('Student is not pending approval');
    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data: { status: 'active' },
      include: { level: true, group: true, grade: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      schoolId,
      action: 'APPROVE',
      entityType: 'student',
      entityId: student.id,
      userId: user?.id,
      oldValues: { status: 'pending' },
      newValues: { status: 'active' },
    });
    return updated;
  }

  async rotatePortalAccessKey(studentId: string, user?: any) {
    const isSuperAdmin = this.getUserRoleNames(user).includes('super_admin');
    if (!isSuperAdmin && !user?.schoolId) throw new ForbiddenException('School context is required');
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...(isSuperAdmin ? {} : { schoolId: user.schoolId }) },
      select: { id: true, schoolId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const newKey = uuidv4();
    await this.prisma.student.update({ where: { id: student.id }, data: { portalAccessKey: newKey } });
    // The key itself is a credential: record who rotated it and when, never the value.
    await this.audit.log({
      schoolId: student.schoolId,
      action: 'ROTATE_PORTAL_KEY',
      entityType: 'student',
      entityId: student.id,
      userId: user?.id,
    });
    return { newKey, message: 'Portal access key rotated successfully' };
  }
}
