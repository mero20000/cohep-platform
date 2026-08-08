import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { GradesService } from './grades.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

describe('GradesService', () => {
  let service: GradesService;
  let prisma: any;

  const schoolId = 'school-1';
  const mockDate = new Date('2026-01-01');

  const mockGradeRow = {
    id: 'grade-1',
    schoolId,
    name: 'Grade 4',
    nameAr: null,
    groupId: 'group-1',
    orderIndex: 1,
    status: 'active',
    metadata: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
    group: { id: 'group-1', name: 'Group A', nameAr: null },
    _count: { students: 3 },
  };

  const prismaMock = {
    schoolGrade: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    group: {
      findFirst: jest.fn(),
    },
    student: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn(async (id: string) => id) } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(GradesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  // ===== getGrades =====
  describe('getGrades', () => {
    it('maps groupName and studentCount', async () => {
      prisma.schoolGrade.findMany.mockResolvedValue([mockGradeRow]);

      const result = await service.getGrades(schoolId);

      expect(prisma.schoolGrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId, deletedAt: null },
          orderBy: { orderIndex: 'asc' },
        }),
      );
      expect(result).toEqual([
        {
          id: 'grade-1',
          name: 'Grade 4',
          nameAr: null,
          groupId: 'group-1',
          groupName: 'Group A',
          orderIndex: 1,
          status: 'active',
          studentCount: 3,
        },
      ]);
    });

    it('returns empty list when no grades exist', async () => {
      prisma.schoolGrade.findMany.mockResolvedValue([]);

      const result = await service.getGrades(schoolId);

      expect(result).toEqual([]);
    });
  });

  // ===== createGrade =====
  describe('createGrade', () => {
    it('throws ConflictException on duplicate name', async () => {
      prisma.schoolGrade.findFirst.mockResolvedValue({ id: 'grade-9', name: 'Grade 4' });

      await expect(service.createGrade(schoolId, { name: 'Grade 4', groupId: 'group-1' })).rejects.toThrow(ConflictException);
      expect(prisma.schoolGrade.create).not.toHaveBeenCalled();
    });

    it('rejects a group from another school', async () => {
      prisma.schoolGrade.findFirst.mockResolvedValue(null);
      prisma.group.findFirst.mockResolvedValue(null);

      await expect(service.createGrade(schoolId, { name: 'Grade 4', groupId: 'group-x' })).rejects.toThrow(BadRequestException);
      expect(prisma.group.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'group-x', schoolId, deletedAt: null } }),
      );
      expect(prisma.schoolGrade.create).not.toHaveBeenCalled();
    });

    it('sets orderIndex to max+1', async () => {
      prisma.schoolGrade.findFirst
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce({ orderIndex: 4 }); // current max
      prisma.group.findFirst.mockResolvedValue({ id: 'group-1' });
      prisma.schoolGrade.create.mockResolvedValue({ ...mockGradeRow, orderIndex: 5 });

      const result = await service.createGrade(schoolId, { name: 'Grade 4', groupId: 'group-1' });

      expect(result.orderIndex).toBe(5);
      expect(prisma.schoolGrade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ schoolId, name: 'Grade 4', groupId: 'group-1', orderIndex: 5 }),
        }),
      );
    });

    it('defaults orderIndex to 1 when no grades exist', async () => {
      prisma.schoolGrade.findFirst.mockResolvedValue(null);
      prisma.group.findFirst.mockResolvedValue({ id: 'group-1' });
      prisma.schoolGrade.create.mockResolvedValue(mockGradeRow);

      await service.createGrade(schoolId, { name: 'Grade 4', groupId: 'group-1' });

      expect(prisma.schoolGrade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orderIndex: 1 }),
        }),
      );
    });
  });

  // ===== updateGrade =====
  describe('updateGrade', () => {
    const existing = { id: 'grade-1', schoolId, name: 'Grade 4', groupId: 'group-1', status: 'active' };

    it('throws NotFoundException when grade is missing', async () => {
      prisma.schoolGrade.findUnique.mockResolvedValue(null);

      await expect(service.updateGrade('grade-9', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('batch-moves students when groupId changes', async () => {
      prisma.schoolGrade.findUnique.mockResolvedValue(existing);
      prisma.group.findFirst.mockResolvedValue({ id: 'group-2' });
      prisma.schoolGrade.update.mockResolvedValue({
        ...mockGradeRow,
        groupId: 'group-2',
        group: { id: 'group-2', name: 'Group B', nameAr: null },
      });

      await service.updateGrade('grade-1', { groupId: 'group-2' });

      expect(prisma.student.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { gradeId: 'grade-1', deletedAt: null },
          data: { groupId: 'group-2' },
        }),
      );
    });

    it('does not move students when groupId is unchanged', async () => {
      prisma.schoolGrade.findUnique.mockResolvedValue(existing);
      prisma.schoolGrade.update.mockResolvedValue(mockGradeRow);

      await service.updateGrade('grade-1', { name: 'Grade 4 Updated' });

      expect(prisma.student.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate name', async () => {
      prisma.schoolGrade.findUnique.mockResolvedValue(existing);
      prisma.schoolGrade.findFirst.mockResolvedValue({ id: 'grade-2', name: 'Grade 4 Updated' });

      await expect(service.updateGrade('grade-1', { name: 'Grade 4 Updated' })).rejects.toThrow(ConflictException);
      expect(prisma.schoolGrade.update).not.toHaveBeenCalled();
    });

    it('rejects a group from another school', async () => {
      prisma.schoolGrade.findUnique.mockResolvedValue(existing);
      prisma.group.findFirst.mockResolvedValue(null);

      await expect(service.updateGrade('grade-1', { groupId: 'group-x' })).rejects.toThrow(BadRequestException);
      expect(prisma.schoolGrade.update).not.toHaveBeenCalled();
    });
  });

  // ===== deleteGrade =====
  describe('deleteGrade', () => {
    it('soft deletes a grade with no active students', async () => {
      prisma.schoolGrade.findUnique.mockResolvedValue({ id: 'grade-1', schoolId, name: 'Grade 4' });
      prisma.student.count.mockResolvedValue(0);
      prisma.schoolGrade.update.mockResolvedValue({ id: 'grade-1', deletedAt: mockDate });

      const result = await service.deleteGrade('grade-1');

      expect(result.success).toBe(true);
      expect(prisma.student.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { gradeId: 'grade-1', deletedAt: null } }),
      );
      expect(prisma.schoolGrade.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'grade-1' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });

    it('blocks deletion when active students reference the grade', async () => {
      prisma.schoolGrade.findUnique.mockResolvedValue({ id: 'grade-1', schoolId, name: 'Grade 4' });
      prisma.student.count.mockResolvedValue(2);

      await expect(service.deleteGrade('grade-1')).rejects.toThrow('active student');
      expect(prisma.schoolGrade.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when grade is missing', async () => {
      prisma.schoolGrade.findUnique.mockResolvedValue(null);

      await expect(service.deleteGrade('grade-9')).rejects.toThrow(NotFoundException);
    });
  });
});
