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

  async findAll(queryDto: QueryStudentDto, schoolIdentifier: string, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { levelId, groupId, status, churchName, gradeId, gender, search, page = 1, limit: rawLimit = 20, sortBy, sortDir, assignedServantId, engagementStatus } = queryDto;
    const limit = Math.min(rawLimit, 100);

    const where: any = {
      schoolId,
      deletedAt: null,
    };

    // Auto-filter by servant's metadata assignments
    if (user) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { metadata: true, userRoles: { select: { role: { select: { name: true } } } } },
      });
      const meta = (userRecord?.metadata as any) || {};
      const isServant = userRecord?.userRoles?.some((ur: any) =>
        ['servant', 'group_leader', 'level_leader'].includes(ur.role.name)
      );

      if (isServant) {
        // If metadata has groupId, only show students from that group
        if (meta.groupId) {
          where.groupId = meta.groupId;
        }
        // If metadata has levelId, only show students from that level
        if (meta.levelId) {
          where.levelId = meta.levelId;
        }
        // If metadata has gradeId, only show students from that grade
        if (meta.gradeId) {
          where.gradeId = meta.gradeId;
        }
      }
    }

    // Apply explicit query filters (these override metadata if provided)
    if (levelId) where.levelId = levelId;
    if (groupId) where.groupId = groupId;
    if (status) where.status = status;
    if (churchName) where.churchName = churchName;
    if (gradeId) where.gradeId = gradeId;
    if (gender) where.gender = gender;

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

      let dob: Date;
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
        if (isNaN(dob.getTime())) {
          errors.push({ row: rowNum, message: `Invalid date "${s.dateOfBirth}" - use DD/MM/YYYY or YYYY-MM-DD format` });
        }
      } catch (e) {
        errors.push({ row: rowNum, message: `Invalid date "${s.dateOfBirth}" - use DD/MM/YYYY or YYYY-MM-DD format` });
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

  async bulkAssignServant(ids: string[], servantId: string, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('ids are required');
    if (!servantId) throw new BadRequestException('servantId is required');

    const servant = await this.prisma.user.findFirst({ where: { id: servantId, schoolId, deletedAt: null } });
    if (!servant) throw new BadRequestException('Servant not found');

    const students = await this.prisma.student.findMany({
      where: { id: { in: ids }, schoolId, deletedAt: null },
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

  async updateTags(id: string, tags: string[], schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const student = await this.findOne(id, schoolId);
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
          select: { id: true, name: true, nameAr: true, logoUrl: true, church: { select: { name: true, nameAr: true, logoUrl: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [attRecords, badges, xpResult, upcoming, assignedAssessments, liturgies] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        // Integrate with the attendance module's semantics: exclude records
        // belonging to soft-deleted sessions and scope to the student's school.
        where: { studentId: student.id, attendanceSession: { schoolId: student.schoolId, deletedAt: null } },
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
      this.prisma.assessmentSubmission.findMany({
        where: {
          studentId: student.id,
          // A prior attempt archived by a re-take must never surface as the live row.
          status: { not: 'superseded' },
          assessment: { status: 'published', deletedAt: null, schoolId: student.schoolId },
        },
        include: {
          assessment: {
            select: {
              id: true, title: true, titleAr: true, type: true, totalPoints: true,
              passingScore: true, dueDate: true, status: true,
              level: { select: { id: true, name: true } },
              subject: { select: { id: true, name: true, nameAr: true } },
            },
          },
          grades: { select: { score: true, maxScore: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        distinct: ['assessmentId'], // Only latest submission per assessment
      }),
      // Liturgy attendance (FamilyLiturgy) — verified + pending entries
      this.prisma.familyLiturgy.findMany({
        where: { studentId: student.id },
        orderBy: { date: 'desc' },
        take: 10,
        select: { date: true, status: true, notes: true, servantNote: true },
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
            churchLogoUrl: student.school.church?.logoUrl ?? null,
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
        // Servant attribution — who offered this badge and why
        awardedBy: b.awardedBy ? awarderNames.get(b.awardedBy) || null : null,
        reason: b.reason || null,
      })),
      liturgy: {
        verifiedCount: liturgies.filter((l: any) => l.status === 'verified').length,
        pendingCount: liturgies.filter((l: any) => l.status !== 'verified').length,
        recent: liturgies.slice(0, 5).map((l: any) => ({
          date: l.date,
          status: l.status,
          servantNote: l.servantNote,
        })),
      },
      totalXp,
      upcomingSessions: upcoming.map(s => ({
        id: s.id,
        date: s.scheduledDate,
        time: s.scheduledTime,
      })),
      recentHomework,
      assessments: assignedAssessments.map((sub: any) => {
        const totalScore = sub.grades?.reduce((sum: number, g: any) => sum + Number(g.score || 0), 0) ?? 0;
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
          earnedScore: sub.status === 'completed' ? totalScore : null,
        };
      }),
    };
  }

  async getStats(schoolIdentifier: string, filters?: {
    levelId?: string; groupId?: string; status?: string; gradeId?: string;
    gender?: string; churchName?: string; search?: string; assignedServantId?: string;
  }, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const where: any = { deletedAt: null, schoolId };

    // Auto-filter by servant's metadata assignments
    if (user) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { metadata: true, userRoles: { select: { role: { select: { name: true } } } } },
      });
      const meta = (userRecord?.metadata as any) || {};
      const isServant = userRecord?.userRoles?.some((ur: any) =>
        ['servant', 'group_leader', 'level_leader'].includes(ur.role.name)
      );

      if (isServant) {
        if (meta.groupId) where.groupId = meta.groupId;
        if (meta.levelId) where.levelId = meta.levelId;
        if (meta.gradeId) where.gradeId = meta.gradeId;
      }
    }

    // Apply explicit query filters (override metadata)
    if (filters?.levelId) where.levelId = filters.levelId;
    if (filters?.groupId) where.groupId = filters.groupId;
    if (filters?.status) where.status = filters.status;
    if (filters?.gradeId) where.gradeId = filters.gradeId;
    if (filters?.gender) where.gender = filters.gender;
    if (filters?.churchName) where.churchName = filters.churchName;

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

  private static readonly PASS_ROLES = ['servant', 'group_leader', 'level_leader', 'admin', 'super_admin'];

  private getUserRoleNames(user: any): string[] {
    if (!user) return [];
    if (Array.isArray(user.roles)) return user.roles;
    if (Array.isArray(user.userRoles)) {
      return user.userRoles.map((ur: any) => ur?.role?.name ?? ur?.roleName ?? ur).filter(Boolean);
    }
    return [];
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
      select: { id: true, level: { select: { number: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

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
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.prisma.studentSubjectPass.findMany({
      where: { studentId },
      orderBy: { passedAt: 'desc' },
    });
  }
}
