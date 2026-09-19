import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  const schoolId = 'school-1';
  const churchId = 'church-1';

  const prismaMock = {
    attendanceSession: { findMany: jest.fn(), count: jest.fn() },
    attendanceRecord: { findMany: jest.fn(), groupBy: jest.fn() },
    student: { findMany: jest.fn(), count: jest.fn() },
    assessmentSubmission: { count: jest.fn() },
    xPTransaction: { aggregate: jest.fn(), count: jest.fn() },
    userRole: { findMany: jest.fn(), count: jest.fn() },
    church: { findMany: jest.fn(), findUnique: jest.fn() },
    school: { findMany: jest.fn(), findUnique: jest.fn() },
    studentBadge: { count: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Set every mock to a safe default so tests only override what they need. */
  function setDefaults() {
    prismaMock.attendanceSession.findMany.mockResolvedValue([]);
    prismaMock.attendanceSession.count.mockResolvedValue(0);
    prismaMock.attendanceRecord.findMany.mockResolvedValue([]);
    prismaMock.attendanceRecord.groupBy.mockResolvedValue([]);
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.assessmentSubmission.count.mockResolvedValue(0);
    prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prismaMock.xPTransaction.count.mockResolvedValue(0);
    prismaMock.userRole.findMany.mockResolvedValue([]);
    prismaMock.userRole.count.mockResolvedValue(0);
    prismaMock.church.findMany.mockResolvedValue([]);
    prismaMock.church.findUnique.mockResolvedValue(null);
    prismaMock.school.findMany.mockResolvedValue([]);
    prismaMock.school.findUnique.mockResolvedValue(null);
    prismaMock.studentBadge.count.mockResolvedValue(0);
  }

  // ── getPriestPulse ──────────────────────────────────────────────────────

  describe('getPriestPulse', () => {
    it('returns health score, attendance rates, and signals', async () => {
      setDefaults();

      // This-week sessions: 1 session with 2 records (1 present, 1 absent) => 50%
      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([
          { id: 'sess-1', attendanceRecords: [{ status: 'present' }, { status: 'absent' }] },
        ])
        // Last-week sessions: empty
        .mockResolvedValueOnce([]);

      // No students (so no at-risk loop)
      prismaMock.student.findMany.mockResolvedValue([]);

      // Pending grading
      prismaMock.assessmentSubmission.count.mockResolvedValue(0);

      // XP this week
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 100 } });

      // Family practice
      prismaMock.xPTransaction.count.mockResolvedValue(5);

      // Active students this week
      prismaMock.attendanceRecord.groupBy.mockResolvedValue([{ studentId: 's1' }]);

      const result = await service.getPriestPulse('school-slug');

      expect(result.schoolId).toBe(schoolId);
      expect(result.pulse).toBeDefined();
      expect(result.pulse.attendanceThisWeek).toBe(50);
      expect(result.pulse.attendanceLastWeek).toBe(0);
      expect(result.pulse.attendanceTrend).toBe(50);
      expect(result.pulse.studentsAtRisk).toBe(0);
      expect(result.pulse.pendingGrading).toBe(0);
      expect(result.pulse.xpEarnedThisWeek).toBe(100);
      expect(result.pulse.familyPracticeThisWeek).toBe(5);
      expect(result.pulse.activeStudentsThisWeek).toBe(1);
      expect(result.pulse.totalStudents).toBe(0);
      expect(typeof result.pulse.healthScore).toBe('number');
      expect(result.pulse.healthScore).toBeGreaterThan(0);
      expect(result.pulse.healthScore).toBeLessThanOrEqual(100);
      expect(result.signals).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'success' }),
      ]));
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('counts at-risk students with 3 consecutive absences and emits warning signal', async () => {
      setDefaults();

      // Sessions (this week / last week)
      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([])  // this week
        .mockResolvedValueOnce([]); // last week

      // Two students: one at-risk, one not
      prismaMock.student.findMany.mockResolvedValue([
        { id: 's1', firstName: 'Mina', lastName: 'K', firstNameAr: null, lastNameAr: null },
        { id: 's2', firstName: 'Sara', lastName: 'A', firstNameAr: null, lastNameAr: null },
      ]);

      // s1: 3 consecutive absences => at-risk
      // s2: 2 absences then present => not at-risk
      prismaMock.attendanceRecord.findMany
        .mockResolvedValueOnce([{ status: 'absent' }, { status: 'absent' }, { status: 'absent' }])
        .mockResolvedValueOnce([{ status: 'absent' }, { status: 'absent' }, { status: 'present' }]);

      prismaMock.assessmentSubmission.count.mockResolvedValue(0);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.xPTransaction.count.mockResolvedValue(0);
      prismaMock.attendanceRecord.groupBy.mockResolvedValue([]);

      const result = await service.getPriestPulse(schoolId);

      expect(result.pulse.studentsAtRisk).toBe(1);
      const warningSignal = result.signals.find((s: any) => s.type === 'warning');
      expect(warningSignal).toBeDefined();
      expect(warningSignal.messageEn).toContain('1 student has missed 3+ sessions');
    });

    it('emits info signal when there are pending gradings', async () => {
      setDefaults();

      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaMock.student.findMany.mockResolvedValue([]);
      prismaMock.assessmentSubmission.count.mockResolvedValue(3);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.xPTransaction.count.mockResolvedValue(0);
      prismaMock.attendanceRecord.groupBy.mockResolvedValue([]);

      const result = await service.getPriestPulse(schoolId);

      expect(result.pulse.pendingGrading).toBe(3);
      const infoSignal = result.signals.find((s: any) => s.type === 'info');
      expect(infoSignal).toBeDefined();
      expect(infoSignal.messageEn).toContain('3 assessments are waiting to be graded');
    });

    it('emits attendance-improved signal when this week is 5%+ above last week', async () => {
      setDefaults();

      // This week: 100% attendance
      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([
          { id: 'sess-1', attendanceRecords: [{ status: 'present' }, { status: 'present' }] },
        ])
        // Last week: 50% attendance
        .mockResolvedValueOnce([
          { id: 'sess-2', attendanceRecords: [{ status: 'present' }, { status: 'absent' }] },
        ]);

      prismaMock.student.findMany.mockResolvedValue([]);
      prismaMock.assessmentSubmission.count.mockResolvedValue(0);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.xPTransaction.count.mockResolvedValue(0);
      prismaMock.attendanceRecord.groupBy.mockResolvedValue([]);

      const result = await service.getPriestPulse(schoolId);

      expect(result.pulse.attendanceTrend).toBe(50);
      const successSignal = result.signals.find(
        (s: any) => s.type === 'success' && s.messageEn.includes('Attendance improved'),
      );
      expect(successSignal).toBeDefined();
    });

    it('includes family practice signal when families practiced this week', async () => {
      setDefaults();

      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaMock.student.findMany.mockResolvedValue([]);
      prismaMock.assessmentSubmission.count.mockResolvedValue(0);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.xPTransaction.count.mockResolvedValue(2);
      prismaMock.attendanceRecord.groupBy.mockResolvedValue([]);

      const result = await service.getPriestPulse(schoolId);

      expect(result.pulse.familyPracticeThisWeek).toBe(2);
      const familySignal = result.signals.find(
        (s: any) => s.type === 'success' && s.messageEn.includes('famil'),
      );
      expect(familySignal).toBeDefined();
      expect(familySignal.messageEn).toContain('2 families practiced hymns at home');
    });

    it('caps health score at 100', async () => {
      setDefaults();

      // 100% attendance this week => 50 pts
      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([
          { id: 'sess-1', attendanceRecords: [{ status: 'present' }] },
        ])
        .mockResolvedValueOnce([]);

      prismaMock.student.findMany.mockResolvedValue([]);
      prismaMock.assessmentSubmission.count.mockResolvedValue(0); // +20 pts
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.xPTransaction.count.mockResolvedValue(1); // family practice > 0 => +10 pts
      prismaMock.attendanceRecord.groupBy.mockResolvedValue([]);
      // 0 at-risk => +20 pts; total = 100 exactly

      const result = await service.getPriestPulse(schoolId);

      expect(result.pulse.healthScore).toBeLessThanOrEqual(100);
    });
  });

  // ── getServantContributions ─────────────────────────────────────────────

  describe('getServantContributions', () => {
    const servantRoles = [
      {
        userId: 'u1',
        user: { id: 'u1', firstName: 'John', lastName: 'Doe', firstNameAr: null, lastNameAr: null, createdAt: new Date('2020-01-01') },
        role: { name: 'servant', displayName: 'Servant' },
      },
      {
        userId: 'u2',
        user: { id: 'u2', firstName: 'Mary', lastName: 'Smith', firstNameAr: 'مريم', lastNameAr: 'سميث', createdAt: new Date('2022-06-01') },
        role: { name: 'group_leader', displayName: 'Group Leader' },
      },
    ];

    it('returns servant list sorted by total sessions', async () => {
      setDefaults();

      prismaMock.userRole.findMany.mockResolvedValue(servantRoles);

      // u1: 10 total, 3 this month, 2 last month, 5 students reached
      // u2: 20 total, 5 this month, 4 last month, 8 students reached
      prismaMock.attendanceSession.count
        // u1
        .mockResolvedValueOnce(10)  // totalSessions
        .mockResolvedValueOnce(3)   // sessionsThisMonth
        .mockResolvedValueOnce(2)   // sessionsLastMonth
        // u2
        .mockResolvedValueOnce(20)  // totalSessions
        .mockResolvedValueOnce(5)   // sessionsThisMonth
        .mockResolvedValueOnce(4);  // sessionsLastMonth

      prismaMock.attendanceRecord.groupBy
        .mockResolvedValueOnce([{ studentId: 's1' }, { studentId: 's2' }, { studentId: 's3' }, { studentId: 's4' }, { studentId: 's5' }])  // u1
        .mockResolvedValueOnce([{ studentId: 's1' }, { studentId: 's2' }, { studentId: 's3' }, { studentId: 's4' }, { studentId: 's5' }, { studentId: 's6' }, { studentId: 's7' }, { studentId: 's8' }]);  // u2

      const result = await service.getServantContributions(schoolId);

      expect(result.servants).toHaveLength(2);
      // Sorted desc by totalSessions: u2 (20) first, u1 (10) second
      expect(result.servants[0].id).toBe('u2');
      expect(result.servants[0].totalSessions).toBe(20);
      expect(result.servants[0].studentsReached).toBe(8);
      expect(result.servants[1].id).toBe('u1');
      expect(result.servants[1].totalSessions).toBe(10);
      expect(result.servants[1].studentsReached).toBe(5);

      expect(result.summary.totalServants).toBe(2);
      expect(result.summary.totalSessionsAllTime).toBe(30);
      expect(result.summary.mostActiveThisMonth).toBeDefined();
      expect(result.summary.mostActiveThisMonth!.sessions).toBe(5);
    });

    it('generates appreciation messages based on session thresholds', async () => {
      setDefaults();

      prismaMock.userRole.findMany.mockResolvedValue([servantRoles[0]]);

      // u1: 120 total sessions => "over 100" appreciation
      prismaMock.attendanceSession.count
        .mockResolvedValueOnce(120)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);
      prismaMock.attendanceRecord.groupBy
        .mockResolvedValueOnce([{ studentId: 's1' }, { studentId: 's2' }]);

      const result = await service.getServantContributions(schoolId, true);

      expect(result.servants[0].appreciationEn).toContain('over 100 sessions');
      expect(result.servants[0].appreciationEn).toContain('reached 2 students');
    });

    it('excludes servants with zero sessions when includeAll is false (default)', async () => {
      setDefaults();

      prismaMock.userRole.findMany.mockResolvedValue(servantRoles);

      // u1: 5 total sessions
      // u2: 0 total sessions
      prismaMock.attendanceSession.count
        .mockResolvedValueOnce(5)   // u1 total
        .mockResolvedValueOnce(2)   // u1 this month
        .mockResolvedValueOnce(1)   // u1 last month
        .mockResolvedValueOnce(0)   // u2 total
        .mockResolvedValueOnce(0)   // u2 this month
        .mockResolvedValueOnce(0);  // u2 last month

      prismaMock.attendanceRecord.groupBy
        .mockResolvedValueOnce([{ studentId: 's1' }])  // u1
        .mockResolvedValueOnce([]);                     // u2

      const result = await service.getServantContributions(schoolId);

      // u2 excluded because totalSessions === 0
      expect(result.servants).toHaveLength(1);
      expect(result.servants[0].id).toBe('u1');
      expect(result.excludedZeroActivity).toBe(1);
    });

    it('includes zero-session servants when includeAll is true', async () => {
      setDefaults();

      prismaMock.userRole.findMany.mockResolvedValue(servantRoles);

      prismaMock.attendanceSession.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      prismaMock.attendanceRecord.groupBy
        .mockResolvedValueOnce([{ studentId: 's1' }])
        .mockResolvedValueOnce([]);

      const result = await service.getServantContributions(schoolId, true);

      expect(result.servants).toHaveLength(2);
      expect(result.excludedZeroActivity).toBe(0);
    });

    it('calculates trend as sessionsThisMonth minus sessionsLastMonth', async () => {
      setDefaults();

      prismaMock.userRole.findMany.mockResolvedValue([servantRoles[0]]);

      prismaMock.attendanceSession.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(7)   // this month
        .mockResolvedValueOnce(3);  // last month

      prismaMock.attendanceRecord.groupBy.mockResolvedValueOnce([]);

      const result = await service.getServantContributions(schoolId, true);

      expect(result.servants[0].trend).toBe(4); // 7 - 3
    });
  });

  // ── getDioceseDashboard ─────────────────────────────────────────────────

  describe('getDioceseDashboard', () => {
    it('returns church data with per-school stats', async () => {
      setDefaults();

      prismaMock.school.findMany.mockResolvedValue([
        { id: 'sch-1', name: 'St. Mark', nameAr: 'مارمرقس', slug: 'st-mark', isActive: true, createdAt: new Date() },
      ]);

      // For the single school sch-1:
      prismaMock.student.count.mockResolvedValue(25);

      // Active students groupBy
      prismaMock.attendanceRecord.groupBy.mockResolvedValue(
        [{ studentId: 's1' }, { studentId: 's2' }],
      );

      // At-risk: student.findMany returns students for the at-risk loop
      prismaMock.student.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
      ]);
      // s1: not at-risk; s2: not at-risk
      prismaMock.attendanceRecord.findMany
        .mockResolvedValueOnce([{ status: 'present' }, { status: 'present' }, { status: 'absent' }])
        .mockResolvedValueOnce([{ status: 'present' }, { status: 'late' }, { status: 'present' }]);

      // Servant count
      prismaMock.userRole.count.mockResolvedValue(3);

      // Sessions this week
      prismaMock.attendanceSession.findMany.mockResolvedValue([
        { id: 'sess-1', attendanceRecords: [{ status: 'present' }, { status: 'present' }, { status: 'late' }, { status: 'absent' }] },
      ]);

      // XP this week
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 50 } });

      // Church info
      prismaMock.church.findUnique.mockResolvedValue({ name: 'St. Mark Church', nameAr: 'كنيسة مارمرقس' });

      const result = await service.getDioceseDashboard(churchId);

      expect(result.churchId).toBe(churchId);
      expect(result.churchName).toBe('St. Mark Church');
      expect(result.churchNameAr).toBe('كنيسة مارمرقس');
      expect(result.totalSchools).toBe(1);
      expect(result.totalStudents).toBe(25);
      expect(typeof result.avgHealthScore).toBe('number');
      expect(result.totalAtRisk).toBe(0);
      expect(result.schools).toHaveLength(1);

      const sch = result.schools[0];
      expect(sch.schoolId).toBe('sch-1');
      expect(sch.schoolName).toBe('St. Mark');
      expect(sch.totalStudents).toBe(25);
      expect(sch.servantCount).toBe(3);
      expect(sch.xpThisWeek).toBe(50);
      expect(typeof sch.healthScore).toBe('number');
    });

    it('identifies best-performing school by health score', async () => {
      setDefaults();

      prismaMock.school.findMany.mockResolvedValue([
        { id: 'sch-1', name: 'School A', nameAr: 'أ', slug: 'a', isActive: true, createdAt: new Date() },
        { id: 'sch-2', name: 'School B', nameAr: 'ب', slug: 'b', isActive: true, createdAt: new Date() },
      ]);

      // For sch-1 then sch-2: student counts
      prismaMock.student.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);

      // Active students groupBy: both have some active
      prismaMock.attendanceRecord.groupBy
        .mockResolvedValueOnce([{ studentId: 's1' }])
        .mockResolvedValueOnce([]);

      // At-risk loops: no students for simplicity
      prismaMock.student.findMany
        .mockResolvedValueOnce([])   // sch-1 at-risk loop
        .mockResolvedValueOnce([]);  // sch-2 at-risk loop

      // Servant counts
      prismaMock.userRole.count
        .mockResolvedValueOnce(5)   // sch-1
        .mockResolvedValueOnce(0);  // sch-2

      // Sessions this week: sch-1 has 100% attendance, sch-2 has none
      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([
          { id: 's1', attendanceRecords: [{ status: 'present' }, { status: 'present' }] },
        ])
        .mockResolvedValueOnce([]);

      // XP
      prismaMock.xPTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      prismaMock.church.findUnique.mockResolvedValue({ name: 'Church', nameAr: 'كنيسة' });

      const result = await service.getDioceseDashboard(churchId);

      expect(result.bestPerforming).toBeDefined();
      expect(result.bestPerforming!.name).toBe('School A');
      expect(result.bestPerforming!.score).toBeGreaterThan(0);
    });

    it('returns empty schools array when church has no schools', async () => {
      setDefaults();

      prismaMock.school.findMany.mockResolvedValue([]);
      prismaMock.church.findUnique.mockResolvedValue({ name: 'Empty Church', nameAr: 'كنيسة فارغة' });

      const result = await service.getDioceseDashboard(churchId);

      expect(result.schools).toEqual([]);
      expect(result.totalSchools).toBe(0);
      expect(result.totalStudents).toBe(0);
      expect(result.avgHealthScore).toBe(0);
      expect(result.bestPerforming).toBeNull();
    });
  });

  // ── getDioceseReport ────────────────────────────────────────────────────

  describe('getDioceseReport', () => {
    it('returns aggregated stats across all churches', async () => {
      setDefaults();

      prismaMock.church.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Church One',
          nameAr: 'كنيسة واحد',
          schools: [
            { id: 'sch-1', name: 'School A', nameAr: 'أ', slug: 'a', isActive: true, createdAt: new Date() },
          ],
        },
      ]);

      // For sch-1:
      prismaMock.student.count.mockResolvedValue(15);
      prismaMock.userRole.count.mockResolvedValue(4);

      // This-week sessions
      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([
          { id: 's1', attendanceRecords: [{ status: 'present' }, { status: 'late' }] },
        ])
        // Last-week sessions
        .mockResolvedValueOnce([]);

      prismaMock.assessmentSubmission.count.mockResolvedValue(0);
      prismaMock.studentBadge.count.mockResolvedValue(2);

      // At-risk: no students
      prismaMock.student.findMany.mockResolvedValue([]);

      const result = await service.getDioceseReport();

      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.summary.totalChurches).toBe(1);
      expect(result.summary.totalSchools).toBe(1);
      expect(result.summary.totalStudents).toBe(15);
      expect(result.summary.totalServants).toBe(4);
      expect(typeof result.summary.avgAttendance).toBe('number');
      expect(typeof result.summary.dioceseHealthScore).toBe('number');
      expect(result.schools).toHaveLength(1);
      expect(result.schools[0].churchName).toBe('Church One');
      expect(result.schools[0].schoolName).toBe('School A');
      expect(result.schools[0].badgesThisWeek).toBe(2);
    });

    it('filters by churchId when provided', async () => {
      setDefaults();

      prismaMock.church.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Filtered Church',
          nameAr: 'كنيسة',
          schools: [],
        },
      ]);

      const result = await service.getDioceseReport('c1');

      expect(prismaMock.church.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'c1' }),
        }),
      );
      expect(result.summary.totalChurches).toBe(1);
      expect(result.summary.totalSchools).toBe(0);
    });

    it('flags schools with health score below 60 as needing attention', async () => {
      setDefaults();

      prismaMock.church.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Church',
          nameAr: 'كنيسة',
          schools: [
            { id: 'sch-1', name: 'Struggling School', nameAr: 'مدرسة', slug: 'struggling', isActive: true, createdAt: new Date() },
          ],
        },
      ]);

      // School stats that will yield a low health score:
      prismaMock.student.count.mockResolvedValue(10);
      prismaMock.userRole.count.mockResolvedValue(0); // no servants

      // 0% attendance this week
      prismaMock.attendanceSession.findMany
        .mockResolvedValueOnce([
          { id: 's1', attendanceRecords: [{ status: 'absent' }, { status: 'absent' }] },
        ])
        .mockResolvedValueOnce([]);

      prismaMock.assessmentSubmission.count.mockResolvedValue(5); // pending grading => reduces score
      prismaMock.studentBadge.count.mockResolvedValue(0);

      // 2 at-risk students
      prismaMock.student.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      prismaMock.attendanceRecord.findMany
        .mockResolvedValueOnce([{ status: 'absent' }, { status: 'absent' }, { status: 'absent' }])
        .mockResolvedValueOnce([{ status: 'absent' }, { status: 'absent' }, { status: 'absent' }]);

      const result = await service.getDioceseReport();

      expect(result.needsAttention.length).toBeGreaterThanOrEqual(1);
      expect(result.needsAttention[0].schoolName).toBe('Struggling School');
      expect(result.needsAttention[0].score).toBeLessThan(60);
    });
  });

  // ── getLiturgicalEngagementReport ───────────────────────────────────────

  describe('getLiturgicalEngagementReport', () => {
    it('returns season stats and monthly breakdown', async () => {
      setDefaults();

      // Every attendanceSession.findMany call (7 seasons + 12 months = 19 calls)
      // returns empty by default from setDefaults, override first season
      prismaMock.attendanceSession.findMany.mockResolvedValue([]);
      prismaMock.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      const result = await service.getLiturgicalEngagementReport(schoolId);

      expect(result.seasons).toBeDefined();
      expect(result.seasons.length).toBe(7);
      expect(result.monthly).toBeDefined();
      expect(result.monthly.length).toBe(12);

      // Each season should have expected shape
      for (const season of result.seasons) {
        expect(season).toHaveProperty('key');
        expect(season).toHaveProperty('labelEn');
        expect(season).toHaveProperty('labelAr');
        expect(season).toHaveProperty('sessions');
        expect(season).toHaveProperty('attendanceRate');
        expect(season).toHaveProperty('xpEarned');
        expect(typeof season.attendanceRate).toBe('number');
      }

      // Each monthly entry should have expected shape
      for (const m of result.monthly) {
        expect(m).toHaveProperty('month');
        expect(m).toHaveProperty('rate');
        expect(m).toHaveProperty('sessions');
      }
    });
  });
});
