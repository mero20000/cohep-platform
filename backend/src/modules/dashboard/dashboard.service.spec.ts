import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;

  const schoolId = 'school-1';
  const user = { id: 'user-1', roles: ['servant'] };

  const prismaMock = {
    school: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    attendanceSession: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    attendanceRecord: { findMany: jest.fn() },
    group: { findMany: jest.fn(), findUnique: jest.fn() },
    student: { count: jest.fn(), findMany: jest.fn() },
    grade: { findMany: jest.fn() },
    curriculumAllocation: { findFirst: jest.fn(), findMany: jest.fn() },
    academicYear: { findFirst: jest.fn() },
    subjectItem: { findMany: jest.fn() },
    lessonProgress: { findMany: jest.fn() },
    assessmentSubmission: { findMany: jest.fn() },
    servantFollowUp: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    systemConfig: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    (prisma.servantFollowUp.findMany as jest.Mock).mockResolvedValue([]);
  });

  function mockMinistryBaseline() {
    prisma.school.findUnique.mockResolvedValue({ name: 'S', nameAr: '', logoUrl: null, church: null });
    prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'g1' } });
    prisma.attendanceSession.findMany.mockResolvedValue([]);
    prisma.group.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);
    prisma.attendanceSession.count.mockResolvedValue(0);
    prisma.group.findUnique.mockResolvedValue({ name: 'Group A' });
    prisma.grade.findMany.mockResolvedValue([]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    prisma.academicYear.findFirst.mockResolvedValue(null); // → default activeDays [6, 0]
    prisma.subjectItem.findMany.mockResolvedValue([]);
    prisma.curriculumAllocation.findMany.mockResolvedValue([]);
  }

  // Most recent Saturday (in default activeDays [Sat, Sun]) at noon.
  function saturdayNoon() {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
    d.setHours(12, 0, 0, 0);
    return d;
  }

  describe('getStats — church count', () => {
    it('counts only active, non-deleted churches', async () => {
      prisma.student.count.mockResolvedValue(0);
      prisma.attendanceSession.count.mockResolvedValue(0);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      (prisma as any).level = { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) };
      (prisma as any).lesson = { count: jest.fn().mockResolvedValue(0) };
      (prisma as any).church = { count: jest.fn().mockResolvedValue(3) };
      (prisma as any).user = { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn().mockResolvedValue(null) };
      (prisma as any).studentBadge = { count: jest.fn().mockResolvedValue(0) };
      (prisma as any).assessment = { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) };
      (prisma as any).schoolGrade = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.student.groupBy = jest.fn().mockResolvedValue([]);
      (prisma as any).assessmentSubmission = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.curriculumAllocation.count = jest.fn().mockResolvedValue(0);
      (prisma as any).grade = { findMany: jest.fn().mockResolvedValue([]) };
      (prisma as any).auditLog = { findMany: jest.fn().mockResolvedValue([]) };
      (prisma as any).xPTransaction = { groupBy: jest.fn().mockResolvedValue([]) };

      const result: any = await (service as any).getStats(schoolId);

      expect((prisma as any).church.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null, isActive: true }) }),
      );
      expect(result.totalChurches).toBe(3);
    });
  });

  describe('getStats — headline numbers', () => {
    const day = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

    function mockStatsBaseline() {
      prisma.student.count.mockResolvedValue(0);
      prisma.attendanceSession.count.mockResolvedValue(0);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      (prisma as any).level = { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) };
      (prisma as any).lesson = { count: jest.fn().mockResolvedValue(0) };
      (prisma as any).church = { count: jest.fn().mockResolvedValue(0) };
      (prisma as any).user = { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn().mockResolvedValue(null) };
      (prisma as any).studentBadge = { count: jest.fn().mockResolvedValue(0) };
      (prisma as any).assessment = { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) };
      (prisma as any).schoolGrade = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.student.groupBy = jest.fn().mockResolvedValue([]);
      (prisma as any).assessmentSubmission = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.curriculumAllocation.count = jest.fn().mockResolvedValue(0);
      (prisma as any).grade = { findMany: jest.fn().mockResolvedValue([]) };
      (prisma as any).auditLog = { findMany: jest.fn().mockResolvedValue([]) };
      (prisma as any).xPTransaction = { groupBy: jest.fn().mockResolvedValue([]) };
    }

    /** attendanceRecord.findMany serves the attendance trend and the at-risk lookup; only the latter has an upper date bound. */
    function mockAttendance({ trend = [] as any[], risk = [] as any[] } = {}) {
      prisma.attendanceRecord.findMany.mockImplementation((args: any) =>
        Promise.resolve('lte' in args.where.attendanceSession.scheduledDate ? risk : trend),
      );
    }

    it('returns the school attendance target: the default 80 until an admin sets one', async () => {
      mockStatsBaseline();
      expect((await service.getStats(schoolId)).attendanceTarget).toBe(80);
      prismaMock.systemConfig.findUnique.mockResolvedValueOnce({ value: 90 });
      expect((await service.getStats(schoolId)).attendanceTarget).toBe(90);
    });

    it('reports null attendance (not 0%) when no class was held in the last 7 days', async () => {
      mockStatsBaseline();
      mockAttendance();

      const result: any = await (service as any).getStats(schoolId);

      expect(result.attendanceRate).toBeNull();
      expect(result.attendancePrevRate).toBeNull();
      expect(result.attendanceTrend).toHaveLength(8);
      expect(result.attendanceTrend.every((p: any) => p.rate === null)).toBe(true);
    });

    it('uses the last 7 days against the 7 before, not just today', async () => {
      mockStatsBaseline();
      mockAttendance({
        trend: [
          { status: 'present', attendanceSession: { scheduledDate: day(3) } }, // three days ago, NOT today
          { status: 'present', attendanceSession: { scheduledDate: day(3) } },
          { status: 'absent', attendanceSession: { scheduledDate: day(3) } },
          { status: 'present', attendanceSession: { scheduledDate: day(10) } },
          { status: 'absent', attendanceSession: { scheduledDate: day(10) } },
        ],
      });

      const result: any = await (service as any).getStats(schoolId);

      expect(result.attendanceRate).toBe(67);
      expect(result.attendancePrevRate).toBe(50);
    });

    it('counts students at risk with the shared rule and returns the 8-week trend oldest-first', async () => {
      mockStatsBaseline();
      mockAttendance({
        risk: [
          { studentId: 'a', status: 'absent', attendanceSession: { scheduledDate: day(5) } },
          { studentId: 'a', status: 'absent', attendanceSession: { scheduledDate: day(12) } },
          { studentId: 'a', status: 'absent', attendanceSession: { scheduledDate: day(19) } },
          { studentId: 'b', status: 'absent', attendanceSession: { scheduledDate: day(5) } },
        ],
      });

      const result: any = await (service as any).getStats(schoolId);

      expect(result.studentsAtRisk).toBe(1);
      const starts = result.attendanceTrend.map((p: any) => p.weekStart);
      expect([...starts].sort()).toEqual(starts);
    });

    it('no longer returns the old record-count chart data', async () => {
      mockStatsBaseline();
      mockAttendance();
      const result: any = await (service as any).getStats(schoolId);
      expect(result).not.toHaveProperty('weeklyStats');
    });

    it('headlines the pass rate over the last 90 days, with the all-time figure kept alongside', async () => {
      mockStatsBaseline();
      mockAttendance();
      const submission = (score: number, gradedDaysAgo: number) => ({
        grades: [{ score, createdAt: day(gradedDaysAgo) }],
        assessment: { passingScore: 10, title: 'Quiz' },
        student: { id: 's', firstName: 'A', lastName: 'B', photoUrl: null },
      });
      (prisma as any).assessmentSubmission.findMany.mockResolvedValue([
        submission(5, 200), submission(5, 150), submission(5, 120), // old fails
        submission(15, 10), submission(15, 20), submission(5, 30), // recent: 2 of 3 pass
      ]);

      const result: any = await (service as any).getStats(schoolId);

      expect(result.assessmentStats.passRate).toBe(33); // all time: 2 of 6
      expect(result.assessmentStats.recent).toEqual({ windowDays: 90, gradedCount: 3, passRate: 67 });
    });

    it('recent pass rate is null when nothing was graded in the window', async () => {
      mockStatsBaseline();
      mockAttendance();
      (prisma as any).assessmentSubmission.findMany.mockResolvedValue([
        { grades: [{ score: 15, createdAt: day(200) }], assessment: { passingScore: 10, title: 'Q' }, student: { id: 's', firstName: 'A', lastName: 'B', photoUrl: null } },
      ]);
      const result: any = await (service as any).getStats(schoolId);
      expect(result.assessmentStats.recent.passRate).toBeNull();
    });
  });

  describe('getServantDigest — absence alerts', () => {
    const day = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

    /** A database where every query returns an empty/neutral result unless the test overrides it. */
    function permissiveDb(overrides: Record<string, any> = {}) {
      const defaults: Record<string, any> = { findMany: [], count: 0, findUnique: null, findFirst: null, groupBy: [], aggregate: { _sum: {} } };
      const model = (name: string) =>
        new Proxy({}, {
          get: (_t, method: string) => overrides[`${name}.${method}`] ?? jest.fn().mockResolvedValue(defaults[method] ?? null),
        });
      return new Proxy({}, { get: (_t, name: string) => model(name) });
    }

    function digestService(db: any, studentIds: string[]) {
      const svc = new DashboardService(db, { resolve: jest.fn().mockResolvedValue(schoolId) } as any);
      jest.spyOn(svc as any, 'resolveServantClass').mockResolvedValue({ groupIds: ['g1'], levelIds: ['l1'], studentIds });
      return svc;
    }

    const risk = (studentId: string, status: string, n: number) => ({ studentId, status, attendanceSession: { scheduledDate: day(n) } });

    it('alerts for students on the shared at-risk definition, with their real streak', async () => {
      const recordsFindMany = jest.fn().mockImplementation((args: any) => {
        const sd = args?.where?.attendanceSession?.scheduledDate;
        // The at-risk lookup is the query with a bounded lookback window (has an upper date bound).
        return Promise.resolve(sd && 'lte' in sd ? [
          risk('s1', 'absent', 5), risk('s1', 'absent', 12), risk('s1', 'absent', 19), risk('s1', 'absent', 26),
          risk('s2', 'absent', 5), risk('s2', 'present', 12),
        ] : []);
      });
      const studentFindMany = jest.fn().mockResolvedValue([{ id: 's1', firstName: 'Mina', lastName: 'K', firstNameAr: null, lastNameAr: null }]);
      const db = permissiveDb({ 'attendanceRecord.findMany': recordsFindMany, 'student.findMany': studentFindMany });

      const digest: any = await digestService(db, ['s1', 's2']).getServantDigest({ id: 'u1', roles: ['servant'] }, schoolId);

      expect(digest.absenceAlerts).toHaveLength(1);
      expect(digest.absenceAlerts[0]).toMatchObject({ studentId: 's1', consecutiveAbsences: 4 });
      expect(digest.absenceAlerts[0].messageEn).toContain('last 4 sessions');
      // Names are fetched in ONE query for the students that need an alert, not one per student.
      expect(studentFindMany).toHaveBeenCalledTimes(1);
      expect(studentFindMany.mock.calls[0][0].where).toEqual({ id: { in: ['s1'] } });
    });

    it('only alerts for the servant\'s own students', async () => {
      const recordsFindMany = jest.fn().mockImplementation((args: any) => {
        const sd = args?.where?.attendanceSession?.scheduledDate;
        return Promise.resolve(sd && 'lte' in sd
          ? ['other', 'mine'].flatMap((id) => [risk(id, 'absent', 5), risk(id, 'absent', 12), risk(id, 'absent', 19)])
          : []);
      });
      const studentFindMany = jest.fn().mockResolvedValue([{ id: 'mine', firstName: 'A', lastName: 'B', firstNameAr: null, lastNameAr: null }]);
      const db = permissiveDb({ 'attendanceRecord.findMany': recordsFindMany, 'student.findMany': studentFindMany });

      const digest: any = await digestService(db, ['mine']).getServantDigest({ id: 'u1', roles: ['servant'] }, schoolId);

      expect(digest.absenceAlerts.map((a: any) => a.studentId)).toEqual(['mine']);
    });

    it('has no alerts when nobody is at risk', async () => {
      const db = permissiveDb();
      const digest: any = await digestService(db, ['s1']).getServantDigest({ id: 'u1', roles: ['servant'] }, schoolId);
      expect(digest.absenceAlerts).toEqual([]);
    });
  });

  describe('getMine ministry view — student scope', () => {
    it('counts only active students (excludes inactive and graduated)', async () => {
      mockMinistryBaseline();
      prisma.attendanceRecord.findMany.mockResolvedValue([]);

      await service.getMine(user, schoolId, 'servant');

      expect(prisma.student.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active', deletedAt: null }),
        }),
      );
    });
  });

  describe('getMine ministry view — thisWeek', () => {
    it('returns status counts for records on active days of the current week', async () => {
      mockMinistryBaseline();
      const sat = saturdayNoon();
      const rec = (status: string) => ({ status, attendanceSession: { scheduledDate: sat } });
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([]) // all-time attendanceRecords (existing stat)
        .mockResolvedValueOnce([
          rec('present'),
          rec('present'),
          rec('late'),
          rec('absent'),
          rec('excused'),
        ]); // weekRecords (new)

      const result: any = await service.getMine(user, schoolId, 'servant');

      expect(result.thisWeek).toEqual({
        present: 2,
        late: 1,
        absent: 1,
        excused: 1,
        total: 5,
        attendanceRate: 75,
      });
    });

    it('filters the week query to the servant groups and the Sat-Sun window', async () => {
      mockMinistryBaseline();
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.getMine(user, schoolId, 'servant');

      const weekCall = prisma.attendanceRecord.findMany.mock.calls[1][0];
      expect(weekCall.where.student).toEqual({ deletedAt: null });
      expect(weekCall.where.attendanceSession).toMatchObject({
        schoolId,
        groupId: { in: ['g1'] },
      });
      expect(weekCall.where.attendanceSession.scheduledDate.gte).toBeInstanceOf(Date);
      expect(weekCall.where.attendanceSession.scheduledDate.lte).toBeInstanceOf(Date);
      expect(weekCall.where.attendanceSession.scheduledDate.lte.getTime())
        .toBeGreaterThan(weekCall.where.attendanceSession.scheduledDate.gte.getTime());
    });

    it('returns attendanceRate 0 when there are no records this week', async () => {
      mockMinistryBaseline();
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result: any = await service.getMine(user, schoolId, 'servant');

      expect(result.thisWeek.attendanceRate).toBe(0);
      expect(result.thisWeek.total).toBe(0);
    });

    it('excludes unmarked records from ministry and week rate denominators', async () => {
      mockMinistryBaseline();
      const sat = saturdayNoon();
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([
          { status: 'present' },
          { status: 'unmarked' },
          { status: 'unmarked' },
        ]) // all-time
        .mockResolvedValueOnce([
          { status: 'present', attendanceSession: { scheduledDate: sat } },
          { status: 'unmarked', attendanceSession: { scheduledDate: sat } },
        ]); // week

      const result: any = await service.getMine(user, schoolId, 'servant');

      expect(result.attendanceRate).toBe(100);
      expect(result.thisWeek).toMatchObject({ present: 1, total: 1, attendanceRate: 100 });
    });

    it('counts only active-day records per the academic year settings', async () => {
      mockMinistryBaseline();
      prisma.academicYear.findFirst.mockResolvedValue({ activeDays: [3] }); // Wednesday only
      const wed = new Date();
      wed.setDate(wed.getDate() - (((wed.getDay() - 3) + 7) % 7));
      wed.setHours(12, 0, 0, 0);
      const sat = saturdayNoon();
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { status: 'present', attendanceSession: { scheduledDate: wed } },
          { status: 'present', attendanceSession: { scheduledDate: sat } },
        ]);

      const result: any = await service.getMine(user, schoolId, 'servant');

      expect(result.thisWeek).toMatchObject({ present: 1, total: 1 });
    });

    it('excludes soft-deleted sessions and records from ministry numbers', async () => {
      mockMinistryBaseline();
      prisma.attendanceSession.findMany.mockResolvedValue([]);

      await service.getMine(user, schoolId, 'servant');

      const sessionWhere = prisma.attendanceSession.findMany.mock.calls[0][0].where;
      expect(sessionWhere.deletedAt).toBeNull();
      expect(sessionWhere.status).toBe('scheduled');
      const allTimeCall = prisma.attendanceRecord.findMany.mock.calls[0][0];
      expect(allTimeCall.where.attendanceSession.deletedAt).toBeNull();
      const weekCall = prisma.attendanceRecord.findMany.mock.calls[1][0];
      expect(weekCall.where.attendanceSession.deletedAt).toBeNull();
    });

    it('lists upcoming sessions only, each with its curriculum subject item', async () => {
      mockMinistryBaseline();
      const future = new Date(Date.now() + 86400000);
      prisma.attendanceSession.findMany.mockResolvedValue([
        {
          id: 'sess-1', scheduledDate: future, status: 'scheduled',
          levelId: 'l1', groupId: 'g1', subjectItemId: 'si-1',
          level: { name: 'Level 1', number: 1 }, group: { name: 'Group A' },
        },
      ]);
      prisma.subjectItem.findMany.mockResolvedValue([{ id: 'si-1', name: 'Hymn One', nameAr: 'ترنيمة' }]);

      const result: any = await service.getMine(user, schoolId, 'servant');

      const where = prisma.attendanceSession.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('scheduled');
      expect(where.scheduledDate.gte).toBeInstanceOf(Date);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].subjectItem).toMatchObject({ id: 'si-1', name: 'Hymn One' });
    });

    it('falls back to the week-window allocation item when a session has none', async () => {
      mockMinistryBaseline();
      const future = new Date(Date.now() + 86400000);
      prisma.attendanceSession.findMany.mockResolvedValue([
        {
          id: 'sess-2', scheduledDate: future, status: 'scheduled',
          levelId: 'l1', groupId: 'g1', subjectItemId: null,
          level: { name: 'Level 1', number: 1 }, group: { name: 'Group A' },
        },
      ]);
      prisma.curriculumAllocation.findMany.mockResolvedValue([
        { levelId: 'l1', scheduledDate: future, lesson: { subjectItemId: 'si-2' } },
      ]);
      prisma.subjectItem.findMany.mockResolvedValue([{ id: 'si-2', name: 'Hymn Two', nameAr: null }]);

      const result: any = await service.getMine(user, schoolId, 'servant');

      expect(result.sessions[0].subjectItem).toMatchObject({ id: 'si-2', name: 'Hymn Two' });
    });
  });

  describe('getMine viewRole guard', () => {
    it('throws ForbiddenException when parent requests viewRole=admin', async () => {
      const parentUser = { id: 'user-2', roles: ['parent'] };
      await expect(service.getMine(parentUser, schoolId, 'admin')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolveServantClass', () => {
    it('derives groupIds, levelIds, and studentIds from sessions and students', async () => {
      prisma.user.findUnique.mockResolvedValue({ metadata: null });
      prisma.attendanceSession.findMany.mockResolvedValue([
        { groupId: 'g1', levelId: 'l1' },
        { groupId: 'g1', levelId: 'l2' },
        { groupId: null, levelId: null },
      ]);
      prisma.student.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

      const result = await (service as any).resolveServantClass('user-1', schoolId);

      expect(result.groupIds).toEqual(['g1']);
      expect(result.levelIds).toEqual(['l1', 'l2']);
      expect(result.studentIds).toEqual(['s1', 's2']);
      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ groupId: { in: ['g1'] } }) })
      );
    });

    it('returns empty studentIds when the servant has no groups', async () => {
      prisma.user.findUnique.mockResolvedValue({ metadata: null });
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.student.findMany.mockResolvedValue([]);
      const result = await (service as any).resolveServantClass('user-1', schoolId);
      expect(result.studentIds).toEqual([]);
    });

    it('uses the metadata group and level assignment when present', async () => {
      prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'g1', levelId: 'l1' } });
      prisma.student.findMany.mockResolvedValue([{ id: 's1' }]);
      const result = await (service as any).resolveServantClass('user-1', schoolId);
      expect(result.groupIds).toEqual(['g1']);
      expect(result.levelIds).toEqual(['l1']);
      expect(result.studentIds).toEqual(['s1']);
      expect(prisma.attendanceSession.findMany).not.toHaveBeenCalled();
    });

    it('derives students only from the assigned group', async () => {
      prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'g1' } });
      prisma.student.findMany.mockResolvedValue([{ id: 's1' }]);
      const result = await (service as any).resolveServantClass('user-1', schoolId);
      expect(result.groupIds).toEqual(['g1']);
      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ groupId: { in: ['g1'] } }) })
      );
    });
  });

  describe('findUpcomingLessons', () => {
    const mkAlloc = (id: string, title: string, date: string) => ({
      lessonId: id, scheduledDate: new Date(date), levelId: 'l1',
      lesson: { id, title, titleAr: null, titleCoptic: null, audioUrl: null, subjectItemId: null, subjectItem: null },
      level: { id: 'l1', name: 'Level 1', number: 1 },
      subject: { name: 'Hymns', color: '#D4AF37' },
    });

    it('returns every allocation in the next session week window', async () => {
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([
        mkAlloc('les-a', 'Hymn A', '2026-08-23T00:00:00Z'),
        mkAlloc('les-b', 'Hymn B', '2026-08-24T00:00:00Z'),
      ]);
      const result = await (service as any).findUpcomingLessons(['l1'], schoolId, new Date('2026-08-23T00:00:00Z'));
      const call = (prisma.curriculumAllocation.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.levelId).toEqual({ in: ['l1'] });
      expect(call.where.scheduledDate.gte).toEqual(new Date('2026-08-23T00:00:00Z'));
      expect(call.where.scheduledDate.lt).toEqual(new Date('2026-08-30T00:00:00Z'));
      expect(result.map((r: any) => r.lessonId)).toEqual(['les-a', 'les-b']);
    });

    it('anchors on the next active class day when there is no upcoming session', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({ activeDays: [6, 0] });
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
      const before = new Date();
      await (service as any).findUpcomingLessons(['l1'], schoolId, null);
      const call = (prisma.curriculumAllocation.findMany as jest.Mock).mock.calls[0][0];
      // Next Saturday or Sunday from "now", at local midnight.
      const expected = new Date(before);
      expected.setHours(0, 0, 0, 0);
      for (let i = 0; i < 7 && ![6, 0].includes(expected.getDay()); i++) {
        expected.setDate(expected.getDate() + 1);
      }
      expect(call.where.levelId).toEqual({ in: ['l1'] });
      expect(call.where.scheduledDate.gte).toEqual(expected);
      expect(call.where.scheduledDate.lt).toEqual(
        new Date(expected.getTime() + 7 * 86400000),
      );
    });

    it('follows custom active days from the academic year', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({ activeDays: [5] }); // Fridays
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
      const before = new Date();
      await (service as any).findUpcomingLessons(['l1'], schoolId, null);
      const call = (prisma.curriculumAllocation.findMany as jest.Mock).mock.calls[0][0];
      const expected = new Date(before);
      expected.setHours(0, 0, 0, 0);
      for (let i = 0; i < 7 && expected.getDay() !== 5; i++) {
        expected.setDate(expected.getDate() + 1);
      }
      expect(call.where.scheduledDate.gte).toEqual(expected);
    });

    it('returns [] when the servant has no levels', async () => {
      const result = await (service as any).findUpcomingLessons([], schoolId, new Date());
      expect(result).toEqual([]);
    });

    it('maps the subject item reference files (recording, hazzat, presentation)', async () => {
      const alloc: any = mkAlloc('les-r', 'Ref Hymn', '2026-08-23T00:00:00Z');
      alloc.lesson.subjectItem = {
        hazzat: '/uploads/h.pdf',
        presentationUrl: '/uploads/p.pptx',
        recordingUrl: '/uploads/r.mp3',
      };
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([alloc]);
      const result = await (service as any).findUpcomingLessons(['l1'], schoolId, new Date('2026-08-23T00:00:00Z'));
      expect(result[0]).toMatchObject({
        hazzat: '/uploads/h.pdf',
        presentationUrl: '/uploads/p.pptx',
        recordingUrl: '/uploads/r.mp3',
      });
    });

    it('findNextUpcomingLesson returns the first of the list', async () => {
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([
        mkAlloc('les-a', 'Hymn A', '2026-08-23T00:00:00Z'),
        mkAlloc('les-b', 'Hymn B', '2026-08-24T00:00:00Z'),
      ]);
      const result = await (service as any).findNextUpcomingLesson(['l1'], schoolId, new Date('2026-08-23T00:00:00Z'));
      expect(result).toMatchObject({ lessonId: 'les-a', title: 'Hymn A' });
    });

    it('returns null when no allocation exists anywhere', async () => {
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await (service as any).findNextUpcomingLesson(['l1'], schoolId, new Date('2026-09-10T00:00:00Z'));
      expect(result).toBeNull();
    });

    it('falls back to every allocation sharing the nearest future date', async () => {
      const futureAlloc = mkAlloc('les-f', 'Future Hymn', '2026-09-26T00:00:00Z');
      (prisma.curriculumAllocation.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // anchor week empty
        .mockResolvedValueOnce([futureAlloc, mkAlloc('les-f2', 'Future Rite', '2026-09-26T00:00:00Z')]); // same-day group
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValueOnce(futureAlloc); // nearest future
      const result = await (service as any).findUpcomingLessons(['l1'], schoolId, new Date('2026-09-10T00:00:00Z'));
      expect(result.map((r: any) => r.lessonId)).toEqual(['les-f', 'les-f2']);
      const dayCall = (prisma.curriculumAllocation.findMany as jest.Mock).mock.calls[1][0];
      // Same local-day grouping the implementation uses (TZ-robust).
      const expectedDay = new Date(new Date('2026-09-26T00:00:00Z'));
      expectedDay.setHours(0, 0, 0, 0);
      expect(dayCall.where.scheduledDate.gte).toEqual(expectedDay);
    });

    it('falls back to every allocation sharing the most recent past date', async () => {
      const pastAlloc = mkAlloc('les-p', 'Past Hymn', '2026-09-05T00:00:00Z');
      (prisma.curriculumAllocation.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // anchor week empty
        .mockResolvedValueOnce([pastAlloc]); // same-day group
      (prisma.curriculumAllocation.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // nothing future
        .mockResolvedValueOnce(pastAlloc); // most recent past
      const result = await (service as any).findUpcomingLessons(['l1'], schoolId, new Date('2026-09-10T00:00:00Z'));
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ lessonId: 'les-p', title: 'Past Hymn' });
    });
  });

  describe('getClassOverview', () => {
    function baseline() {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ metadata: null });
      (prisma.attendanceSession.findMany as jest.Mock).mockResolvedValue([{ groupId: 'g1', levelId: 'l1' }]);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', firstName: 'Mina', lastName: 'A', firstNameAr: null, lastNameAr: null, photoUrl: null },
        { id: 's2', firstName: 'John', lastName: 'B', firstNameAr: null, lastNameAr: null, photoUrl: null },
      ]);
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'), levelId: 'l1',
        level: { id: 'l1', name: 'Level 3', number: 3 }, group: { id: 'g1', name: 'Group A' },
      });
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue({
        lessonId: 'les1', scheduledDate: new Date(),
        lesson: { id: 'les1', title: 'Kyrie', titleAr: null, titleCoptic: 'ⲕⲩⲣⲓⲉ' },
        level: { id: 'l1', name: 'Level 3', number: 3 },
        subject: { name: 'Tasbeha' },
      });
      (prisma.attendanceRecord.findMany as jest.Mock).mockResolvedValue([
        { studentId: 's1', status: 'present', recordedAt: new Date(), note: null, noteCategory: null, isPrivateNote: false },
        { studentId: 's2', status: 'present', recordedAt: new Date(), note: null, noteCategory: null, isPrivateNote: false },
      ]);
      (prisma.lessonProgress.findMany as jest.Mock)
        .mockResolvedValueOnce([{ studentId: 's1', masteryStatus: 'known' }]) // for today lesson
        .mockResolvedValue([]); // overdue review scan
      (prisma.assessmentSubmission.findMany as jest.Mock).mockResolvedValue([]);
    }

    it('returns roster with today lesson and null flags when attendance is strong', async () => {
      baseline();
      const result = await service.getClassOverview(user, schoolId);
      expect(result.todayLesson.title).toBe('Kyrie');
      expect(result.nextSession.groupName).toBe('Group A');
      expect(result.roster).toHaveLength(2);
      expect(result.roster.every((r: any) => r.likelyAbsent === false)).toBe(true);
      expect(result.roster.every((r: any) => r.needsFollowUp === false)).toBe(true);
    });

    it('flags likelyAbsent when attendance rate is below 60%', async () => {
      baseline();
      (prisma.attendanceRecord.findMany as jest.Mock).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          studentId: 's1', status: i % 2 === 0 ? 'absent' : 'present',
          recordedAt: new Date(), note: null, noteCategory: null, isPrivateNote: false,
        })),
      );
      const result = await service.getClassOverview(user, schoolId);
      const mina = result.roster.find((r: any) => r.studentId === 's1');
      expect(mina.likelyAbsent).toBe(true);
    });

    it('collects follow-up reason tokens', async () => {
      baseline();
      (prisma.lessonProgress.findMany as jest.Mock)
        .mockReset()
        .mockResolvedValueOnce([{ studentId: 's1', masteryStatus: 'not_started' }]) // low mastery
        .mockResolvedValueOnce([{ studentId: 's1' }]); // overdue review
      (prisma.assessmentSubmission.findMany as jest.Mock).mockResolvedValue([{ studentId: 's1' }]); // ungraded
      const result = await service.getClassOverview(user, schoolId);
      const mina = result.roster.find((r: any) => r.studentId === 's1');
      expect(mina.followUpReasons).toEqual(expect.arrayContaining(['low_mastery', 'overdue_review', 'ungraded_assessment']));
      expect(mina.needsFollowUp).toBe(true);
    });

    it('flags absent_3plus when the last 3 attendance records are absent', async () => {
      baseline();
      const base = new Date('2026-08-19T00:00:00Z');
      (prisma.attendanceRecord.findMany as jest.Mock).mockResolvedValue(
        [0, 1, 2].map(i => ({
          studentId: 's1', status: 'absent',
          recordedAt: new Date(base.getTime() - i * 24 * 60 * 60 * 1000),
          note: null, noteCategory: null, isPrivateNote: false,
        })),
      );
      const result = await service.getClassOverview(user, schoolId);
      const mina = result.roster.find((r: any) => r.studentId === 's1');
      expect(mina.followUpReasons).toContain('absent_3plus');
      expect(mina.needsFollowUp).toBe(true);
    });

    it('returns empty roster and null today lesson when servant has no students', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ metadata: null });
      (prisma.attendanceSession.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await service.getClassOverview(user, schoolId);
      expect(result.roster).toEqual([]);
      expect(result.todayLesson).toBeNull();
      expect(result.nextSession).toBeNull();
    });
  });

  describe('getWeeklyBriefing', () => {
    function briefingBaseline() {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ metadata: null });
      (prisma.attendanceSession.findMany as jest.Mock).mockResolvedValue([{ groupId: 'g1', levelId: 'l1' }]);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([]);
    }

    it('returns coptic context, null lesson, null session, and empty roster', async () => {
      briefingBaseline();
      const result = await service.getWeeklyBriefing(user, schoolId);
      expect(result.coptic).toHaveProperty('season');
      expect(result.coptic).toHaveProperty('seasonLabel');
      expect(result.coptic).toHaveProperty('feastFast');
      expect(result.nextLesson).toBeNull();
      expect(result.nextSession).toBeNull();
      expect(result.roster).toEqual([]);
    });

    it('uses the nextSession date for coptic context and returns nextLesson + roster', async () => {
      briefingBaseline();
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'), levelId: 'l1',
        level: { id: 'l1', name: 'Level 3', number: 3 }, group: { id: 'g1', name: 'Group A' },
      });
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([{
        lessonId: 'les1', scheduledDate: new Date('2026-08-23T00:00:00Z'),
        lesson: { id: 'les1', title: 'Kyrie', titleAr: null, titleCoptic: 'ⲕⲩⲣⲓⲉ' },
        level: { id: 'l1', name: 'Level 3', number: 3 },
        subject: { name: 'Tasbeha' },
      }]);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getWeeklyBriefing(user, schoolId);
      expect(result.nextSession.groupName).toBe('Group A');
      expect(result.nextLesson.title).toBe('Kyrie');
      expect(result.nextLesson.subjectName).toBe('Tasbeha');
      expect(result.roster).toEqual([]);
    });

    it('scopes the next session query to the assigned class group', async () => {
      briefingBaseline();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ metadata: { groupId: 'g1', levelId: 'l1' } });
      await service.getWeeklyBriefing(user, schoolId);
      const call = (prisma.attendanceSession.findFirst as jest.Mock).mock.calls[0][0];
      expect(call.where.groupId).toEqual({ in: ['g1'] });
      expect(call.where.servantId).toBe('user-1');
    });

    it('returns subject color, lesson audio, and linked subject-item hazzat/presentation', async () => {
      briefingBaseline();
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'), levelId: 'l1',
        level: { id: 'l1', name: 'Level 3', number: 3 }, group: { id: 'g1', name: 'Group A' },
      });
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([{
        lessonId: 'les1', scheduledDate: new Date('2026-08-23T00:00:00Z'),
        lesson: {
          id: 'les1', title: 'Kyrie', titleAr: null, titleCoptic: 'ⲕⲩⲣⲓⲉ',
          audioUrl: '/uploads/kyrie.mp3',
          subjectItem: { hazzat: '/uploads/kyrie-hazzat.pdf', presentationUrl: '/uploads/kyrie.pptx' },
        },
        level: { id: 'l1', name: 'Level 3', number: 3 },
        subject: { name: 'Tasbeha', color: '#D4A843' },
      }]);
      const result = await service.getWeeklyBriefing(user, schoolId);
      expect(result.nextLesson.subjectColor).toBe('#D4A843');
      expect(result.nextLesson.audioUrl).toBe('/uploads/kyrie.mp3');
      expect(result.nextLesson.hazzat).toBe('/uploads/kyrie-hazzat.pdf');
      expect(result.nextLesson.presentationUrl).toBe('/uploads/kyrie.pptx');
    });

    it('returns null audio/hazzat/presentation when the subject item is absent', async () => {
      briefingBaseline();
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'), levelId: 'l1',
        level: { id: 'l1', name: 'Level 3', number: 3 }, group: { id: 'g1', name: 'Group A' },
      });
      (prisma.curriculumAllocation.findMany as jest.Mock).mockResolvedValue([{
        lessonId: 'les1', scheduledDate: new Date('2026-08-23T00:00:00Z'),
        lesson: { id: 'les1', title: 'Kyrie', titleAr: null, titleCoptic: null, subjectItem: null },
        level: { id: 'l1', name: 'Level 3', number: 3 },
        subject: { name: 'Tasbeha', color: null },
      }]);
      const result = await service.getWeeklyBriefing(user, schoolId);
      expect(result.nextLesson.subjectColor).toBeNull();
      expect(result.nextLesson.audioUrl).toBeUndefined();
      expect(result.nextLesson.hazzat).toBeNull();
      expect(result.nextLesson.presentationUrl).toBeNull();
    });

    it('shows no lesson when no allocation exists in the next session week', async () => {
      briefingBaseline();
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'), levelId: 'l1',
        level: { id: 'l1', name: 'Level 3', number: 3 }, group: { id: 'g1', name: 'Group A' },
      });
      const result = await service.getWeeklyBriefing(user, schoolId);
      expect(result.nextSession).not.toBeNull();
      expect(result.nextLesson).toBeNull();
    });
  });

  describe('follow-up checklist', () => {
    function classWith(studentIds: string[]) {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ metadata: { groupId: 'g1' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue(studentIds.map((id) => ({ id })));
    }

    it('rejects a student outside the servant class', async () => {
      classWith(['s1']);
      await expect(service.setFollowUp(user, schoolId, 'other', { done: true })).rejects.toThrow('Student not found');
      expect(prisma.servantFollowUp.upsert).not.toHaveBeenCalled();
    });

    it('persists a tick with completedAt and the note', async () => {
      classWith(['s1']);
      (prisma.servantFollowUp.upsert as jest.Mock).mockImplementation(({ create }: any) => Promise.resolve(create));
      const res = await service.setFollowUp(user, schoolId, 's1', { done: true, note: '  Called mum  ' });
      const arg = (prisma.servantFollowUp.upsert as jest.Mock).mock.calls[0][0];
      expect(arg.where).toEqual({ servantId_studentId: { servantId: 'user-1', studentId: 's1' } });
      expect(arg.update.status).toBe('done');
      expect(arg.update.note).toBe('Called mum');
      expect(res).toMatchObject({ done: true, note: 'Called mum' });
    });

    it('unticking clears completedAt and keeps the note untouched when none is sent', async () => {
      classWith(['s1']);
      (prisma.servantFollowUp.upsert as jest.Mock).mockImplementation(({ create }: any) => Promise.resolve(create));
      const res = await service.setFollowUp(user, schoolId, 's1', { done: false });
      const arg = (prisma.servantFollowUp.upsert as jest.Mock).mock.calls[0][0];
      expect(arg.update).toEqual({ status: 'open', completedAt: null });
      expect(res?.done).toBe(false);
    });

    it('roster shows a recent done follow-up as done and a stale one as open', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ metadata: { groupId: 'g1' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', firstName: 'A', lastName: 'A', firstNameAr: null, lastNameAr: null, photoUrl: null },
        { id: 's2', firstName: 'B', lastName: 'B', firstNameAr: null, lastNameAr: null, photoUrl: null },
      ]);
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attendanceRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lessonProgress.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.assessmentSubmission.findMany as jest.Mock).mockResolvedValue([]);
      const day = 24 * 60 * 60 * 1000;
      (prisma.servantFollowUp.findMany as jest.Mock).mockResolvedValue([
        { studentId: 's1', status: 'done', note: 'ok', completedAt: new Date(Date.now() - 2 * day) },
        { studentId: 's2', status: 'done', note: null, completedAt: new Date(Date.now() - 9 * day) },
      ]);
      const result = await service.getClassOverview(user, schoolId);
      const byId = Object.fromEntries(result.roster.map((r: any) => [r.studentId, r.followUp]));
      expect(byId.s1).toMatchObject({ done: true, note: 'ok' });
      expect(byId.s2).toMatchObject({ done: false });
    });
  });
});
