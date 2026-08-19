import { Test, TestingModule } from '@nestjs/testing';
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
    curriculumAllocation: { findFirst: jest.fn() },
    lessonProgress: { findMany: jest.fn() },
    assessmentSubmission: { findMany: jest.fn() },
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
  }

  describe('getMine ministry view — thisWeek', () => {
    it('returns status counts for records in the current Sat-Sun window', async () => {
      mockMinistryBaseline();
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([]) // all-time attendanceRecords (existing stat)
        .mockResolvedValueOnce([
          { status: 'present' },
          { status: 'present' },
          { status: 'late' },
          { status: 'absent' },
          { status: 'excused' },
        ]); // weekRecords (new)

      const result: any = await service.getMine(user, schoolId, 'servant');

      expect(result.thisWeek).toEqual({
        present: 2,
        late: 1,
        absent: 1,
        excused: 1,
        total: 5,
        attendanceRate: 60,
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
  });

  describe('resolveServantClass', () => {
    it('derives groupIds, levelIds, and studentIds from sessions and students', async () => {
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
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      prisma.student.findMany.mockResolvedValue([]);
      const result = await (service as any).resolveServantClass('user-1', schoolId);
      expect(result.studentIds).toEqual([]);
    });
  });

  describe('getClassOverview', () => {
    function baseline() {
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

    it('returns empty roster and null today lesson when servant has no students', async () => {
      (prisma.attendanceSession.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await service.getClassOverview(user, schoolId);
      expect(result.roster).toEqual([]);
      expect(result.todayLesson).toBeNull();
      expect(result.nextSession).toBeNull();
    });
  });
});
