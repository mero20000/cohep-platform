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
    level: {
      findFirst: jest.fn(),
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

    it('sorts sessions ascending by scheduled date', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.count.mockResolvedValue(0);

      await service.getSessions(schoolId, {});

      expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { scheduledDate: 'asc' } }),
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

  describe('startClass', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        schoolId,
        metadata: { groupId: 'group-1', levelId: 'level-1' },
      });
      prisma.attendanceSession.findFirst.mockResolvedValue(null);
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'sess-1', ...data }),
      );
      prisma.attendanceSession.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve({
          id: where.id,
          levelId: 'level-1',
          groupId: 'group-1',
          attendanceRecords: [],
        }),
      );
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 0 });
    });

    it('records actualStartTime when creating an in_progress session', async () => {
      await service.startClass('u1');

      const data = prisma.attendanceSession.create.mock.calls[0][0].data;
      expect(data.status).toBe('in_progress');
      expect(data.actualStartTime).toBeInstanceOf(Date);
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

  describe('updateSession', () => {
    let storedSession: any;

    const baseSession = {
      id: 'sess-1',
      schoolId,
      servantId: 'u1',
      groupId: 'group-1',
      levelId: 'level-1',
      status: 'in_progress',
      actualStartTime: null,
      actualEndTime: null,
    };

    beforeEach(() => {
      storedSession = { ...baseSession };
      prisma.attendanceSession.findUnique.mockImplementation(() =>
        Promise.resolve(storedSession),
      );
      prisma.attendanceSession.update.mockImplementation(({ data }: any) => {
        storedSession = { ...storedSession, ...data };
        return Promise.resolve(storedSession);
      });
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 0 });
    });

    it('records actualEndTime when status becomes completed', async () => {
      await service.updateSession('sess-1', { status: 'completed' } as any);

      const data = prisma.attendanceSession.update.mock.calls[0][0].data;
      expect(data.status).toBe('completed');
      expect(data.actualEndTime).toBeInstanceOf(Date);
    });

    it('records actualStartTime when status becomes in_progress and it is null', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({
        ...baseSession,
        status: 'scheduled',
      });

      await service.updateSession('sess-1', { status: 'in_progress' } as any);

      const data = prisma.attendanceSession.update.mock.calls[0][0].data;
      expect(data.actualStartTime).toBeInstanceOf(Date);
    });

    it('re-syncs students when groupId changes', async () => {
      prisma.student.findMany.mockResolvedValue([{ id: 'st1' }, { id: 'st2' }]);

      await service.updateSession('sess-1', { groupId: 'group-2' } as any);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ groupId: 'group-2' }) }),
      );
    });

    it('does NOT re-sync students when neither status nor group changes', async () => {
      await service.updateSession('sess-1', { notes: 'just a note' } as any);

      expect(prisma.student.findMany).not.toHaveBeenCalled();
    });

    it('does NOT overwrite actualStartTime when already set', async () => {
      const started = new Date('2026-01-01T00:00:00.000Z');
      storedSession = { ...baseSession, status: 'in_progress', actualStartTime: started };

      await service.updateSession('sess-1', { status: 'in_progress' } as any);

      const data = prisma.attendanceSession.update.mock.calls[0][0].data;
      expect(data.actualStartTime).toBeUndefined();
      expect(storedSession.actualStartTime).toBe(started);
    });
  });
});
