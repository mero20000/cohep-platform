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
import { AssessmentsService } from '../assessments/assessments.service';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';

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
      updateMany: jest.fn(),
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
    group: {
      findUnique: jest.fn(),
    },
    subjectItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    curriculumAllocation: {
      findFirst: jest.fn(),
    },
    assessment: {
      findFirst: jest.fn(),
    },
    assessmentQuestion: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    schoolGrade: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const assessmentsMock = { create: jest.fn() };

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
        { provide: AssessmentsService, useValue: assessmentsMock },
        { provide: WhatsAppService, useValue: { sendText: jest.fn().mockResolvedValue({ sent: false }) } },
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

    it('seeds the roster as unmarked (never pre-marks present)', async () => {
      prisma.student.findMany.mockResolvedValue([{ id: 'stu-1' }]);

      await service.startClass('u1');

      expect(prisma.attendanceRecord.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ studentId: 'stu-1', status: 'unmarked' }),
        ]),
      });
      const statuses = prisma.attendanceRecord.createMany.mock.calls[0][0].data.map((r: any) => r.status);
      expect(statuses).not.toContain('present');
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

  describe('markSubjectItemStatus', () => {
    const buildSession = (overrides: any = {}) => ({
      id: 'sess-1',
      schoolId,
      servantId: 'u1',
      groupId: 'group-1',
      levelId: 'level-1',
      scheduledDate: new Date('2026-01-05T10:00:00.000Z'),
      subjectItemId: null,
      ...overrides,
    });

    const subjectItem = {
      id: 'si-1',
      name: 'The Trinity',
      subjectId: 'subj-1',
      sessionsGroup1: 3,
      sessionsGroup2: 0,
      sessionsGroup3: 0,
      sessionsGroup4: 0,
    };

    beforeEach(() => {
      prisma.attendanceSession.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(buildSession(where.subjectItemId ? { subjectItemId: where.subjectItemId } : {})),
      );
      prisma.attendanceSession.update.mockImplementation(({ data }: any) => {
        const s = buildSession();
        if (data.subjectItemId) s.subjectItemId = data.subjectItemId;
        return Promise.resolve(s);
      });
      prisma.subjectItem.findUnique.mockResolvedValue(subjectItem);
      prisma.subjectItem.update.mockResolvedValue({ ...subjectItem, status: 'completed' });
      prisma.group.findUnique.mockResolvedValue({ id: 'group-1' });
      prisma.curriculumAllocation.findFirst.mockResolvedValue({ groupNumber: 1, lesson: { subjectItemId: 'si-1' } });
      prisma.attendanceSession.count.mockResolvedValue(1);
      prisma.assessment.findFirst.mockResolvedValue(null);
      prisma.assessmentQuestion.findMany.mockResolvedValue([]);
      prisma.assessmentQuestion.count.mockResolvedValue(0);
      assessmentsMock.create.mockResolvedValue({ id: 'ass-1', title: 'Assessment: The Trinity', status: 'draft' });
    });

    it('marks the linked subject item in_progress without creating an assessment', async () => {
      await service.markSubjectItemStatus('sess-1', 'in_progress');
      expect(prisma.subjectItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'in_progress' } }),
      );
      expect(assessmentsMock.create).not.toHaveBeenCalled();
    });

    it('resets the subject item status back to allocated (no assessment, no sessions math)', async () => {
      const result = await service.markSubjectItemStatus('sess-1', 'allocated');
      expect(result.status).toBe('allocated');
      expect(prisma.subjectItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'allocated' } }),
      );
      expect(assessmentsMock.create).not.toHaveBeenCalled();
      expect(result.sessionsUsed).toBeNull();
      expect(result.plannedSessions).toBeNull();
    });

    it('on completed creates a draft assessment and reports sessions used vs planned', async () => {
      const result = await service.markSubjectItemStatus('sess-1', 'completed');
      expect(result.status).toBe('completed');
      expect(result.subjectItemId).toBe('si-1');
      expect(result.plannedSessions).toBe(3);
      expect(result.sessionsUsed).toBe(2); // existing 1 + the one just completed
      expect(assessmentsMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Assessment: The Trinity',
          status: 'draft',
          groupId: 'group-1',
          subjectId: 'subj-1',
        }),
        schoolId,
      );
    });

    it('on completed twice reuses the same draft instead of creating duplicates', async () => {
      prisma.assessment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'ass-1', title: 'Assessment: The Trinity', status: 'draft' });
      await service.markSubjectItemStatus('sess-1', 'completed');
      await service.markSubjectItemStatus('sess-1', 'completed');
      expect(assessmentsMock.create).toHaveBeenCalledTimes(1);
    });

    it('completed response flags actionRequired when draft has no questions', async () => {
      prisma.assessmentQuestion.findMany.mockResolvedValue([]);
      prisma.assessmentQuestion.count.mockResolvedValue(0);
      const result = await service.markSubjectItemStatus('sess-1', 'completed');
      expect(result.assessment.actionRequired).toBe('add-questions-then-publish');
      expect(result.assessment.publishUrl).toBe('/dashboard/assessments/ass-1');
    });

    it('rejects an unknown subject item link', async () => {
      prisma.subjectItem.findUnique.mockImplementation(({ where }: any) =>
        where.id === 'si-bad' ? Promise.resolve(null) : Promise.resolve(subjectItem),
      );
      await expect(
        service.markSubjectItemStatus('sess-1', 'in_progress', 'si-bad'),
      ).rejects.toThrow();
    });
  });

  describe('getSessions (servant scope)', () => {
    const captureWhere = async (meta: any, gradeGroups: any[] = [{ groupId: 'G1' }]) => {
      prisma.user.findUnique.mockResolvedValue({
        metadata: meta,
        userRoles: [{ role: { name: 'servant' } }],
      });
      prisma.schoolGrade.findMany.mockResolvedValue(gradeGroups);
      let captured: any;
      prisma.attendanceSession.findMany.mockImplementation((args: any) => {
        captured = args;
        return Promise.resolve([]);
      });
      prisma.attendanceSession.count.mockResolvedValue(0);
      await service.getSessions(schoolId, {}, { id: 'u1' });
      return captured.where;
    };

    it('scopes a servant to the assigned group (+ level, + grade) instead of servantId', async () => {
      const where = await captureWhere({ groupId: 'G1', levelId: 'L1', gradeId: 'GR1' });
      expect(where.servantId).toBeUndefined();
      expect(where.groupId).toEqual({ in: ['G1'] });
      expect(where.levelId).toEqual('L1');
    });

    it('falls back to own sessions when no assignment is set', async () => {
      const where = await captureWhere({});
      expect(where.servantId).toBe('u1');
      expect(where.groupId).toBeUndefined();
    });

    it('resolves grade to its group IDs when no explicit group is assigned', async () => {
      const where = await captureWhere({ gradeId: 'GR1' }, [{ groupId: 'G2' }, { groupId: 'G3' }]);
      expect(where.servantId).toBeUndefined();
      expect(where.groupId).toEqual({ in: ['G2', 'G3'] });
    });
  });

  describe('findSuspectAutoSeeds', () => {
    const seedTime = new Date('2026-09-01T10:00:00.000Z');
    const autoRec = (over = {}) => ({
      status: 'present',
      behavior: null,
      participation: null,
      note: null,
      attendedLiturgy: false,
      recordedAt: new Date(seedTime.getTime() + 60 * 1000),
      ...over,
    });
    const sess = (over = {}) => ({
      id: 'sess-1',
      scheduledDate: seedTime,
      createdAt: seedTime,
      status: 'completed',
      level: { name: 'Level 1' },
      group: { name: 'Group A' },
      servant: { id: 'u1', firstName: 'George', lastName: 'R' },
      attendanceRecords: [autoRec(), autoRec()],
      ...over,
    });

    it('flags all-present unenriched sessions with seed-time match', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([sess()]);

      const result = await service.findSuspectAutoSeeds(schoolId, {});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'sess-1',
        totalRecords: 2,
        presentRecords: 2,
        unenrichedPresents: 2,
        seedTimeMatch: true,
        suspect: true,
      });
    });

    it('flags auto-seed-like records under soft-deleted sessions too', async () => {
      const seedTime = new Date('2026-09-01T10:00:00.000Z');
      prisma.attendanceSession.findMany.mockResolvedValue([
        sess({
          id: 'ghost',
          deletedAt: seedTime,
          attendanceRecords: [autoRec(), autoRec()],
        }),
      ]);

      const result = await service.findSuspectAutoSeeds(schoolId, {});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'ghost', deletedAt: seedTime, suspect: true });
    });

    it('ignores sessions with mixed statuses or enriched records', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([
        sess({ id: 'mixed', attendanceRecords: [autoRec(), autoRec({ status: 'absent' })] }),
        sess({ id: 'enriched', attendanceRecords: [autoRec(), autoRec({ behavior: 4, note: 'late bus' })] }),
        sess({ id: 'empty', attendanceRecords: [] }),
      ]);

      const result = await service.findSuspectAutoSeeds(schoolId, {});

      expect(result).toHaveLength(0);
    });

    it('scopes by school and caps the scan window', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);

      await service.findSuspectAutoSeeds(schoolId, { from: '2026-08-01', to: '2026-09-01', limit: 50 });

      const where = prisma.attendanceSession.findMany.mock.calls[0][0].where;
      expect(where.schoolId).toBe(schoolId);
      expect(where.scheduledDate.gte).toEqual(new Date('2026-08-01'));
      expect(where.scheduledDate.lte).toEqual(new Date('2026-09-01'));
      expect(prisma.attendanceSession.findMany.mock.calls[0][0].take).toBe(50);
    });

    it('dry-runs by default: reports suspects without writing', async () => {
      const seedTime = new Date('2026-09-01T10:00:00.000Z');
      prisma.attendanceSession.findMany.mockResolvedValue([
        {
          id: 'sess-1', scheduledDate: seedTime, createdAt: seedTime, status: 'completed',
          level: { name: 'L' }, group: { name: 'G' }, servant: { id: 'u1', firstName: 'A', lastName: 'B' },
          attendanceRecords: [
            { status: 'present', behavior: null, participation: null, note: null, attendedLiturgy: false, recordedAt: seedTime },
          ],
        },
      ]);

      const result = await service.resetSuspectAutoSeeds(schoolId, {});

      expect(result.dryRun).toBe(true);
      expect(result.sessionCount).toBe(1);
      expect(result.recordsReset).toBe(0);
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled();
    });

    it('resets only unenriched presents on flagged sessions when confirmed', async () => {
      const seedTime = new Date('2026-09-01T10:00:00.000Z');
      prisma.attendanceSession.findMany.mockResolvedValue([
        {
          id: 'sess-1', scheduledDate: seedTime, createdAt: seedTime, status: 'completed',
          level: { name: 'L' }, group: { name: 'G' }, servant: { id: 'u1', firstName: 'A', lastName: 'B' },
          attendanceRecords: [
            { status: 'present', behavior: null, participation: null, note: null, attendedLiturgy: false, recordedAt: seedTime },
          ],
        },
      ]);
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resetSuspectAutoSeeds(schoolId, { dryRun: false, confirm: true });

      expect(result.dryRun).toBe(false);
      expect(result.recordsReset).toBe(1);
      const args = prisma.attendanceRecord.updateMany.mock.calls[0][0];
      expect(args.where.attendanceSessionId).toEqual({ in: ['sess-1'] });
      expect(args.where.status).toBe('present');
      expect(args.data).toEqual({ status: 'unmarked' });
    });

    it('requires both flags: confirm alone still dry-runs', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);

      const result = await service.resetSuspectAutoSeeds(schoolId, { confirm: true } as any);

      expect(result.dryRun).toBe(true);
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled();
    });
  });
});
