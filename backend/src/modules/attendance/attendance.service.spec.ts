import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      count: jest.fn(),
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
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
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

    it('joins an already-started session for the same group/date instead of creating a duplicate, even for a different servant', async () => {
      // A co-teacher ("other-servant") already started today's class for this group.
      prisma.attendanceSession.findMany.mockResolvedValue([
        { id: 'sess-other', status: 'in_progress', servantId: 'other-servant', groupId: 'group-1', levelId: 'level-1', gradeId: null, metadata: null },
      ]);

      const result: any = await service.startClass('u1');

      expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
      expect(result.created).toBe(false);
      expect(result.session.id).toBe('sess-other');
    });

    it('excludes cancelled sessions from the same-group/date match, so a cancelled slot is free to re-start', async () => {
      // The DB query itself filters cancelled out via status: { not: 'cancelled' };
      // simulate that by returning none, and assert the query actually asks for it.
      prisma.attendanceSession.findMany.mockResolvedValue([]);

      const result: any = await service.startClass('u1');

      const existingCall = prisma.attendanceSession.findMany.mock.calls.find(
        (c: any) => c[0]?.where?.groupId === 'group-1' && c[0]?.where?.scheduledDate,
      );
      expect(existingCall?.[0]?.where?.status).toEqual({ not: 'cancelled' });
      expect(prisma.attendanceSession.create).toHaveBeenCalled();
      expect(result.created).toBe(true);
    });
  });

  describe('startSession', () => {
    const classSession = { id: 'sess-1', schoolId, servantId: 'owner', groupId: 'group-1', levelId: 'level-1', type: 'class', status: 'scheduled', actualStartTime: null, deletedAt: null };

    beforeEach(() => {
      prisma.attendanceSession.update.mockImplementation(({ data }: any) => Promise.resolve({ ...classSession, ...data }));
      prisma.attendanceSession.findUnique.mockResolvedValue(classSession);
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 0 });
    });

    it('the owning servant can start their own session', async () => {
      const result = await service.startSession('sess-1', 'owner', []);
      expect(result.started).toBe(true);
    });

    it('a co-teacher assigned to the same group can start the shared session too', async () => {
      prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'group-1' }, schoolId });
      const result = await service.startSession('sess-1', 'co-teacher', []);
      expect(result.started).toBe(true);
    });

    it('a servant with no assignment to this group is rejected', async () => {
      prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'some-other-group' }, schoolId });
      await expect(service.startSession('sess-1', 'stranger', [])).rejects.toThrow(/Not your session/);
    });

    it('an admin can start any session regardless of assignment', async () => {
      const result = await service.startSession('sess-1', 'admin-1', ['admin']);
      expect(result.started).toBe(true);
    });

    it('rejects starting a cancelled session', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ ...classSession, status: 'cancelled' });
      await expect(service.startSession('sess-1', 'owner', [])).rejects.toThrow(/cancelled/);
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
        servantId: 'u1',
        groupId: 'group-1',
        levelId: 'level-1',
        scheduledDate: '2026-01-05',
        gender: 'female',
      } as any);

      expect(result.id).toBe('sess-2');
      expect(prisma.attendanceSession.create).toHaveBeenCalled();
    });

    it('refuses to create a class session in another school', async () => {
      jest.spyOn((service as any).schoolResolver, 'resolve').mockResolvedValueOnce('school-2');

      await expect(
        service.createSession(
          { schoolId: 'school-2', servantId: 'u1', groupId: 'group-1', scheduledDate: '2026-01-05' } as any,
          { id: 'u1', schoolId, roles: ['servant'] },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
    });

    it('lets a super admin create a class session in another school', async () => {
      jest.spyOn((service as any).schoolResolver, 'resolve').mockResolvedValueOnce('school-2');
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.create.mockResolvedValue({ id: 'sess-9', groupId: 'group-1' });
      prisma.student.findMany.mockResolvedValue([]);

      const result = await service.createSession(
        { schoolId: 'school-2', servantId: 'u1', groupId: 'group-1', scheduledDate: '2026-01-05' } as any,
        { id: 'u1', schoolId, roles: ['super_admin'] },
      );

      expect(result.id).toBe('sess-9');
    });

    it('creates a session when none exists for the group on the date', async () => {
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.attendanceSession.create.mockResolvedValue({ id: 'sess-1', groupId: 'group-1' });
      prisma.student.findMany.mockResolvedValue([]);

      const result = await service.createSession({
        schoolId,
        servantId: 'u1',
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

    it('cancels all attendance records instead of re-syncing the roster when status becomes cancelled', async () => {
      await service.updateSession('sess-1', { status: 'cancelled' } as any);

      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith({
        where: { attendanceSessionId: 'sess-1' },
        data: { status: 'cancelled' },
      });
      expect(prisma.student.findMany).not.toHaveBeenCalled();
    });

    it('resets cancelled records to unmarked and re-syncs the roster when un-cancelled', async () => {
      storedSession = { ...baseSession, status: 'cancelled' };

      await service.updateSession('sess-1', { status: 'scheduled' } as any);

      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith({
        where: { attendanceSessionId: 'sess-1', status: 'cancelled' },
        data: { status: 'unmarked' },
      });
      expect(prisma.student.findMany).toHaveBeenCalled();
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
      expect(where.AND).toContainEqual({ OR: [{ groupId: { in: ['G1'] } }, { targets: { some: { groupId: { in: ['G1'] } } } }, { allGroups: true }] });
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
      expect(where.AND).toContainEqual({ OR: [{ groupId: { in: ['G2', 'G3'] } }, { targets: { some: { groupId: { in: ['G2', 'G3'] } } } }, { allGroups: true }] });
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

    it('markAttendance rejects cancelled sessions — no recording is needed', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ ...open, status: 'cancelled' });
      await expect(service.markAttendance('sess-1', dto)).rejects.toThrow(/cancelled/);
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

    it('finalizeSession saves students still unmarked as absent instead of rejecting', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(open);
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([]) // syncSessionStudents existing ids
        .mockResolvedValueOnce([{ studentId: 's1', status: 'unmarked' }, { studentId: 's2', status: 'unmarked' }]);
      prisma.attendanceRecord.updateMany.mockReturnValue('absent-op');
      await expect(service.finalizeSession('sess-1', dto)).resolves.toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith({
        where: { attendanceSessionId: 'sess-1', status: 'unmarked' },
        data: expect.objectContaining({ status: 'absent' }),
      });
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
      prisma.attendanceRecord.updateMany.mockReturnValue('absent-op');
      await service.finalizeSession('sess-1', dto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toEqual(['upsert-op', 'absent-op', 'complete-op']);
      const completion = prisma.attendanceSession.updateMany.mock.calls[0][0];
      expect(completion.where).toEqual({ id: 'sess-1', status: { notIn: ['completed', 'recorded'] } });
      expect(completion.data.status).toBe('completed');
      expect(completion.data.actualEndTime).toBeInstanceOf(Date);
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

    it('threads a from/to range into the underlying queries (week-scoped insights, not lifetime totals)', async () => {
      await service.getSessionStats('school-1', { from: '2026-02-01', to: '2026-02-07' });

      const sessionGroupByWhere = prisma.attendanceSession.groupBy.mock.calls[0][0].where;
      expect(sessionGroupByWhere.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ scheduledDate: { gte: new Date('2026-02-01'), lte: new Date('2026-02-07T23:59:59.999') } }),
        ]),
      );
    });

    it('reports cancelledSessions and a distinct-student headcount distinct from raw record counts', async () => {
      prisma.attendanceSession.count.mockResolvedValue(2);
      prisma.attendanceRecord.groupBy.mockImplementation(({ by }: any) => {
        if (by?.[0] === 'studentId') return Promise.resolve([{ studentId: 'st1' }, { studentId: 'st2' }]);
        return Promise.resolve(tallies);
      });

      const stats = await service.getSessionStats('school-1');

      expect(stats.cancelledSessions).toBe(2);
      expect(stats.distinctStudents).toBe(2);
      // Distinct students (2) is far smaller than totalRecords (13): the raw
      // counts are record-level and naturally exceed a small headcount once
      // more than one session is in range — that gap is what Insights now
      // surfaces instead of hiding.
      expect(stats.distinctStudents).toBeLessThan(stats.totalRecords);
    });
  });

  describe('getEnrolledStudentCount', () => {
    it('counts only active, non-deleted students for the school', async () => {
      prisma.student.count.mockResolvedValue(42);
      const count = await service.getEnrolledStudentCount('school-1');
      expect(count).toBe(42);
      expect(prisma.student.count).toHaveBeenCalledWith({ where: { schoolId, deletedAt: null, status: 'active' } });
    });
  });

  describe('getTopAbsentees', () => {
    it('ranks students by absence count within the date range, most absent first', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { studentId: 'st1', studentCode: undefined, student: { id: 'st1', firstName: 'Mina', lastName: 'G', firstNameAr: null, lastNameAr: null, studentCode: 'S1' }, attendanceSession: { scheduledDate: new Date('2026-02-05'), group: { name: 'Group A' } } },
        { studentId: 'st1', student: { id: 'st1', firstName: 'Mina', lastName: 'G', firstNameAr: null, lastNameAr: null, studentCode: 'S1' }, attendanceSession: { scheduledDate: new Date('2026-01-29'), group: { name: 'Group A' } } },
        { studentId: 'st2', student: { id: 'st2', firstName: 'Sara', lastName: 'K', firstNameAr: null, lastNameAr: null, studentCode: 'S2' }, attendanceSession: { scheduledDate: new Date('2026-02-01'), group: { name: 'Group B' } } },
      ]);

      const result = await service.getTopAbsentees('school-1', { from: '2026-01-25', to: '2026-02-07' });

      expect(result[0]).toMatchObject({ studentId: 'st1', absences: 2, groupName: 'Group A' });
      expect(result[1]).toMatchObject({ studentId: 'st2', absences: 1, groupName: 'Group B' });
    });

    it('caps the result at the requested limit', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          studentId: `st${i}`,
          student: { id: `st${i}`, firstName: 'S', lastName: `${i}`, firstNameAr: null, lastNameAr: null, studentCode: `S${i}` },
          attendanceSession: { scheduledDate: new Date('2026-02-01'), group: { name: 'Group A' } },
        })),
      );
      const result = await service.getTopAbsentees('school-1', { limit: 2 });
      expect(result).toHaveLength(2);
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
        { OR: [{ groupId: 'G1' }, { targets: { some: { groupId: 'G1' } } }, { allGroups: true }] },
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

  describe('liturgy / event sessions', () => {
    const G1 = '11111111-1111-4111-8111-111111111111';
    const G2 = '22222222-2222-4222-8222-222222222222';
    const L1 = '33333333-3333-4333-8333-333333333333';
    const L2 = '44444444-4444-4444-8444-444444444444';
    const actorRow = (roles: string[], metadata: any = {}) => ({ id: 'u1', schoolId, metadata, userRoles: roles.map(name => ({ role: { name } })) });
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const past = '2026-01-04';

    beforeEach(() => {
      jest.spyOn(service as any, 'syncSessionStudents').mockResolvedValue(undefined);
      jest.spyOn(service, 'getSessionById').mockResolvedValue({ id: 'new-1' } as any);
      prisma.group.findMany.mockImplementation(({ where }: any) => Promise.resolve((where?.id?.in ?? [G1, G2]).map((id: string) => ({ id }))));
      prisma.attendanceSession.findFirst.mockResolvedValue(null);
      prisma.attendanceSession.create.mockResolvedValue({ id: 'new-1' });
      prisma.schoolGrade.findMany.mockResolvedValue([]);
    });
    const createdData = () => prisma.attendanceSession.create.mock.calls[0][0].data;

    it('servant can create a liturgy for their own group, future-dated', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['servant'], { groupId: G1 }));
      await service.createSession({ type: 'liturgy', targets: [{ groupId: G1 }], scheduledDate: future } as any, { id: 'u1' });
      const d = createdData();
      expect(d).toMatchObject({ type: 'liturgy', groupId: G1, allGroups: false, servantId: 'u1' });
      expect(d.targets).toEqual({ create: [{ groupId: G1, levelId: null, gradeId: null, gender: null }] });
    });

    it('a servant with no audience gets their own group by default', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['servant'], { groupId: G1 }));
      await service.createSession({ type: 'liturgy', scheduledDate: past } as any, { id: 'u1' });
      expect(createdData().groupId).toBe(G1);
    });

    it('servant cannot create a liturgy for another group, several groups or all groups', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['servant'], { groupId: G1 }));
      await expect(service.createSession({ type: 'liturgy', targets: [{ groupId: G2 }], scheduledDate: past } as any, { id: 'u1' })).rejects.toThrow(/own group/);
      await expect(service.createSession({ type: 'liturgy', targets: [{ groupId: G1 }, { groupId: G2 }], scheduledDate: past } as any, { id: 'u1' })).rejects.toThrow(/own group/);
      await expect(service.createSession({ type: 'liturgy', allGroups: true, scheduledDate: past } as any, { id: 'u1' })).rejects.toThrow(/own group/);
      expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
    });

    it('servants and group leaders cannot create events', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['group_leader'], { groupId: G1 }));
      await expect(service.createSession({ type: 'event', title: 'Picnic', targets: [{ groupId: G1 }], scheduledDate: future } as any, { id: 'u1' })).rejects.toThrow(/Only admins, principals and level leaders/);
    });

    it('admin can create a multi-group event and a whole-school liturgy', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      await service.createSession({ type: 'event', title: 'Picnic', location: 'Park', targets: [{ groupId: G1 }, { groupId: G2 }], scheduledDate: future } as any, { id: 'u1' });
      expect(createdData()).toMatchObject({ type: 'event', title: 'Picnic', location: 'Park', groupId: null, allGroups: false });
      expect(createdData().targets.create).toHaveLength(2);

      prisma.attendanceSession.create.mockClear();
      await service.createSession({ type: 'liturgy', allGroups: true, scheduledDate: future } as any, { id: 'u1' });
      expect(createdData()).toMatchObject({ type: 'liturgy', allGroups: true, groupId: null });
      expect(createdData().targets).toBeUndefined();
    });

    it('an event needs a title', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      await expect(service.createSession({ type: 'event', allGroups: true, scheduledDate: future } as any, { id: 'u1' })).rejects.toThrow(/needs a title/);
    });

    it('level leaders are limited to their own level; "all groups" becomes per-group targets in that level', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['level_leader'], { levelId: L1 }));
      await expect(service.createSession({ type: 'event', title: 'x', targets: [{ groupId: G1, levelId: L2 }], scheduledDate: future } as any, { id: 'u1' })).rejects.toThrow(/own level/);
      await service.createSession({ type: 'liturgy', allGroups: true, scheduledDate: future } as any, { id: 'u1' });
      const d = createdData();
      expect(d.allGroups).toBe(false);
      expect(d.targets.create.every((t: any) => t.levelId === L1)).toBe(true);
    });

    it('rejects a second liturgy for the same group and day, pointing at the existing one', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      prisma.attendanceSession.findFirst.mockResolvedValue({ id: 'existing-lit' });
      await expect(service.createSession({ type: 'liturgy', targets: [{ groupId: G1 }], scheduledDate: past } as any, { id: 'u1' }))
        .rejects.toMatchObject({ response: { existingSessionId: 'existing-lit' } });
      expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
    });

    it('startNow creates an in-progress session dated today', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      await service.createSession({ type: 'event', title: 'Surprise visit', allGroups: true, startNow: true, scheduledDate: future } as any, { id: 'u1' });
      const d = createdData();
      expect(d.status).toBe('in_progress');
      expect(d.actualStartTime).toBeInstanceOf(Date);
      expect(Math.abs(d.scheduledDate.getTime() - Date.now())).toBeLessThan(5000);
    });

    it('rejects groups outside the school', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      prisma.group.findMany.mockResolvedValue([]);
      await expect(service.createSession({ type: 'liturgy', targets: [{ groupId: G1 }], scheduledDate: past } as any, { id: 'u1' })).rejects.toThrow(/not found in this school/);
    });

    // ── marking ──
    const typedSession = (over: any = {}) => ({ id: 's-lit', schoolId, servantId: 'owner', groupId: G1, type: 'liturgy', allGroups: false, status: 'in_progress', scheduledDate: new Date(), actualStartTime: new Date(), deletedAt: null, metadata: null, ...over });

    it('liturgy/event cannot be marked before their scheduled day; classes still can', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      const dto = { recordedBy: 'u1', records: [{ studentId: 's1', status: 'present' }] } as any;
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession({ scheduledDate: new Date(Date.now() + 3 * 86400000) }));
      await expect(service.markAttendance('s-lit', dto, { id: 'u1' })).rejects.toThrow(/scheduled for/);
      expect(prisma.$transaction).not.toHaveBeenCalled();

      jest.restoreAllMocks();
      jest.spyOn(service as any, 'syncSessionStudents').mockResolvedValue(undefined);
      jest.spyOn(service, 'getSessionById').mockResolvedValue({ id: 'c1' } as any);
      prisma.attendanceSession.findUnique.mockResolvedValue({ ...typedSession({ type: 'class', scheduledDate: new Date(Date.now() + 3 * 86400000) }) });
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.upsert.mockReturnValue('op');
      prisma.$transaction.mockResolvedValue([]);
      await expect(service.markAttendance('c1', dto, { id: 'u1' })).resolves.toBeDefined();
    });

    it('liturgy allows only present/absent, drops scores and sets the liturgy flag', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession());
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.upsert.mockReturnValue('op');
      prisma.$transaction.mockResolvedValue([]);
      await expect(service.markAttendance('s-lit', { records: [{ studentId: 's1', status: 'late' }] } as any, { id: 'u1' })).rejects.toThrow(/only present or absent/);

      await service.markAttendance('s-lit', { records: [{ studentId: 's1', status: 'present', behavior: 5, participation: 4, homeworkStatus: 'completed' }] } as any, { id: 'u1' });
      const args = prisma.attendanceRecord.upsert.mock.calls[0][0];
      expect(args.update).toMatchObject({ status: 'present', attendedLiturgy: true, behavior: undefined, participation: undefined });
    });

    it('a servant outside the audience cannot mark; one in the audience can', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession());
      prisma.attendanceSessionTarget.findMany.mockResolvedValue([{ groupId: G1 }]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.upsert.mockReturnValue('op');
      prisma.$transaction.mockResolvedValue([]);
      const dto = { records: [{ studentId: 's1', status: 'present' }] } as any;
      prisma.user.findUnique.mockResolvedValue(actorRow(['servant'], { groupId: G2 }));
      await expect(service.markAttendance('s-lit', dto, { id: 'u1' })).rejects.toThrow(/not assigned/);
      prisma.user.findUnique.mockResolvedValue(actorRow(['servant'], { groupId: G1 }));
      await expect(service.markAttendance('s-lit', dto, { id: 'u1' })).resolves.toBeDefined();
    });

    it('legacy "recorded" liturgy sessions are read-only until re-opened', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession({ status: 'recorded' }));
      await expect(service.markAttendance('s-lit', { records: [] } as any, { id: 'u1' })).rejects.toThrow(/read-only/);
    });

    // ── finalize ──
    it('finalizing a liturgy marks everyone not present as absent, atomically, with no unmarked prompt', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession());
      prisma.attendanceRecord.findMany.mockResolvedValue([{ studentId: 's1', status: 'unmarked' }, { studentId: 's2', status: 'unmarked' }]);
      prisma.attendanceRecord.upsert.mockReturnValue('upsert-op');
      prisma.attendanceRecord.updateMany.mockReturnValue('absent-op');
      prisma.attendanceSession.updateMany.mockReturnValue('complete-op');
      prisma.$transaction.mockResolvedValue([]);
      await service.finalizeSession('s-lit', { records: [{ studentId: 's1', status: 'present' }] } as any, { id: 'u1' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toEqual(['upsert-op', 'absent-op', 'complete-op']);
      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith({
        where: { attendanceSessionId: 's-lit', status: 'unmarked' },
        data: expect.objectContaining({ status: 'absent', attendedLiturgy: false }),
      });
    });

    it('liturgy/event finalize triggers no class XP or absence alerts; events trigger no badges either', async () => {
      const gamification: any = (service as any).gamification;
      gamification.awardAttendanceXp.mockClear();
      gamification.computeBadgesForStudent.mockClear();
      const cascade = jest.spyOn(service as any, 'checkAbsenceCascade').mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      prisma.attendanceRecord.findMany.mockResolvedValue([{ studentId: 's1', status: 'unmarked' }]);
      prisma.attendanceRecord.upsert.mockReturnValue('op');
      prisma.attendanceRecord.updateMany.mockReturnValue('op');
      prisma.attendanceSession.updateMany.mockReturnValue('op');
      prisma.$transaction.mockResolvedValue([]);

      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession());
      await service.finalizeSession('s-lit', { records: [{ studentId: 's1', status: 'absent' }] } as any, { id: 'u1' });
      expect(gamification.awardAttendanceXp).not.toHaveBeenCalled();
      expect(cascade).not.toHaveBeenCalled();
      expect(gamification.computeBadgesForStudent).toHaveBeenCalled(); // liturgy badges

      gamification.computeBadgesForStudent.mockClear();
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession({ type: 'event' }));
      await service.finalizeSession('s-ev', { records: [{ studentId: 's1', status: 'present' }] } as any, { id: 'u1' });
      expect(gamification.computeBadgesForStudent).not.toHaveBeenCalled();
    });

    // ── edit ──
    it('the session type cannot be changed', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession());
      await expect(service.updateSession('s-lit', { type: 'event' } as any)).rejects.toThrow(/cannot be changed/);
    });

    it('an editor replaces the audience of a liturgy/event and the roster is re-synced', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['admin']));
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession({ type: 'event' }));
      prisma.attendanceSession.update.mockResolvedValue({ id: 's-ev', type: 'event', metadata: null });
      await service.updateSession('s-ev', { title: 'New title', targets: [{ groupId: G1 }, { groupId: G2 }] } as any, { id: 'u1' });
      const data = prisma.attendanceSession.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ title: 'New title', allGroups: false, groupId: null });
      expect(prisma.attendanceSessionTarget.deleteMany).toHaveBeenCalledWith({ where: { sessionId: 's-ev' } });
      expect(prisma.attendanceSessionTarget.createMany.mock.calls[0][0].data).toHaveLength(2);
      expect((service as any).syncSessionStudents).toHaveBeenCalled();
    });

    it('only the creator, a level leader or an admin can edit a liturgy/event', async () => {
      prisma.user.findUnique.mockResolvedValue(actorRow(['servant'], { groupId: G1 }));
      prisma.attendanceSession.findUnique.mockResolvedValue(typedSession());
      await expect(service.updateSession('s-lit', { title: 'x' } as any, { id: 'u1' })).rejects.toThrow(/creator, a level leader or an admin/);
    });
  });

  describe('finalize and completion mark unmarked students absent', () => {
    const classSession = { id: 'c1', schoolId, servantId: 'u1', groupId: 'g1', levelId: 'l1', type: 'class', status: 'in_progress', scheduledDate: new Date(), actualStartTime: new Date(), deletedAt: null, metadata: null };

    beforeEach(() => {
      jest.spyOn(service as any, 'syncSessionStudents').mockResolvedValue(undefined);
      jest.spyOn(service, 'getSessionById').mockResolvedValue({ id: 'c1' } as any);
      prisma.attendanceRecord.upsert.mockReturnValue('upsert-op');
      prisma.attendanceRecord.updateMany.mockReturnValue('absent-op');
      prisma.attendanceSession.updateMany.mockReturnValue('complete-op');
      prisma.$transaction.mockResolvedValue([]);
    });

    it('a class finalize keeps present/late/excused and turns every other student into absent, in one transaction', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue(classSession);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { studentId: 's1', status: 'unmarked' }, { studentId: 's2', status: 'unmarked' }, { studentId: 's3', status: 'unmarked' }, { studentId: 's4', status: 'unmarked' },
      ]);
      await service.finalizeSession('c1', { recordedBy: 'u1', records: [
        { studentId: 's1', status: 'present' }, { studentId: 's2', status: 'late' }, { studentId: 's3', status: 'excused' },
      ] } as any);
      const ops = prisma.$transaction.mock.calls[0][0];
      expect(ops).toHaveLength(5); // 3 explicit marks, the unmarked->absent sweep, the completion
      expect(ops.slice(3)).toEqual(['absent-op', 'complete-op']);
      // the sweep only touches rows still unmarked AFTER the explicit marks were written
      expect(prisma.attendanceRecord.updateMany.mock.calls[0][0]).toEqual({
        where: { attendanceSessionId: 'c1', status: 'unmarked' },
        data: expect.objectContaining({ status: 'absent' }),
      });
    });

    it('auto-absent class students count like any absence: parent absence check runs for them only', async () => {
      const cascade = jest.spyOn(service as any, 'checkAbsenceCascade').mockResolvedValue(undefined);
      prisma.attendanceSession.findUnique.mockResolvedValue(classSession);
      prisma.attendanceRecord.findMany.mockResolvedValue([{ studentId: 's1', status: 'unmarked' }, { studentId: 's2', status: 'unmarked' }]);
      await service.finalizeSession('c1', { recordedBy: 'u1', records: [{ studentId: 's1', status: 'present' }] } as any);
      expect(cascade).toHaveBeenCalledTimes(1);
      expect(cascade).toHaveBeenCalledWith('s2', schoolId, 'u1');
    });

    it('already-absent students are not re-notified when the class is finalized', async () => {
      const cascade = jest.spyOn(service as any, 'checkAbsenceCascade').mockResolvedValue(undefined);
      prisma.attendanceSession.findUnique.mockResolvedValue(classSession);
      prisma.attendanceRecord.findMany.mockResolvedValue([{ studentId: 's1', status: 'absent' }]);
      await service.finalizeSession('c1', { recordedBy: 'u1', records: [{ studentId: 's1', status: 'absent' }] } as any);
      expect(cascade).not.toHaveBeenCalled();
    });

    it('completing a session through a plain status update also saves unmarked students as absent', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ ...classSession, status: 'in_progress' });
      prisma.attendanceSession.update.mockResolvedValue({ ...classSession, status: 'completed', metadata: null });
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.findMany.mockResolvedValue([{ studentId: 's9' }]); // the unmarked rows
      jest.spyOn(service as any, 'sendPracticeGuideNotifications').mockResolvedValue(undefined);
      await service.updateSession('c1', { status: 'completed' } as any);
      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith({
        where: { attendanceSessionId: 'c1', status: 'unmarked' },
        data: expect.objectContaining({ status: 'absent' }),
      });
    });

    it('a status change that is not a completion leaves unmarked students alone', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValue({ ...classSession, status: 'scheduled' });
      prisma.attendanceSession.update.mockResolvedValue({ ...classSession, status: 'in_progress', metadata: null });
      prisma.student.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      await service.updateSession('c1', { status: 'in_progress' } as any);
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled();
    });
  });
});
