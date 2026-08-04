import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../database/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  const prismaMock = {
    appSession: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    analyticsEvent: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService);
  });

  describe('record', () => {
    it('creates an analytics event', async () => {
      prisma.analyticsEvent.create.mockResolvedValue({ id: 'e1' });
      await service.record({ name: 'attendance.marked', category: 'activation', userId: 'u1', properties: { count: 3 } });
      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'attendance.marked',
          category: 'activation',
          userId: 'u1',
          properties: { count: 3 },
        }),
      });
    });

    it('swallows persistence errors so analytics never breaks app flows', async () => {
      prisma.analyticsEvent.create.mockRejectedValue(new Error('db down'));
      await expect(service.record({ name: 'x' })).resolves.toBeUndefined();
    });
  });

  describe('recordBatch', () => {
    it('upserts a session and bulk-inserts events', async () => {
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date('2026-01-01') });
      prisma.analyticsEvent.createMany.mockResolvedValue({ count: 1 });

      await service.recordBatch({
        sessionId: 's1',
        userId: 'u1',
        locale: 'ar',
        actionCount: 1,
        events: [{ name: 'locale.set', category: 'locale', properties: { locale: 'ar' } }],
      });

      expect(prisma.appSession.upsert).toHaveBeenCalledWith({
        where: { id: 's1' },
        create: expect.objectContaining({ id: 's1', userId: 'u1', locale: 'ar' }),
        update: expect.objectContaining({ lastActiveAt: expect.any(Date), actionCount: { increment: 1 } }),
      });
      expect(prisma.analyticsEvent.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ sessionId: 's1', name: 'locale.set', category: 'locale', locale: 'ar' }),
        ]),
      });
    });

    it('recomputes duration from the real session start when ending', async () => {
      const startedAt = new Date('2026-01-01T00:00:00Z');
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt });
      prisma.analyticsEvent.createMany.mockResolvedValue({ count: 1 });
      prisma.appSession.update.mockResolvedValue({});

      // ending 10s later
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10Z'));
      await service.recordBatch({ sessionId: 's1', end: true, events: [{ name: 'session.end', category: 'session' }] });
      jest.useRealTimers();

      expect(prisma.appSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: expect.objectContaining({ endedAt: expect.any(Date), durationSec: 10 }),
      });
    });
  });

  describe('getMetrics', () => {
    it('computes the four KPIs from the aggregation rows', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ sessions: 40, active_users: 10, avg_length_sec: 900, actions_per_session: 4 }])
        .mockResolvedValueOnce([{ cur: 5, prev: 2 }])
        .mockResolvedValueOnce([{ recruits: 20, activated: 6 }])
        .mockResolvedValueOnce([{ ar_sessions: 8, ar_completed: 4 }]);

      const m = await service.getMetrics();

      expect(m.sessions30d).toBe(40);
      expect(m.avgSessionLengthSec).toBe(900); // C1
      expect(m.actionsPerSession).toBe(4);      // C4
      expect(m.settingsCompletionDelta).toBe(3); // C1 (5 − 2)
      expect(m.activationRate7d).toBeCloseTo(0.3); // C2 (6/20)
      expect(m.arLocaleCompletionRate).toBeCloseTo(0.5); // C3 (4/8)
    });

    it('returns zero rates when there is no data', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ sessions: 0, active_users: 0, avg_length_sec: 0, actions_per_session: 0 }])
        .mockResolvedValueOnce([{ cur: 0, prev: 0 }])
        .mockResolvedValueOnce([{ recruits: 0, activated: 0 }])
        .mockResolvedValueOnce([{ ar_sessions: 0, ar_completed: 0 }]);

      const m = await service.getMetrics();
      expect(m.activationRate7d).toBe(0);
      expect(m.arLocaleCompletionRate).toBe(0);
      expect(m.actionsPerSession).toBe(0);
    });
  });
});