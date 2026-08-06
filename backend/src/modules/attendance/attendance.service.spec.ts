import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { AnalyticsService } from '../analytics/analytics.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: any;

  const schoolId = 'school-1';

  const prismaMock = {
    attendanceSession: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    attendanceRecord: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    student: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: GamificationService, useValue: { computeBadgesForStudent: jest.fn() } },
        { provide: NotificationsService, useValue: { createNotification: jest.fn() } },
        { provide: MailService, useValue: { sendAttendanceAlert: jest.fn() } },
        { provide: AnalyticsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getSessions', () => {
    it('caps limit at 1000', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.count.mockResolvedValue(0);

      await service.getSessions(schoolId, { page: 1, limit: 500 });

      expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );
    });

    it('includes the entire end day in the `to` filter', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.count.mockResolvedValue(0);

      await service.getSessions(schoolId, { from: '2026-01-01', to: '2026-01-05' });

      expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-05T23:59:59.999'),
            },
          }),
        }),
      );
    });

    it('excludes attendance records of soft-deleted students from the summary', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([
        {
          id: 'sess-1',
          scheduledDate: new Date('2026-01-05'),
          attendanceRecords: [
            { status: 'present', student: { deletedAt: null } },
            { status: 'present', student: { deletedAt: new Date() } },
            { status: 'absent', student: { deletedAt: null } },
            { status: 'absent', student: null },
          ],
        } as any,
      ]);
      prisma.attendanceSession.count.mockResolvedValue(1);

      const { data } = (await service.getSessions(schoolId, {})) as any;

      expect(data[0].summary).toEqual({ present: 1, absent: 1, late: 0, excused: 0, total: 2 });
      expect(data[0].attendanceRecords).toBeUndefined();
    });
  });

  describe('createSession', () => {
    it('throws when a session already exists for the group on the date', async () => {
      prisma.attendanceSession.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createSession({
          schoolId,
          groupId: 'group-1',
          levelId: 'level-1',
          scheduledDate: '2026-01-05',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
    });

    it('creates a session when none exists for the group on the date', async () => {
      prisma.attendanceSession.findFirst.mockResolvedValue(null);
      prisma.attendanceSession.create.mockResolvedValue({ id: 'sess-1', groupId: 'group-1' });
      prisma.student.findMany.mockResolvedValue([]);

      const result = await service.createSession({
        schoolId,
        groupId: 'group-1',
        levelId: 'level-1',
        scheduledDate: '2026-01-05',
      } as any);

      expect(result.id).toBe('sess-1');
      expect(prisma.attendanceSession.create).toHaveBeenCalled();
    });
  });
});
