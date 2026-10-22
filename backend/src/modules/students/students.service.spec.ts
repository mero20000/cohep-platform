import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    school: { id: schoolId, name: 'Test School', nameAr: 'مدرسةテスト', logoUrl: null, church: { name: 'St. Mary Cathedral', nameAr: 'كاتدرائية السيدة مريم' } },
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
    assessmentSubmission: { findMany: jest.fn() },
    familyLiturgy: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    studentParent: { findFirst: jest.fn() },
    subjectItem: { findFirst: jest.fn(), findMany: jest.fn() },
    studentSubjectPass: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
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
    prisma.level.findFirst.mockResolvedValue({ id: 'level-1' });
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

    it('restricts the list to the given ids (favorites)', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, ids: 'a, b,,c' }, schoolId);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { in: ['a', 'b', 'c'] } }) }),
      );
    });

    it('searches the parent phone stored in metadata.phone', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, search: '0100' }, schoolId);

      const where = prisma.student.findMany.mock.calls[0][0].where;
      expect(where.OR).toContainEqual({ metadata: { path: ['phone'], string_contains: '0100' } });
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
              { firstNameAr: { contains: 'Malak', mode: 'insensitive' } },
              { lastNameAr: { contains: 'Malak', mode: 'insensitive' } },
              { studentCode: { contains: 'Malak', mode: 'insensitive' } },
              { parentEmail: { contains: 'Malak', mode: 'insensitive' } },
              { churchName: { contains: 'Malak', mode: 'insensitive' } },
              { metadata: { path: ['phone'], string_contains: 'Malak' } },
              { metadata: { path: ['studentPhone'], string_contains: 'Malak' } },
              { studentParents: { some: { parent: { phone: { contains: 'Malak', mode: 'insensitive' } } } } },
              { studentParents: { some: { parent: { email: { contains: 'Malak', mode: 'insensitive' } } } } },
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

    it('retries with the next free code when a concurrent create took the same one', async () => {
      const dto = {
        firstName: 'Malak', lastName: 'Ahmed', dateOfBirth: '2026-01-01', gender: 'female',
        levelId: 'level-1', gradeId: 'grade-1', churchName: 'St. Mary',
      };
      const conflict = Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['school_id', 'student_code'] } });
      prisma.student.create.mockRejectedValueOnce(conflict).mockResolvedValueOnce({ ...mockStudent, studentCode: 'STU-00002' });

      const result = await service.create(dto, schoolId);

      expect(result.studentCode).toBe('STU-00002');
      expect(prisma.student.create).toHaveBeenCalledTimes(2);
    });

    it('does not retry unrelated unique violations', async () => {
      const dto = {
        firstName: 'Malak', lastName: 'Ahmed', dateOfBirth: '2026-01-01', gender: 'female',
        levelId: 'level-1', gradeId: 'grade-1', churchName: 'St. Mary',
      };
      const other = Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['portal_access_key'] } });
      prisma.student.create.mockRejectedValueOnce(other);

      await expect(service.create(dto, schoolId)).rejects.toBe(other);
      expect(prisma.student.create).toHaveBeenCalledTimes(1);
    });

    it('gives up after repeated code conflicts instead of looping forever', async () => {
      const dto = {
        firstName: 'Malak', lastName: 'Ahmed', dateOfBirth: '2026-01-01', gender: 'female',
        levelId: 'level-1', gradeId: 'grade-1', churchName: 'St. Mary',
      };
      const conflict = Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['student_code'] } });
      prisma.student.create.mockRejectedValue(conflict);

      await expect(service.create(dto, schoolId)).rejects.toBe(conflict);
      expect(prisma.student.create).toHaveBeenCalledTimes(5);
    });

    it('B4: rejects a level that belongs to another school', async () => {
      prisma.level.findFirst.mockResolvedValue(null);
      const dto = { firstName: 'Malak', lastName: 'Ahmed', dateOfBirth: '2026-01-01', gender: 'female', levelId: 'level-foreign', gradeId: 'grade-1' };
      await expect(service.create(dto as any, schoolId)).rejects.toThrow(BadRequestException);
      expect(prisma.student.create).not.toHaveBeenCalled();
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
  // ===== authorization (B1–B4) =====
  describe('authorization', () => {
    const scopedServant = { id: 'srv-1', roles: ['servant'], schoolId };
    const admin = { id: 'adm-1', roles: ['admin'], schoolId };
    const principal = { id: 'pri-1', roles: ['principal'], schoolId };

    const asServant = (meta: any = { groupId: 'group-1', levelId: 'level-1' }) =>
      prisma.user.findUnique.mockResolvedValue({ metadata: meta, userRoles: [{ role: { name: 'servant' } }] });
    const asAdmin = () =>
      prisma.user.findUnique.mockResolvedValue({ metadata: {}, userRoles: [{ role: { name: 'admin' } }] });

    beforeEach(() => {
      prisma.student.findFirst.mockReset();
      prisma.student.findMany.mockReset();
      prisma.student.update.mockReset();
      prisma.student.updateMany.mockReset();
      prisma.level.findFirst.mockReset();
      prisma.group.findFirst.mockReset();
      prisma.studentParent.findFirst.mockReset();
    });

    it('B1: findOne applies a servant\'s assignment scope', async () => {
      asServant();
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      await service.findOne('stu-1', schoolId, scopedServant);
      expect(prisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'stu-1', schoolId, groupId: 'group-1', levelId: 'level-1' }) }),
      );
    });

    it('B1: a student outside the servant\'s scope is a 404 on delete', async () => {
      asServant();
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(service.remove('stu-9', schoolId, scopedServant)).rejects.toThrow(NotFoundException);
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('B1: the list cannot be widened by passing another groupId', async () => {
      asServant();
      prisma.student.findMany.mockResolvedValue([]);
      prisma.student.count.mockResolvedValue(0);
      await service.findAll({ page: 1, limit: 20, groupId: 'group-other' }, schoolId, scopedServant);
      const where = prisma.student.findMany.mock.calls[0][0].where;
      expect(where.groupId).toBe('group-1');
    });

    it('B1: admins stay unrestricted', async () => {
      asAdmin();
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      await service.findOne('stu-1', schoolId, admin);
      expect(prisma.student.findFirst.mock.calls[0][0].where).toEqual({ id: 'stu-1', schoolId, deletedAt: null });
    });

    it('B1: bulk delete only touches students inside the caller\'s scope', async () => {
      asServant();
      prisma.student.updateMany.mockResolvedValue({ count: 1 });
      await service.bulkDelete(['a', 'b'], schoolId, scopedServant);
      expect(prisma.student.updateMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ id: { in: ['a', 'b'] }, groupId: 'group-1', levelId: 'level-1' }),
      );
    });

    it('B1: a servant cannot move a student into another group', async () => {
      asServant();
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.group.findFirst.mockResolvedValue({ id: 'group-2' });
      await expect(service.update('stu-1', { groupId: 'group-2' } as any, schoolId, scopedServant)).rejects.toThrow(ForbiddenException);
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('B1: subject-item endpoints reject a caller from another school', async () => {
      asAdmin();
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1', schoolId: 'school-2', level: { number: 1 } });
      await expect(service.getStudentSubjectItems('stu-1', admin)).rejects.toThrow(NotFoundException);
      await expect(service.toggleSubjectItemPass('stu-1', 'item-1', admin)).rejects.toThrow(NotFoundException);
    });

    it('B1: a parent only reaches a linked child\'s subject items', async () => {
      const parent = { id: 'par-1', roles: ['parent'], schoolId };
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1', schoolId, level: { number: 1 } });
      prisma.studentParent.findFirst.mockResolvedValue(null);
      await expect(service.getStudentSubjectItems('stu-1', parent)).rejects.toThrow(NotFoundException);
    });

    it('B2: a servant cannot approve a pending student through update', async () => {
      asServant({});
      prisma.student.findFirst.mockResolvedValue({ ...mockStudent, status: 'pending' });
      await expect(service.update('stu-1', { status: 'active' } as any, schoolId, scopedServant)).rejects.toThrow(ForbiddenException);
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('B2: an admin can move a pending student to active, and a servant can still toggle active/inactive', async () => {
      asAdmin();
      prisma.student.findFirst.mockResolvedValue({ ...mockStudent, status: 'pending' });
      prisma.student.update.mockResolvedValue({ ...mockStudent, status: 'active' });
      await expect(service.update('stu-1', { status: 'active' } as any, schoolId, admin)).resolves.toBeDefined();

      asServant({});
      prisma.student.findFirst.mockResolvedValue({ ...mockStudent, status: 'active' });
      await expect(service.update('stu-1', { status: 'inactive' } as any, schoolId, scopedServant)).resolves.toBeDefined();
    });

    it('B2: rejects unknown status values', async () => {
      asAdmin();
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      await expect(service.update('stu-1', { status: 'wizard' } as any, schoolId, admin)).rejects.toThrow(BadRequestException);
    });

    it('B2: bulk status change skips pending students unless the caller is an approver', async () => {
      asServant({});
      prisma.student.updateMany.mockResolvedValue({ count: 1 });
      await service.bulkUpdate(['a', 'b'], { status: 'active' } as any, schoolId, scopedServant);
      expect(prisma.student.updateMany.mock.calls[0][0].where.status).toEqual({ not: 'pending' });

      asAdmin();
      prisma.student.updateMany.mockClear();
      prisma.student.updateMany.mockResolvedValue({ count: 2 });
      const res = await service.bulkUpdate(['a', 'b'], { status: 'active' } as any, schoolId, principal);
      expect(prisma.student.updateMany.mock.calls[0][0].where.status).toBeUndefined();
      expect(res).toEqual({ updated: 2, skipped: 0 });
    });

    it('B2: approve activates a pending student and audits it', async () => {
      asAdmin();
      prisma.student.findFirst.mockResolvedValue({ ...mockStudent, status: 'pending' });
      prisma.student.update.mockResolvedValue({ ...mockStudent, status: 'active' });
      const out = await service.approve('stu-1', schoolId, admin);
      expect(out.status).toBe('active');
      expect(prisma.student.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'active' } }));
    });

    it('B2: approve refuses a student that is not pending', async () => {
      asAdmin();
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      await expect(service.approve('stu-1', schoolId, admin)).rejects.toThrow(BadRequestException);
    });

    it('B3: rotating a key is limited to the caller\'s own school', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(service.rotatePortalAccessKey('stu-other', admin)).rejects.toThrow(NotFoundException);
      expect(prisma.student.findFirst.mock.calls[0][0].where).toEqual(expect.objectContaining({ id: 'stu-other', schoolId }));
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('B3: rotation is audited without recording the key, and super_admin spans schools', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1', schoolId: 'school-2' });
      prisma.student.update.mockResolvedValue({});
      const out = await service.rotatePortalAccessKey('stu-1', { id: 'sa-1', roles: ['super_admin'] });
      expect(out.newKey).toMatch(/[0-9a-f-]{36}/);
      expect(prisma.student.findFirst.mock.calls[0][0].where).toEqual({ id: 'stu-1', deletedAt: null });
      const audit = (service as any).audit.log.mock.calls[0][0];
      expect(audit).toEqual(expect.objectContaining({ action: 'ROTATE_PORTAL_KEY', entityId: 'stu-1', schoolId: 'school-2', userId: 'sa-1' }));
      expect(JSON.stringify(audit)).not.toContain(out.newKey);
    });

    it('B4: bulk level change rejects a level from another school', async () => {
      asAdmin();
      prisma.level.findFirst.mockResolvedValue(null);
      await expect(service.bulkUpdate(['a'], { levelId: 'level-foreign' } as any, schoolId, admin)).rejects.toThrow(BadRequestException);
      expect(prisma.student.updateMany).not.toHaveBeenCalled();
      expect(prisma.level.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'level-foreign', schoolId }) }));
    });

    it('B4: bulk group change rejects a group from another school', async () => {
      asAdmin();
      prisma.group.findFirst.mockResolvedValue(null);
      await expect(service.bulkUpdate(['a'], { groupId: 'group-foreign' } as any, schoolId, admin)).rejects.toThrow(BadRequestException);
    });

    it('B4: a servant cannot bulk-move students outside their own group', async () => {
      asServant();
      prisma.group.findFirst.mockResolvedValue({ id: 'group-2' });
      await expect(service.bulkUpdate(['a'], { groupId: 'group-2' } as any, schoolId, scopedServant)).rejects.toThrow(ForbiddenException);
    });

    it('B4: single update also rejects a level from another school', async () => {
      asAdmin();
      prisma.student.findFirst.mockResolvedValue(mockStudent);
      prisma.level.findFirst.mockResolvedValue(null);
      await expect(service.update('stu-1', { levelId: 'level-foreign' } as any, schoolId, admin)).rejects.toThrow(BadRequestException);
    });
  });

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
      prisma.level.findMany.mockResolvedValue([]);
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
      prisma.assessmentSubmission.findMany.mockResolvedValue([]);
      prisma.familyLiturgy.findMany.mockResolvedValue([]);
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
      expect(result.school).toEqual({
        name: 'Test School',
        nameAr: 'مدرسةテスト',
        logoUrl: null,
        churchName: 'St. Mary Cathedral',
        churchNameAr: 'كاتدرائية السيدة مريم',
        churchLogoUrl: null,
      });
    });
  });

  // ===== getStudentSubjectItems (portal) =====
  describe('getStudentSubjectItems', () => {
    it('allows portal access without staff roles and returns items with status', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1', level: { number: 1 } });
      prisma.subjectItem.findMany.mockResolvedValue([
        { id: 'item-1', orderIndex: 1, subject: { id: 'sub-1' } },
      ]);
      prisma.studentSubjectPass.findMany.mockResolvedValue([
        {
          id: 'pass-1',
          subjectItemId: 'item-1',
          revokedAt: null,
          passedAt: mockDate,
          passedBy: 'user-1',
          passer: { id: 'user-1', firstName: 'Sam', lastName: 'Servant' },
        },
      ]);

      const result = await service.getStudentSubjectItems('stu-1', null, { portal: true });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('status');
      expect(result[0].status).toBe('passed');
      expect(result[0].passedByUser).toEqual({ id: 'user-1', firstName: 'Sam', lastName: 'Servant' });
    });

    it('throws ForbiddenException for non-staff user without portal flag', async () => {
      await expect(
        service.getStudentSubjectItems('stu-1', { id: 'u2', roles: ['curriculum_manager'] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===== toggleSubjectItemPass =====
  describe('toggleSubjectItemPass', () => {
    const servantUser = { id: 'user-1', roles: ['servant'], schoolId };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ metadata: {}, userRoles: [{ role: { name: 'servant' } }] });
      prisma.studentSubjectPass.findFirst.mockReset();
      prisma.studentSubjectPass.findMany.mockReset();
      prisma.studentSubjectPass.create.mockReset();
      prisma.studentSubjectPass.update.mockReset();
    });

    it('should toggle passed and keep history', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1', schoolId, level: { number: 1 } });
      prisma.subjectItem.findFirst.mockResolvedValue({
        id: 'item-1',
        subjectId: 'sub-1',
        subject: { schoolId },
        levels: [{ levelNumber: 1 }],
      });
      prisma.studentSubjectPass.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'pass-1' });
      prisma.studentSubjectPass.create.mockResolvedValue({ id: 'pass-1', revokedAt: null });
      prisma.studentSubjectPass.update.mockResolvedValue({ id: 'pass-1', revokedAt: new Date() });
      prisma.studentSubjectPass.findMany.mockResolvedValue([{ id: 'pass-1', revokedAt: new Date() }]);

      const res1 = await service.toggleSubjectItemPass('stu-1', 'item-1', servantUser, {});
      expect(res1.passed).toBe(true);
      expect(prisma.studentSubjectPass.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: 'stu-1', subjectItemId: 'item-1', passedBy: 'user-1' }),
        }),
      );

      const res2 = await service.toggleSubjectItemPass('stu-1', 'item-1', servantUser, {});
      expect(res2.passed).toBe(false);
      expect(prisma.studentSubjectPass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pass-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date), revokedBy: 'user-1' }),
        }),
      );

      const history = await service.getStudentPassHistory('stu-1', servantUser);
      expect(history.length).toBe(1);
      expect(history[0].revokedAt).not.toBeNull();
    });

    it('throws when item is not allocated to student level', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1', schoolId, level: { number: 2 } });
      prisma.subjectItem.findFirst.mockResolvedValue({
        id: 'item-1',
        subjectId: 'sub-1',
        subject: { schoolId },
        levels: [{ levelNumber: 1 }],
      });

      await expect(service.toggleSubjectItemPass('stu-1', 'item-1', servantUser, {})).rejects.toThrow(
        'Subject item not allocated to student level',
      );
    });

    it('throws when subject item belongs to a different school than the student', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1', schoolId, level: { number: 1 } });
      prisma.subjectItem.findFirst.mockResolvedValue({
        id: 'item-1',
        subjectId: 'sub-1',
        subject: { schoolId: 'school-other' },
        levels: [{ levelNumber: 1 }],
      });

      await expect(service.toggleSubjectItemPass('stu-1', 'item-1', servantUser, {})).rejects.toThrow(
        new BadRequestException('Subject item does not belong to the same school as the student'),
      );
      expect(prisma.studentSubjectPass.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for disallowed role', async () => {
      await expect(
        service.toggleSubjectItemPass('stu-1', 'item-1', { id: 'u2', roles: ['curriculum_manager'] }, {}),
      ).rejects.toThrow(ForbiddenException);
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
      prisma.student.groupBy.mockResolvedValue([]);
      prisma.schoolGrade.findMany.mockResolvedValue([]);

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
