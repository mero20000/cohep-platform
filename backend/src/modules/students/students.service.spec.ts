import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StudentsService } from './students.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: any;

  const mockDate = new Date('2026-01-01');
  const schoolId = 'school-1';
  const academicYearId = 'ay-1';

  const mockLevel = { id: 'level-1', name: 'Level 1', number: 1 };
  const mockGroup = { id: 'group-1', name: 'Group A' };
  const mockStudent = {
    id: 'stu-1',
    schoolId,
    academicYearId,
    studentCode: 'STU-00001',
    firstName: 'Malak',
    lastName: 'Ahmed',
    firstNameAr: 'ملك',
    lastNameAr: 'أحمد',
    dateOfBirth: mockDate,
    gender: 'female',
    churchName: 'St. Mary',
    gradeId: 'grade-1',
    photoUrl: null,
    levelId: 'level-1',
    groupId: 'group-1',
    status: 'active',
    enrollmentDate: mockDate,
    graduationDate: null,
    metadata: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
    level: mockLevel,
    group: mockGroup,
    grade: { id: 'grade-1', name: 'Grade 4' },
    profile: null,
    studentParents: [],
    medicalNotes: [],
  };

  const prismaMock = {
    student: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    level: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    schoolGrade: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    group: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    academicYear: {
      findFirst: jest.fn(),
    },
systemConfig: {
      findUnique: jest.fn(),
    },
    attendanceRecord: { findMany: jest.fn() },
    studentProgress: { findMany: jest.fn() },
    studentBadge: { findMany: jest.fn() },
    xPTransaction: { aggregate: jest.fn() },
    attendanceSession: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: SchoolResolver, useValue: { resolve: jest.fn(async (id: string) => id) } },
        { provide: AnalyticsService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();

    prisma.academicYear.findFirst.mockResolvedValue({ id: academicYearId, isCurrent: true });
    prisma.student.count.mockResolvedValue(0);
    prisma.schoolGrade.findFirst.mockResolvedValue({ id: 'grade-1', groupId: 'group-1' });
  });

  // ===== findAll =====
  describe('findAll', () => {
    it('returns paginated students', async () => {
      prisma.student.findMany.mockResolvedValue([mockStudent]);
      prisma.student.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, schoolId);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].firstName).toBe('Malak');
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ schoolId, deletedAt: null }),
          skip: 0,
          take: 20,
        }),
      );
    });

    it('applies search filter', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      await service.findAll({ search: 'Malak', page: 1, limit: 20 }, schoolId);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { firstName: { contains: 'Malak', mode: 'insensitive' } },
              { lastName: { contains: 'Malak', mode: 'insensitive' } },
              { studentCode: { contains: 'Malak', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('applies level and group filters', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      await service.findAll({ levelId: 'level-1', groupId: 'group-1', page: 1, limit: 20 }, schoolId);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ levelId: 'level-1', groupId: 'group-1' }),
        }),
      );
    });

    it('applies status filter', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      await service.findAll({ status: 'active', page: 1, limit: 20 }, schoolId);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
    });

    it('caps limit at 100', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 999 }, schoolId);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('returns empty list when no students match', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 20 }, schoolId);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('applies server-side sort', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, sortBy: 'name', sortDir: 'asc' }, schoolId);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        }),
      );
    });

    it('orders by level number when sorting by level', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, sortBy: 'level', sortDir: 'desc' }, schoolId);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ level: { number: 'desc' } }],
        }),
      );
    });
  });

  // ===== findOne =====
  describe('findOne', () => {
    it('returns a student by id', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);

      const result = await service.findOne('stu-1', schoolId);

      expect(result.id).toBe('stu-1');
      expect(result.firstName).toBe('Malak');
    });

    it('throws NotFoundException when student not found', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', schoolId)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for soft-deleted student', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(service.findOne('deleted-stu', schoolId)).rejects.toThrow(NotFoundException);
    });
  });

  // ===== create =====
  describe('create', () => {
    it('creates a student with generated code', async () => {
      prisma.student.create.mockResolvedValue(mockStudent);

      const dto = {
        firstName: 'Malak',
        lastName: 'Ahmed',
        dateOfBirth: '2026-01-01',
        gender: 'female',
        levelId: 'level-1',
        gradeId: 'grade-1',
        churchName: 'St. Mary',
      };

      const result = await service.create(dto, schoolId);

      expect(result.studentCode).toBe('STU-00001');
      expect(result.firstName).toBe('Malak');
      expect(prisma.student.create).toHaveBeenCalled();
    });

    it('throws when no academic year is set', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(null);

      const dto = {
        firstName: 'Malak',
        lastName: 'Ahmed',
        dateOfBirth: '2026-01-01',
        gender: 'female',
        levelId: 'level-1',
        gradeId: 'grade-1',
      };

      await expect(service.create(dto, schoolId)).rejects.toThrow(NotFoundException);
    });

    it('handles Arabic name fields', async () => {
      prisma.student.create.mockResolvedValue({ ...mockStudent, firstNameAr: 'ملك', lastNameAr: 'أحمد' });

      const dto = {
        firstName: 'Malak',
        lastName: 'Ahmed',
        firstNameAr: 'ملك',
        lastNameAr: 'أحمد',
        dateOfBirth: '2026-01-01',
        gender: 'female',
        levelId: 'level-1',
        gradeId: 'grade-1',
      };

      const result = await service.create(dto, schoolId);

      expect(result.firstNameAr).toBe('ملك');
      expect(result.lastNameAr).toBe('أحمد');
    });

    it('skips taken codes without recursion', async () => {
      prisma.student.count.mockResolvedValue(1);
      // STU-00002 is taken, next free is STU-00003
      prisma.student.findFirst
        .mockResolvedValueOnce({ id: 'taken' }) // STU-00002 exists
        .mockResolvedValueOnce(null); // STU-00003 free
      prisma.student.create.mockResolvedValue({ ...mockStudent, studentCode: 'STU-00003' });

      const dto = {
        firstName: 'Malak',
        lastName: 'Ahmed',
        dateOfBirth: '2026-01-01',
        gender: 'female',
        levelId: 'level-1',
        gradeId: 'grade-1',
      };

      const result = await service.create(dto, schoolId);

      expect(result.studentCode).toBe('STU-00003');
    });

    it('derives groupId from the grade, overriding a supplied group', async () => {
      prisma.schoolGrade.findFirst.mockResolvedValue({ id: 'grade-1', groupId: 'group-9' });
      prisma.student.create.mockResolvedValue({ ...mockStudent, groupId: 'group-9' });

      const result = await service.create(
        {
          firstName: 'Malak',
          lastName: 'Ahmed',
          dateOfBirth: '2026-01-01',
          gender: 'female',
          levelId: 'level-1',
          gradeId: 'grade-1',
          groupId: 'group-1',
        },
        schoolId,
      );

      expect(result.groupId).toBe('group-9');
      expect(prisma.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gradeId: 'grade-1', groupId: 'group-9' }),
        }),
      );
    });

    it('throws when the grade is not found', async () => {
      prisma.schoolGrade.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { firstName: 'Malak', lastName: 'Ahmed', dateOfBirth: '2026-01-01', gender: 'female', levelId: 'level-1', gradeId: 'grade-9' },
          schoolId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.student.create).not.toHaveBeenCalled();
    });

    it('throws when neither a grade nor a group is provided', async () => {
      await expect(
        service.create(
          { firstName: 'Malak', lastName: 'Ahmed', dateOfBirth: '2026-01-01', gender: 'female', levelId: 'level-1' },
          schoolId,
        ),
      ).rejects.toThrow('Grade or group is required');
    });
  });

  // ===== update =====
  describe('update', () => {
    it('updates a student', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.student.update.mockResolvedValue({ ...mockStudent, firstName: 'Updated' });

      const result = await service.update('stu-1', { firstName: 'Updated' }, schoolId);

      expect(result.firstName).toBe('Updated');
    });

    it('throws when updating nonexistent student', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(service.update('nonexistent', { firstName: 'Test' }, schoolId)).rejects.toThrow(NotFoundException);
    });

    it('derives groupId from the grade when gradeId is provided', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.schoolGrade.findFirst.mockResolvedValue({ id: 'grade-1', groupId: 'group-9' });
      prisma.student.update.mockResolvedValue({ ...mockStudent, gradeId: 'grade-1', groupId: 'group-9' });

      const result = await service.update('stu-1', { gradeId: 'grade-1', groupId: 'group-1' }, schoolId);

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gradeId: 'grade-1', groupId: 'group-9' }),
        }),
      );
      expect(result.groupId).toBe('group-9');
    });

    it('throws when grade not found in the school', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.schoolGrade.findFirst.mockResolvedValue(null);

      await expect(service.update('stu-1', { gradeId: 'grade-9' }, schoolId)).rejects.toThrow(BadRequestException);
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('rejects a group from another school', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.group.findFirst.mockResolvedValue(null);

      await expect(
        service.update('stu-1', { groupId: 'group-x' }, schoolId),
      ).rejects.toThrow('Group not found');
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('updates status to graduated', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.student.update.mockResolvedValue({ ...mockStudent, status: 'graduated' });

      const result = await service.update('stu-1', { status: 'graduated' }, schoolId);

      expect(result.status).toBe('graduated');
    });
  });

  // ===== remove =====
  describe('remove', () => {
    it('soft deletes a student', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.student.update.mockResolvedValue({ ...mockStudent, deletedAt: new Date() });

      const result = await service.remove('stu-1', schoolId);

      expect(result.success).toBe(true);
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stu-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws when deleting nonexistent student', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', schoolId)).rejects.toThrow(NotFoundException);
    });
  });

  // ===== getLevels =====
  describe('getLevels', () => {
    it('returns active levels for school', async () => {
      prisma.level.findMany.mockResolvedValue([{ id: 'level-1', name: 'Level 1', number: 1 }]);

      const result = await service.getLevels(schoolId);

      expect(result).toHaveLength(1);
      expect(prisma.level.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId, deletedAt: null },
        }),
      );
    });

    it('returns empty array when no levels exist', async () => {
      prisma.level.findMany.mockResolvedValue([]);

      const result = await service.getLevels(schoolId);

      expect(result).toHaveLength(0);
    });
  });

  // ===== getGroups =====
  describe('getGroups', () => {
    it('returns school-wide active groups', async () => {
      prisma.group.findMany.mockResolvedValue([
        { id: 'group-1', name: 'Group A', status: 'active', orderIndex: 1 },
      ]);

      const result = await service.getGroups(schoolId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Group A');
      expect(prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId, deletedAt: null },
          orderBy: { orderIndex: 'asc' },
        }),
      );
    });
  });

  // ===== createGroup =====
  describe('createGroup', () => {
    it('creates a school-scoped group with orderIndex 1', async () => {
      prisma.group.findFirst.mockResolvedValue(null);
      prisma.group.create.mockResolvedValue({ id: 'group-2', name: 'Group B', schoolId, orderIndex: 1, status: 'active' });

      const result = await service.createGroup(schoolId, { name: 'Group B' });

      expect(result.name).toBe('Group B');
      expect(result.orderIndex).toBe(1);
      expect(prisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ schoolId, name: 'Group B', orderIndex: 1, status: 'active' }),
        }),
      );
    });

    it('checks for duplicates by school and name', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'group-1', name: 'Group B' });

      await expect(service.createGroup(schoolId, { name: 'Group B' })).rejects.toThrow('already exists');
      expect(prisma.group.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { schoolId, name: 'Group B', deletedAt: null } }),
      );
      expect(prisma.group.create).not.toHaveBeenCalled();
    });

    it('creates group with next orderIndex', async () => {
      prisma.group.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ orderIndex: 5 });
      prisma.group.create.mockResolvedValue({ id: 'group-3', name: 'Group C', schoolId, orderIndex: 6, status: 'active' });

      const result = await service.createGroup(schoolId, { name: 'Group C' });

      expect(result.orderIndex).toBe(6);
    });
  });

  // ===== updateGroup =====
  describe('updateGroup', () => {
    it('updates group name and status', async () => {
      prisma.group.findUnique.mockResolvedValue({ id: 'group-1', schoolId });
      prisma.group.findFirst.mockResolvedValue(null);
      prisma.group.update.mockResolvedValue({ id: 'group-1', name: 'Updated Group', status: 'active' });

      const result = await service.updateGroup('group-1', { name: 'Updated Group', status: 'active' });

      expect(result.name).toBe('Updated Group');
      expect(prisma.group.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId, name: 'Updated Group', deletedAt: null, id: { not: 'group-1' } },
        }),
      );
    });
  });

  // ===== deleteGroup =====
  describe('deleteGroup', () => {
    it('soft deletes a group', async () => {
      prisma.group.update.mockResolvedValue({ id: 'group-1', deletedAt: new Date() });

      const result = await service.deleteGroup('group-1');

      expect(result.success).toBe(true);
      expect(prisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'group-1' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });

  // ===== deleteAllGroups =====
  describe('deleteAllGroups', () => {
    it('soft deletes all groups for school', async () => {
      prisma.level.findMany.mockResolvedValue([{ id: 'level-1' }, { id: 'level-2' }]);
      prisma.group.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.deleteAllGroups(schoolId);

      expect(result.deletedCount).toBe(3);
    });

    it('returns 0 when no groups exist', async () => {
      prisma.group.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.deleteAllGroups(schoolId);

      expect(result.deletedCount).toBe(0);
      expect(prisma.group.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId, deletedAt: null },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });

  // ===== bulkCreate =====
  describe('bulkCreate', () => {
    it('imports students in bulk, resolving grades by name', async () => {
      prisma.student.count.mockResolvedValue(5);
      prisma.student.findMany.mockResolvedValue([]);
      prisma.level.findMany.mockResolvedValue([{ id: 'level-1', name: 'Level 1', number: 1 }]);
      prisma.schoolGrade.findMany.mockResolvedValue([{ id: 'grade-1', name: 'Grade 4', groupId: 'group-1' }]);
      prisma.student.create.mockResolvedValue({ ...mockStudent, studentCode: 'STU-00006' });
      prisma.$transaction.mockResolvedValue([{ ...mockStudent, studentCode: 'STU-00006' }]);

      const result = await service.bulkCreate(
        { students: [{ firstName: 'John', lastName: 'Doe', dateOfBirth: '2026-01-01', gender: 'male', levelId: 'level-1', grade: 'Grade 4' }] },
        schoolId,
      );

      expect(result.imported).toBe(1);
      expect(prisma.$transaction).toHaveBeenCalled();
      const createData = prisma.student.create.mock.calls[0][0].data;
      expect(createData.gradeId).toBe('grade-1');
      expect(createData.groupId).toBe('group-1');
    });

    it('reports a row error for an unmatched grade name', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.schoolGrade.findMany.mockResolvedValue([{ id: 'grade-1', name: 'Grade 4', groupId: 'group-1' }]);

      await expect(
        service.bulkCreate(
          { students: [{ firstName: 'John', lastName: 'Doe', dateOfBirth: '2026-01-01', gender: 'male', levelId: 'level-1', grade: 'Grade 9' }] },
          schoolId,
        ),
      ).rejects.toThrow('Grade "Grade 9" not found');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reports a row error when neither grade nor group is provided', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.schoolGrade.findMany.mockResolvedValue([]);

      await expect(
        service.bulkCreate(
          { students: [{ firstName: 'John', lastName: 'Doe', dateOfBirth: '2026-01-01', gender: 'male', levelId: 'level-1' }] },
          schoolId,
        ),
      ).rejects.toThrow('Grade or group is required');
    });

    it('throws when no academic year set', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(
        service.bulkCreate(
          { students: [{ firstName: 'John', lastName: 'Doe', dateOfBirth: '2026-01-01', gender: 'male', levelId: 'level-1' }] },
          schoolId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===== getAttendanceHistory =====
  describe('getAttendanceHistory', () => {
    it('returns attendance records for student', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { id: 'att-1', studentId: 'stu-1', status: 'present', recordedAt: mockDate },
      ]);

      const result = await service.getAttendanceHistory('stu-1', schoolId);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('present');
    });

    it('throws for nonexistent student', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(service.getAttendanceHistory('nonexistent', schoolId)).rejects.toThrow(NotFoundException);
    });
  });

  // ===== getProgress =====
  describe('getProgress', () => {
    it('returns progress records for student', async () => {
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.studentProgress.findMany.mockResolvedValue([
        { id: 'prog-1', studentId: 'stu-1', levelId: 'level-1', score: 85 },
      ]);

      const result = await service.getProgress('stu-1', schoolId);

      expect(result).toHaveLength(1);
    });

    it('throws for nonexistent student', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(service.getProgress('nonexistent', schoolId)).rejects.toThrow(NotFoundException);
    });
  });

  // ===== getPortalData =====
  describe('getPortalData', () => {
    beforeEach(() => {
      prisma.student.findFirst.mockResolvedValue({ ...mockStudent, portalAccessKey: 'abc-secret-key' });
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.studentBadge.findMany.mockResolvedValue([]);
      prisma.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 120 } });
      prisma.attendanceSession.findMany.mockResolvedValue([]);
    });

    it('looks up student by portalAccessKey, not studentCode', async () => {
      await service.getPortalData('abc-secret-key');

      expect(prisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { portalAccessKey: 'abc-secret-key', deletedAt: null },
        }),
      );
    });

    it('throws NotFoundException for unknown access key', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(service.getPortalData('nope')).rejects.toThrow(NotFoundException);
    });

    it('returns student summary with XP total', async () => {
      const result = await service.getPortalData('abc-secret-key');

      expect(result.student.studentCode).toBe('STU-00001');
      expect(result.totalXp).toBe(120);
      expect(result.attendance).toEqual({ present: 0, late: 0, absent: 0, excused: 0, total: 0 });
    });
  });

  // ===== getStats =====
  describe('getStats', () => {
    it('maps gradeDistribution by gradeId to grade names', async () => {
      prisma.student.groupBy.mockResolvedValue([
        { gradeId: 'grade-1', _count: { id: 3 } },
        { gradeId: 'grade-2', _count: { id: 2 } },
      ]);
      prisma.schoolGrade.findMany.mockResolvedValue([
        { id: 'grade-1', name: 'Grade 4', orderIndex: 1 },
        { id: 'grade-2', name: 'Grade 5', orderIndex: 2 },
      ]);

      const result = await service.getStats(schoolId);

      expect(prisma.student.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['gradeId'],
          where: expect.objectContaining({ schoolId, gradeId: { not: null } }),
        }),
      );
      expect(result.gradeDistribution).toEqual([
        { grade: 'Grade 4', count: 3 },
        { grade: 'Grade 5', count: 2 },
      ]);
    });

    it('counts students without a grade by gradeId null', async () => {
      await service.getStats(schoolId);

      const gradeNullWhere = prisma.student.count.mock.calls
        .map(c => c[0] && c[0].where)
        .find(w => w && w.gradeId === null);
      expect(gradeNullWhere).toEqual(expect.objectContaining({ schoolId, deletedAt: null, gradeId: null }));
    });

    it('returns empty distribution when no grouped students', async () => {
      prisma.student.groupBy.mockResolvedValue([]);

      const result = await service.getStats(schoolId);

      expect(result.gradeDistribution).toEqual([]);
    });
  });

});
