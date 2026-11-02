import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../database/prisma.service';
import { AnalyticsBatchDto } from './dto/analytics-batch.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  const prismaMock = {
    appSession: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    analyticsEvent: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    // Both record() and recordBatch() derive schoolId from userId when it
    // isn't passed explicitly, and skip entirely (no writes at all) if no
    // schoolId can be resolved — a multi-tenancy safety guard.
    user: { findUnique: jest.fn() },
    school: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService);
    prisma.user.findUnique.mockResolvedValue({ schoolId: 'school-1' });
    prisma.school.findFirst.mockResolvedValue({ id: 'school-1' });
    prisma.appSession.findUnique.mockResolvedValue(null);
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
    const caller = { id: 'u1', schoolId: 'school-1' };

    it('upserts a session and bulk-inserts events', async () => {
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date('2026-01-01') });
      prisma.analyticsEvent.createMany.mockResolvedValue({ count: 1 });

      await service.recordBatch(
        {
          sessionId: 's1',
          locale: 'ar',
          actionCount: 1,
          events: [{ name: 'locale.set', category: 'locale', properties: { locale: 'ar' } }],
        },
        caller,
      );

      expect(prisma.appSession.upsert).toHaveBeenCalledWith({
        where: { id: 's1' },
        create: expect.objectContaining({ id: 's1', userId: 'u1', schoolId: 'school-1', locale: 'ar' }),
        update: expect.objectContaining({ lastActiveAt: expect.any(Date), actionCount: { increment: 1 } }),
      });
      expect(prisma.analyticsEvent.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ sessionId: 's1', userId: 'u1', name: 'locale.set', category: 'locale', locale: 'ar' }),
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
      await service.recordBatch({ sessionId: 's1', end: true, events: [{ name: 'session.end', category: 'session' }] }, caller);
      jest.useRealTimers();

      expect(prisma.appSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: expect.objectContaining({ endedAt: expect.any(Date), durationSec: 10 }),
      });
    });

    it('ignores a userId and schoolId in the body when the caller is signed in', async () => {
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date() });
      await service.recordBatch(
        { sessionId: 's1', userId: 'victim', schoolId: 'other-school', events: [{ name: 'x' }] },
        caller,
      );
      expect(prisma.school.findFirst).not.toHaveBeenCalled();
      expect(prisma.appSession.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ userId: 'u1', schoolId: 'school-1' }) }),
      );
      expect(prisma.analyticsEvent.createMany.mock.calls[0][0].data[0]).toEqual(
        expect.objectContaining({ userId: 'u1', schoolId: 'school-1' }),
      );
    });

    it('records an anonymous caller with no user, whatever userId the body claims', async () => {
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date() });
      await service.recordBatch({ sessionId: 's1', userId: 'victim', schoolId: 'school-1', events: [{ name: 'x' }] }, null);
      expect(prisma.appSession.upsert.mock.calls[0][0].create.userId).toBeUndefined();
      expect(prisma.analyticsEvent.createMany.mock.calls[0][0].data[0].userId).toBeUndefined();
    });

    it('does not attribute demo guests to a user', async () => {
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date() });
      await service.recordBatch({ sessionId: 's1', events: [] }, { id: 'demo-guest', schoolId: 'school-1', isDemo: true });
      expect(prisma.appSession.upsert.mock.calls[0][0].create.userId).toBeUndefined();
    });

    it('answers an unknown school with 400, not a database error', async () => {
      prisma.school.findFirst.mockResolvedValue(null);
      await expect(service.recordBatch({ sessionId: 's1', schoolId: 'nope', events: [] }, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.appSession.upsert).not.toHaveBeenCalled();
    });

    it('resolves a school slug for anonymous callers', async () => {
      prisma.school.findFirst.mockResolvedValue({ id: 'school-9' });
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date() });
      await service.recordBatch({ sessionId: 's1', schoolId: 'niangelos-main', events: [] }, null);
      expect(prisma.appSession.upsert.mock.calls[0][0].create.schoolId).toBe('school-9');
    });

    it('skips an anonymous batch that names no school', async () => {
      await service.recordBatch({ sessionId: 's1', events: [{ name: 'x' }] }, null);
      expect(prisma.appSession.upsert).not.toHaveBeenCalled();
    });

    it('fills in the user of a session that began anonymous, from the token only', async () => {
      prisma.appSession.findUnique.mockResolvedValue({ schoolId: 'school-1', userId: null });
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date() });
      await service.recordBatch({ sessionId: 's1', userId: 'victim', events: [] }, caller);
      expect(prisma.appSession.upsert.mock.calls[0][0].update.userId).toBe('u1');
    });

    it('does not give an anonymous session a user when the caller is anonymous too', async () => {
      prisma.appSession.findUnique.mockResolvedValue({ schoolId: 'school-1', userId: null });
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date() });
      await service.recordBatch({ sessionId: 's1', userId: 'victim', schoolId: 'school-1', events: [] }, null);
      expect(prisma.appSession.upsert.mock.calls[0][0].update).not.toHaveProperty('userId');
    });

    it('never changes the user of an existing session', async () => {
      prisma.appSession.findUnique.mockResolvedValue({ schoolId: 'school-1', userId: 'someone-else' });
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date() });
      await service.recordBatch({ sessionId: 's1', userId: 'victim', events: [] }, caller);
      expect(prisma.appSession.upsert.mock.calls[0][0].update).not.toHaveProperty('userId');
    });

    it('leaves a session from another school alone', async () => {
      prisma.appSession.findUnique.mockResolvedValue({ schoolId: 'other-school' });
      await service.recordBatch({ sessionId: 's1', events: [{ name: 'x' }] }, caller);
      expect(prisma.appSession.upsert).not.toHaveBeenCalled();
      expect(prisma.analyticsEvent.createMany).not.toHaveBeenCalled();
    });

    it('stores at most 50 events and drops properties over 2 KB', async () => {
      prisma.appSession.upsert.mockResolvedValue({ id: 's1', startedAt: new Date() });
      const events = Array.from({ length: 80 }, (_, i) => ({
        name: `e${i}`,
        properties: i === 0 ? { blob: 'x'.repeat(5000) } : { i },
      }));
      await service.recordBatch({ sessionId: 's1', events }, caller);
      const data = prisma.analyticsEvent.createMany.mock.calls[0][0].data;
      expect(data).toHaveLength(50);
      expect(data[0].properties).toBeUndefined();
      expect(data[1].properties).toEqual({ i: 1 });
    });
  });

  describe('AnalyticsBatchDto', () => {
    const check = (body: object) => validate(plainToInstance(AnalyticsBatchDto, body));
    const event = { name: 'a', properties: { k: 1 } };

    it('accepts a normal batch', async () => {
      expect(await check({ sessionId: 's1', events: [event] })).toHaveLength(0);
    });

    it('accepts exactly 50 events and rejects 51', async () => {
      expect(await check({ sessionId: 's1', events: Array(50).fill(event) })).toHaveLength(0);
      expect((await check({ sessionId: 's1', events: Array(51).fill(event) })).length).toBeGreaterThan(0);
    });

    it('rejects properties larger than 2 KB', async () => {
      const errors = await check({ sessionId: 's1', events: [{ name: 'a', properties: { blob: 'x'.repeat(3000) } }] });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('truncates every free-text field instead of storing it whole', () => {
      const dto = plainToInstance(AnalyticsBatchDto, {
        sessionId: 's'.repeat(500),
        schoolId: 's'.repeat(500),
        locale: 'l'.repeat(500),
        entryPage: 'p'.repeat(5000),
        userAgent: 'u'.repeat(5000),
        events: [{ name: 'n'.repeat(500), category: 'c'.repeat(500) }],
      });
      expect(dto.sessionId).toHaveLength(64);
      expect(dto.schoolId).toHaveLength(64);
      expect(dto.locale).toHaveLength(16);
      expect(dto.entryPage).toHaveLength(255);
      expect(dto.userAgent).toHaveLength(255);
      expect(dto.events[0].name).toHaveLength(100);
      expect(dto.events[0].category).toHaveLength(50);
    });
  });

  describe('OptionalJwtAuthGuard', () => {
    const guard = new OptionalJwtAuthGuard();
    it('lets a request with no valid token through as anonymous', () => {
      expect(guard.handleRequest(null, false)).toBeNull();
      expect(guard.handleRequest(new Error('Cross-site request blocked'), undefined)).toBeNull();
    });
    it('passes the authenticated user through', () => {
      expect(guard.handleRequest(null, { id: 'u1' })).toEqual({ id: 'u1' });
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