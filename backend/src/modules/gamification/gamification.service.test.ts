import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('GamificationService', () => {
  let service: GamificationService;
  let prismaMock: jest.Mocked<PrismaService>;
  let schoolResolverMock: jest.Mocked<SchoolResolver>;

  beforeEach(async () => {
    // Create mocks
    prismaMock = {
      student: { findUnique: jest.fn() } as any,
      xPTransaction: { aggregate: jest.fn(), deleteMany: jest.fn(), create: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() } as any,
      studentBadge: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() } as any,
      badge: { findUnique: jest.fn() } as any,
      studentProgress: { updateMany: jest.fn() } as any,
      $transaction: jest.fn((fn) => fn(prismaMock)) as any,
    } as jest.Mocked<PrismaService>;

    schoolResolverMock = {
      resolve: jest.fn().mockResolvedValue('school-id'),
    } as unknown as jest.Mocked<SchoolResolver>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: schoolResolverMock },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  describe('addXp', () => {
    it('should add XP and create transaction', async () => {
      const mockStudent = { id: 'student-1', firstName: 'John', lastName: 'Doe' };
      const mockTransaction = { id: 'tx-1', studentId: 'student-1', amount: 50, balanceAfter: 50, type: 'test', description: 'Test' };

      prismaMock.student.findUnique.mockResolvedValue(mockStudent as any);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 } as any);
      prismaMock.xPTransaction.create.mockResolvedValue(mockTransaction as any);
      prismaMock.studentProgress.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.addXp('student-1', 50, 'test', 'Test');

      expect(result).toEqual(mockTransaction);
      expect(prismaMock.student.findUnique).toHaveBeenCalledWith({ where: { id: 'student-1' } });
      expect(prismaMock.xPTransaction.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when student not found', async () => {
      prismaMock.student.findUnique.mockResolvedValue(null);

      await expect(service.addXp('invalid-id', 50, 'test', 'Test')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteStudentXp', () => {
    it('should delete all XP transactions for student', async () => {
      const mockStudent = { id: 'student-1', firstName: 'John', lastName: 'Doe' };

      prismaMock.student.findUnique.mockResolvedValue(mockStudent as any);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 500 }, _count: 10 } as any);
      prismaMock.xPTransaction.deleteMany.mockResolvedValue({ count: 10 } as any);

      const result = await service.deleteStudentXp('student-1', 'Admin request');

      expect(result.deletedXp).toBe(500);
      expect(result.deletedTransactions).toBe(10);
      expect(prismaMock.xPTransaction.deleteMany).toHaveBeenCalledWith({ where: { studentId: 'student-1' } });
    });

    it('should throw NotFoundException when student not found', async () => {
      prismaMock.student.findUnique.mockResolvedValue(null);

      await expect(service.deleteStudentXp('invalid-id', 'reason')).rejects.toThrow(NotFoundException);
    });
  });

  describe('amendStudentXp', () => {
    it('should amend XP by positive amount', async () => {
      const mockStudent = { id: 'student-1', firstName: 'John', lastName: 'Doe' };

      prismaMock.student.findUnique.mockResolvedValue(mockStudent as any);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 100 } } as any);
      prismaMock.xPTransaction.create.mockResolvedValue({
        id: 'tx-1',
        studentId: 'student-1',
        amount: 50,
        balanceAfter: 150,
        type: 'xp_amendment',
        description: 'Manual adjustment',
      } as any);

      const result = await service.amendStudentXp('student-1', 50, 'Manual adjustment');

      expect(result.newBalance).toBe(150);
      expect(result.amendment).toBe(50);
    });

    it('should amend XP by negative amount without going below zero', async () => {
      const mockStudent = { id: 'student-1', firstName: 'John', lastName: 'Doe' };

      prismaMock.student.findUnique.mockResolvedValue(mockStudent as any);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 100 } } as any);
      prismaMock.xPTransaction.create.mockResolvedValue({
        id: 'tx-1',
        studentId: 'student-1',
        amount: -200,
        balanceAfter: 0,
        type: 'xp_amendment',
        description: 'Deduction',
      } as any);

      const result = await service.amendStudentXp('student-1', -200, 'Deduction');

      expect(result.newBalance).toBe(0);
      expect(result.amendment).toBe(-200);
    });
  });

  describe('getStudentXpInfo', () => {
    it('should return student XP information', async () => {
      const mockStudent = { id: 'student-1', firstName: 'John', lastName: 'Doe' };

      prismaMock.student.findUnique.mockResolvedValue(mockStudent as any);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 250 }, _count: 5 } as any);
      prismaMock.xPTransaction.findMany.mockResolvedValue([
        { id: 'tx-1', amount: 50, type: 'test', description: 'Test', createdAt: new Date(), balanceAfter: 50 },
      ] as any);

      const result = await service.getStudentXpInfo('student-1');

      expect(result.totalXp).toBe(250);
      expect(result.level).toBe(3); // floor(250/100) + 1
      expect(result.transactionCount).toBe(5);
    });
  });

  describe('getBadgeStudents', () => {
    it('should return list of students who earned badge', async () => {
      const mockBadge = { id: 'badge-1', name: 'Test Badge', description: 'Test', category: 'test', iconUrl: 'icon', xpReward: 50 };

      prismaMock.badge.findUnique.mockResolvedValue(mockBadge as any);
      prismaMock.studentBadge.findMany.mockResolvedValue([
        {
          student: { id: 'student-1', firstName: 'John', lastName: 'Doe', groupId: 'group-1' },
          awardedAt: new Date(),
        },
      ] as any);

      const result = await service.getBadgeStudents('badge-1');

      expect(result.badge.name).toBe('Test Badge');
      expect(result.totalStudents).toBe(1);
      expect(result.students[0].firstName).toBe('John');
    });

    it('should throw NotFoundException when badge not found', async () => {
      prismaMock.badge.findUnique.mockResolvedValue(null);

      await expect(service.getBadgeStudents('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
