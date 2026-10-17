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
      updateMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    attendanceRecord: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
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
      findMany: jest.fn(),
    },
    group: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
    userRole: {
      findMany: jest.fn(),
    },
    attendanceSessionTarget: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
  };

  const assessmentsMock = { create: jest.fn() };
  const notificationsMock = { createNotification: jest.fn().mockResolvedValue(undefined) };
  const whatsappMock = { sendText: jest.fn().mockResolvedValue({ sent: false }) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: GamificationService, useValue: { computeBadgesForStudent: jest.fn().mockResolvedValue(undefined), awardAttendanceXp: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: MailService, useValue: { sendAttendanceAlert: jest.fn() } },
        { provide: AnalyticsService, useValue: { record: jest.fn() } },
        { provide: AssessmentsService, useValue: assessmentsMock },
        { provide: WhatsAppService, useValue: whatsappMock },
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

    it('sorts sessions descending by scheduled date', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.count.mockResolvedValue(0);

      await service.getSessions(schoolId, {});

      expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { scheduledDate: 'desc' } }),
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
      prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'servant' } }]);
    });

    it('creates a scheduled session without actualStartTime when starting class', async () => {
      await service.startClass('u1');

      const data = prisma.attendanceSession.create.mock.calls[0][0].data;
      expect(data.status).toBe('scheduled');
      expect(data.actualStartTime).toBeUndefined();
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
    it('throws when a session already exists for the group on the date with same filters', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([{ id: 'existing', metadata: null }]);

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

    it('allows a second session for the same group+date when filters differ', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([{ id: 'existing', metadata: { genderFilter: 'male' } }]);
      prisma.attendanceSession.create.mockResolvedValue({ id: 'sess-2', groupId: 'group-1' });
      prisma.student.findMany.mockResolvedValue([]);

      const result = await service.createSession({
        schoolId,
        groupId: 'group-1',
        levelId: 'level-1',
        scheduledDate: '2026-01-05',
        gender: 'female',
      } as any);

      expect(result.id).toBe('sess-2');
      expect(prisma.attendanceSession.create).toHaveBeenCalled();
    });

    it('creates a session when none exists for the group on the date', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);
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

    it('on completed skips the draft assessment for non-assessment items', async () => {
      prisma.subjectItem.findUnique.mockResolvedValue({ ...subjectItem, isAssessmentItem: false });
      const result = await service.markSubjectItemStatus('sess-1', 'completed');
      expect(result.status).toBe('completed');
      expect(result.assessment).toBeUndefined();
      expect(assessmentsMock.create).not.toHaveBeenCalled();
      expect(result.sessionsUsed).toBe(2);
      expect(result.plannedSessions).toBe(3);
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
      expect(where.groupId).toBeUndefined();
      // group scope matches the session's own group OR any of its audience rows
      expect(where.AND).toContainEqual({ OR: [{ groupId: { in: ['G1'] } }, { targets: { some: { groupId: { in: ['G1'] } } } }] });
      expect(where.levelId).toEqual('L1');
    });

    it('falls back to own sessions when no assignment is set', async () => {
      const where = await captureWhere({});
      expect(where.servantId).toBe('u1');
      expect(where.groupId).toBeUndefined();
      expect(where.AND).toBeUndefined();
    });

    it('resolves grade to its group IDs when no explicit group is assigned', async () => {
      const where = await captureWhere({ gradeId: 'GR1' }, [{ groupId: 'G2' }, { groupId: 'G3' }]);
      expect(where.servantId).toBeUndefined();
      expect(where.AND).toContainEqual({ OR: [{ groupId: { in: ['G2', 'G3'] } }, { targets: { some: { groupId: { in: ['G2', 'G3'] } } } }] });
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

  describe('completed-session write guard and finalize', () => {
    const open = { id: 'sess-1', schoolId, servantId: 'u1', groupId: 'g1', levelId: 'l1', status: 'in_progress', actualStartTime: new Date(), deletedAt: null, metadata: null };
    const dto = { recordedBy: 'u1', records: [{ studentId: 's1', status: 'present' }] } as any;

    beforeEach(() => {
      prisma.student.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      prisma.user.findUnique.mockResolvedValue({ metadata: {} });
      prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 0 });
      prisma.attendanceRecord.upsert.mockReturnValue('upsert-op');
      prisma.attendanceSession.updateMany.mockReturnValue('complete-op');
      prisma.$transaction.mockResolvedValue([]);
      jest.spyOn(service, 'getSessionById').mockResolvedValue({ id: 'sess-1' } as any);
    });

    it('markAttendance rejects completed sessions', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ ...open, status: 'completed' });
      await expect(service.markAttendance('sess-1', dto)).rejects.toThrow(/read-only/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('batchUpdateRecords rejects completed sessions', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ ...open, status: 'completed' });
      await expect(service.batchUpdateRecords('sess-1', [{ studentId: 's1', status: 'absent' }])).rejects.toThrow(/read-only/);
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
    });

    it('finalizeSession rejects an already completed session', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ ...open, status: 'completed' });
      await expect(service.finalizeSession('sess-1', dto)).rejects.toThrow(/read-only/);
    });

    it('finalizeSession rejects when students remain unmarked', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(open);
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([]) // syncSessionStudents existing ids
        .mockResolvedValueOnce([{ studentId: 's1', status: 'unmarked' }, { studentId: 's2', status: 'unmarked' }]);
      await expect(service.finalizeSession('sess-1', dto)).rejects.toThrow(/1 student\(s\) are still unmarked/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('finalizeSession rejects an empty roster', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(open);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      await expect(service.finalizeSession('sess-1', { recordedBy: 'u1', records: [] } as any)).rejects.toThrow(/no students/);
    });

    it('finalizeSession writes records and completes the session in ONE transaction', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(open);
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ studentId: 's1', status: 'unmarked' }, { studentId: 's2', status: 'absent' }])
        .mockResolvedValue([]);
      await service.finalizeSession('sess-1', dto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toEqual(['upsert-op', 'complete-op']);
      const completion = prisma.attendanceSession.updateMany.mock.calls[0][0];
      expect(completion.where).toEqual({ id: 'sess-1', status: { not: 'completed' } });
      expect(completion.data.status).toBe('completed');
      expect(completion.data.actualEndTime).toBeInstanceOf(Date);
    });

    it('finalizeSession allows unmarked students when allowUnmarked is set', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(open);
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ studentId: 's2', status: 'unmarked' }])
        .mockResolvedValue([]);
      await service.finalizeSession('sess-1', { ...dto, allowUnmarked: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('markAttendance persists an explicit unmarked status and null note', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(open);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      await service.markAttendance('sess-1', { recordedBy: 'u1', records: [{ studentId: 's1', status: 'unmarked', note: null }] } as any);
      const args = prisma.attendanceRecord.upsert.mock.calls[0][0];
      expect(args.update.status).toBe('unmarked');
      expect(args.update.note).toBeNull();
    });
  });

  describe('markSubjectPassed WhatsApp fallback link', () => {
    it('keeps the digits of the parent phone in the wa.me link', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ id: 'sess-1', subjectItemId: 'si-1', levelId: null, groupId: 'g1', scheduledDate: new Date() });
      prisma.subjectItem.findUnique.mockResolvedValue({ id: 'si-1', name: 'Creed' });
      prisma.student.findFirst = jest.fn().mockResolvedValue({ id: 's1', firstName: 'Mina', firstNameAr: null, metadata: { parentPhone: '+20 100-123-4567' } });
      (prisma as any).studentSubjectPass = { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() };
      prisma.group.findUnique.mockResolvedValue({ id: 'g1' });
      const res = await service.markSubjectPassed('sess-1', 's1', 'u1');
      expect(res.whatsappLink).toMatch(/^https:\/\/wa\.me\/201001234567\?text=/);
    });
  });

  describe('insights stats (aggregated, consistent definition)', () => {
    const tallies = [
      { attendanceSessionId: 's1', status: 'present', _count: { _all: 6 } },
      { attendanceSessionId: 's1', status: 'absent', _count: { _all: 2 } },
      { attendanceSessionId: 's1', status: 'excused', _count: { _all: 1 } },
      { attendanceSessionId: 's1', status: 'unmarked', _count: { _all: 3 } },
      { attendanceSessionId: 's2', status: 'late', _count: { _all: 2 } },
      { attendanceSessionId: 's2', status: 'absent', _count: { _all: 2 } },
    ];

    beforeEach(() => {
      prisma.level.findMany.mockResolvedValue([{ id: 'l1', number: 1, name: 'Level 1' }]);
      prisma.group.findMany.mockResolvedValue([{ id: 'g1', name: 'Group A' }]);
      // s1 has a level, s2 is a level-less session
      prisma.attendanceSession.findMany.mockResolvedValue([
        { id: 's1', levelId: 'l1', groupId: 'g1' },
        { id: 's2', levelId: null, groupId: 'g1' },
      ]);
      prisma.attendanceRecord.groupBy.mockResolvedValue(tallies);
      prisma.attendanceSession.groupBy.mockResolvedValue([
        { status: 'completed', _count: { _all: 2 } },
        { status: 'scheduled', _count: { _all: 3 } },
      ]);
    });

    it('rates exclude unmarked and excused, and level-less sessions are included', async () => {
      const stats = await service.getSessionStats('school-1');
      expect(stats.presentCount).toBe(6);
      expect(stats.lateCount).toBe(2);
      expect(stats.absentCount).toBe(4);
      expect(stats.excusedCount).toBe(1);
      expect(stats.unmarkedCount).toBe(3);
      expect(stats.totalRecords).toBe(13); // marked rows only
      expect(stats.averageAttendanceRate).toBe(66.67); // (6+2)/(6+2+4)
      expect(stats.totalSessions).toBe(5);
      expect(stats.completedSessions).toBe(2);
      expect(stats.scheduledSessions).toBe(3);
    });

    it('uses GROUP BY aggregation instead of loading records', async () => {
      await service.getSessionStats('school-1');
      expect(prisma.attendanceRecord.groupBy).toHaveBeenCalled();
      expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled();
    });

    it('level stats add a "no level" bucket for level-less sessions', async () => {
      const stats = await service.getLevelStats('school-1');
      expect(stats).toHaveLength(2);
      expect(stats[0]).toMatchObject({ levelId: 'l1', levelNumber: 1, totalSessions: 1, attendanceRate: 75 }); // 6/(6+2)
      expect(stats[1]).toMatchObject({ levelId: null, levelNumber: null, totalSessions: 1, attendanceRate: 50 }); // 2/(2+2)
    });

    it('group stats report the levels each group actually ran', async () => {
      const stats = await service.getGroupStats('school-1');
      expect(stats).toHaveLength(1);
      expect(stats[0]).toMatchObject({ groupId: 'g1', groupName: 'Group A', totalSessions: 2, levels: [{ number: 1, name: 'Level 1' }] });
      expect(stats[0].attendanceRate).toBe(66.67);
    });
  });

  describe('parent notifications are not repeated', () => {
    const openSession = { id: 'sess-1', schoolId, servantId: 'u1', groupId: 'g1', levelId: 'l1', status: 'in_progress', actualStartTime: new Date(), deletedAt: null, metadata: null };

    beforeEach(() => {
      prisma.attendanceSession.findUnique.mockResolvedValue(openSession);
      prisma.student.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.user.findUnique.mockResolvedValue({ metadata: {} });
      prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 0 });
      prisma.attendanceRecord.upsert.mockReturnValue('op');
      prisma.$transaction.mockResolvedValue([]);
      jest.spyOn(service, 'getSessionById').mockResolvedValue({ id: 'sess-1' } as any);
    });

    const markAbsent = () => service.markAttendance('sess-1', { recordedBy: 'u1', records: [{ studentId: 's1', status: 'absent' }] } as any);

    it('runs the absence check when a student newly becomes absent', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([{ studentId: 's1', status: 'present' }]);
      const cascade = jest.spyOn(service as any, 'checkAbsenceCascade').mockResolvedValue(undefined);
      await markAbsent();
      expect(cascade).toHaveBeenCalledWith('s1', schoolId, 'u1');
    });

    it('does NOT re-run it when the record was already absent', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([{ studentId: 's1', status: 'absent' }]);
      const cascade = jest.spyOn(service as any, 'checkAbsenceCascade').mockResolvedValue(undefined);
      await markAbsent();
      expect(cascade).not.toHaveBeenCalled();
    });

    const record = (status: string) => ({
      status,
      student: { firstName: 'Mina', lastName: 'G', firstNameAr: null, lastNameAr: null, parentEmail: null },
    });

    it('alerts once when the streak reaches exactly 3 absences', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([record('absent'), record('absent'), record('absent'), record('present')]);
      prisma.attendanceSession.findFirst.mockResolvedValue({ group: { name: 'Group A' } });
      (prisma as any).studentParent = { findFirst: jest.fn().mockResolvedValue({ parentId: 'p1' }) };
      await (service as any).checkAbsenceCascade('s1', schoolId, 'u1');
      expect(notificationsMock.createNotification).toHaveBeenCalledTimes(2); // parent + servant
    });

    it('stays silent on the 4th consecutive absence', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([record('absent'), record('absent'), record('absent'), record('absent')]);
      await (service as any).checkAbsenceCascade('s1', schoolId, 'u1');
      expect(notificationsMock.createNotification).not.toHaveBeenCalled();
    });

    it('QR re-scan of an already checked-in student does not re-notify or rewrite the record', async () => {
      prisma.user.findUnique.mockResolvedValue({ schoolId });
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.attendanceSession.findFirst.mockResolvedValue(openSession);
      prisma.attendanceRecord.findUnique.mockResolvedValue({ status: 'present', student: { firstName: 'Mina', lastName: 'G' } });
      const res: any = await service.qrCheckIn('u1', 's1');
      expect(res.alreadyCheckedIn).toBe(true);
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
      expect(notificationsMock.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('session types and audience targets', () => {
    const captureListWhere = async (filters: any) => {
      let captured: any;
      prisma.attendanceSession.findMany.mockImplementation((args: any) => { captured = args; return Promise.resolve([]); });
      prisma.attendanceSession.count.mockResolvedValue(0);
      await service.getSessions(schoolId, filters);
      return captured;
    };

    it('filters the session list by type', async () => {
      const args = await captureListWhere({ type: 'liturgy' });
      expect(args.where.type).toBe('liturgy');
    });

    it('rejects an unknown session type', async () => {
      await expect(service.getSessions(schoolId, { type: 'party' })).rejects.toThrow(/class, liturgy or event/);
    });

    it('matches a group filter through the audience rows and keeps excludeNotes working', async () => {
      const args = await captureListWhere({ groupId: 'G1', excludeNotes: 'liturgy' });
      expect(args.where.groupId).toBeUndefined();
      expect(args.where.AND).toEqual(expect.arrayContaining([
        { OR: [{ notes: null }, { notes: { not: 'liturgy' } }] },
        { OR: [{ groupId: 'G1' }, { targets: { some: { groupId: 'G1' } } }] },
      ]));
      expect(args.include.targets).toBeDefined();
    });

    it('creates a class with exactly one audience row mirroring its own columns', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.create.mockResolvedValue({ id: 'new-1' });
      prisma.user.findUnique.mockResolvedValue({ metadata: {} });
      prisma.student.findMany.mockResolvedValue([]);
      await service.createSession({
        servantId: 'u1', groupId: 'g1', levelId: 'l1', gradeId: 'gr1', scheduledDate: '2026-10-01', gender: 'female',
      } as any);
      const data = prisma.attendanceSession.create.mock.calls[0][0].data;
      expect(data.type).toBeUndefined(); // DB default 'class'
      expect(data.targets).toEqual({ create: [{ groupId: 'g1', levelId: 'l1', gradeId: 'gr1', gender: 'female' }] });
    });

    it('does not restrict gender when the session filter is "both"', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.create.mockResolvedValue({ id: 'new-2' });
      prisma.user.findUnique.mockResolvedValue({ metadata: {} });
      prisma.student.findMany.mockResolvedValue([]);
      await service.createSession({ servantId: 'u1', groupId: 'g1', scheduledDate: '2026-10-02', gender: 'both' } as any);
      expect(prisma.attendanceSession.create.mock.calls[0][0].data.targets).toEqual({ create: [{ groupId: 'g1', levelId: null, gradeId: null, gender: null }] });
    });

    it('re-points the class audience row when the session group changes', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ id: 's1', schoolId, servantId: 'u1', groupId: 'g1', levelId: 'l1', status: 'scheduled', type: 'class', metadata: null });
      prisma.attendanceSession.update.mockResolvedValue({ id: 's1', schoolId, servantId: 'u1', groupId: 'g2', levelId: 'l1', gradeId: null, status: 'scheduled', type: 'class', metadata: null });
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
      await service.updateSession('s1', { groupId: 'g2' } as any);
      expect(prisma.attendanceSessionTarget.deleteMany).toHaveBeenCalledWith({ where: { sessionId: 's1' } });
      expect(prisma.attendanceSessionTarget.create).toHaveBeenCalledWith({ data: { sessionId: 's1', groupId: 'g2', levelId: 'l1', gradeId: null, gender: null } });
    });

    it('syncs a liturgy roster from the union of its audience rows', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ id: 'lit1', schoolId, servantId: 'u1', groupId: null, type: 'liturgy', allGroups: false, metadata: null });
      prisma.attendanceSessionTarget.findMany.mockResolvedValueOnce([
        { groupId: 'g1', levelId: null, gradeId: null, gender: null },
        { groupId: 'g2', levelId: 'l2', gradeId: null, gender: null },
      ]);
      prisma.user.findUnique.mockResolvedValue({ metadata: {} });
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
      await (service as any).syncSessionStudents('lit1', 'u1');
      expect(prisma.student.findMany.mock.calls[0][0].where).toEqual({
        deletedAt: null,
        OR: [{ groupId: 'g1' }, { groupId: 'g2', levelId: 'l2' }],
      });
    });

    it('a whole-school session is scoped to its own school, never all schools', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ id: 'ev1', schoolId, servantId: 'u1', groupId: null, type: 'event', allGroups: true, metadata: null });
      prisma.attendanceSessionTarget.findMany.mockResolvedValueOnce([]);
      prisma.user.findUnique.mockResolvedValue({ metadata: {} });
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
      await (service as any).syncSessionStudents('ev1', 'u1');
      expect(prisma.student.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, schoolId });
    });

    it('a class roster is selected exactly as before (own group/level/grade)', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ id: 'c1', schoolId, servantId: 'u1', groupId: 'g1', levelId: 'l1', gradeId: 'gr1', type: 'class', metadata: null });
      prisma.user.findUnique.mockResolvedValue({ metadata: {} });
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
      await (service as any).syncSessionStudents('c1', 'u1');
      expect(prisma.attendanceSessionTarget.findMany).not.toHaveBeenCalled();
      expect(prisma.student.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, groupId: 'g1', levelId: 'l1', gradeId: 'gr1' });
    });
  });
});
