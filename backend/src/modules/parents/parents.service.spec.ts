import { Test, TestingModule } from '@nestjs/testing';
import { ParentsService, STUDENT_SELF } from './parents.service';
import { PrismaService } from '../../database/prisma.service';
import { HymnLearningService } from '../curriculum/hymn-learning.service';
import { AuditService } from '../audit/audit.service';
import { ChildLinkThrottleService } from './child-link-throttle.service';

describe('ParentsService getCurrentLesson', () => {
  let service: ParentsService;
  let prisma: any;

  const studentId = 'stu-1';
  const userId = 'parent-1';
  const schoolId = 'school-1';
  const academicYearId = 'ay-1';

  const student = { id: studentId, schoolId, levelId: 'level-1' };
  const academicYear = {
    id: academicYearId,
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T00:00:00Z'),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
    },
    studentParent: {
      findUnique: jest.fn(),
    },
    academicYear: {
      findFirst: jest.fn(),
    },
    curriculumAllocation: {
      findFirst: jest.fn(),
    },
    level: {
      findUnique: jest.fn(),
    },
    subjectItemLevel: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: { log: jest.fn() } },
        ChildLinkThrottleService,
        {
          provide: HymnLearningService,
          useValue: {
            getStudentHymnMap: jest.fn().mockResolvedValue([]),
            getDueForReview: jest.fn().mockResolvedValue([]),
            getStudentStats: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get(ParentsService);
    prisma = prismaMock;
    prisma.user.findUnique.mockResolvedValue({ id: userId, email: 'p@x.com' });
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.studentParent.findUnique.mockResolvedValue({ id: 'link-1' });
    prisma.academicYear.findFirst.mockResolvedValue(academicYear);
  });

  it('queries allocations allowing active AND published statuses', async () => {
    prisma.curriculumAllocation.findFirst.mockResolvedValue({
      lesson: {
        id: 'l-1', title: 'Hymn 1', sessions: [],
        level: { number: 1, name: 'Level 1' },
        subject: {},
      },
      subject: {},
    });

    await service.getCurrentLesson(studentId, userId);

    const where = prisma.curriculumAllocation.findFirst.mock.calls[0][0].where;
    expect(where.academicYearId).toBe(academicYearId);
    expect(where.levelId).toBe('level-1');
    // Should match the statuses the app actually writes (published/active), NOT a phantom 'active'-only filter.
    expect(where.status).toEqual({ in: ['active', 'published'] });
  });

  it('returns null when no current allocation exists', async () => {
    prisma.curriculumAllocation.findFirst.mockResolvedValue(null);
    prisma.level.findUnique.mockResolvedValue({ number: 1, name: 'Level 1' });
    prisma.subjectItemLevel.findMany.mockResolvedValue([]);

    const result = await service.getCurrentLesson(studentId, userId);

    expect(result).toBeNull();
  });
});
describe('ParentsService.logLiturgy re-filing after a rejection', () => {
  let service: ParentsService;
  let prisma: any;

  const prismaMock = {
    user: { findUnique: jest.fn() },
    student: { findFirst: jest.fn(), findUnique: jest.fn() },
    studentParent: { findUnique: jest.fn() },
    familyLiturgy: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: { log: jest.fn() } },
        ChildLinkThrottleService,
        { provide: HymnLearningService, useValue: {} },
      ],
    }).compile();
    service = module.get<ParentsService>(ParentsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    // Parent link verified.
    prisma.studentParent.findUnique.mockResolvedValue({ id: 'link1' });
    // logLiturgy looks up the student's schoolId directly (separately from
    // the parent-link check above) to stamp onto the FamilyLiturgy row.
    prisma.student.findUnique.mockResolvedValue({ schoolId: 'school-1' });
    prisma.familyLiturgy.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'fl1', date: new Date('2026-08-23'), ...data }),
    );
    prisma.familyLiturgy.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'fl-new', ...data }),
    );
  });

  // (studentId, date) is unique. Rejection no longer deletes the row, so without this the
  // rejected date would be blocked forever and a mistaken rejection uncorrectable.
  it('re-opens a rejected claim instead of rejecting the date forever', async () => {
    prisma.familyLiturgy.findUnique.mockResolvedValue({
      id: 'fl1', status: 'rejected', rejectionReason: 'wrong date',
    });

    const res: any = await service.logLiturgy('stu-1', '2026-08-23', 'I was there', 'parent-1');

    expect(res.status).toBe('pending');
    expect(res.reopened).toBe(true);
    const data = prisma.familyLiturgy.update.mock.calls[0][0].data;
    expect(data.rejectionReason).toBeNull();
    expect(data.rejectedAt).toBeNull();
    expect(data.rejectedBy).toBeNull();
    expect(prisma.familyLiturgy.create).not.toHaveBeenCalled();
  });

  it('still refuses a duplicate of a pending claim', async () => {
    prisma.familyLiturgy.findUnique.mockResolvedValue({ id: 'fl1', status: 'pending' });
    await expect(
      service.logLiturgy('stu-1', '2026-08-23', undefined, 'parent-1'),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('still refuses a duplicate of a verified claim', async () => {
    prisma.familyLiturgy.findUnique.mockResolvedValue({ id: 'fl1', status: 'verified' });
    await expect(
      service.logLiturgy('stu-1', '2026-08-23', undefined, 'parent-1'),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('creates a fresh claim when the date is free', async () => {
    prisma.familyLiturgy.findUnique.mockResolvedValue(null);
    const res: any = await service.logLiturgy('stu-1', '2026-08-23', undefined, 'parent-1');
    expect(res.reopened).toBe(false);
    expect(prisma.familyLiturgy.create).toHaveBeenCalled();
  });

  it('lets the student file for themselves via the STUDENT_SELF sentinel', async () => {
    prisma.familyLiturgy.findUnique.mockResolvedValue(null);
    // No parent link is consulted at all in this path.
    prisma.studentParent.findUnique.mockResolvedValue(null);

    const res: any = await service.logLiturgy('stu-1', '2026-08-23', undefined, STUDENT_SELF);

    expect(res.status).toBe('pending');
    expect(prisma.studentParent.findUnique).not.toHaveBeenCalled();
  });
});

describe('ParentsService assessments integrity', () => {
  let service: ParentsService;

  const prismaMock = {
    assessmentSubmission: { findMany: jest.fn(), create: jest.fn() },
    assessment: { findUnique: jest.fn() },
    student: { findUnique: jest.fn() },
    grade: { create: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: { log: jest.fn() } },
        ChildLinkThrottleService,
        { provide: HymnLearningService, useValue: {} },
      ],
    }).compile();
    service = module.get(ParentsService);
    jest.spyOn(service as any, 'verifyParent').mockResolvedValue(undefined);
  });

  const submission = (over: any = {}) => ({
    id: 's', assessmentId: 'a1', status: 'assigned', submissionType: 'assigned', attemptNumber: 1,
    createdAt: new Date('2026-01-01'),
    assessment: { id: 'a1', title: 'Quiz', titleAr: null, totalPoints: 10, passingScore: 6, subject: null },
    grades: [], ...over,
  });

  describe('getChildAssessments', () => {
    it('lists one entry per assessment, preferring the finished record, and scores it from the overall grade', async () => {
      prismaMock.assessmentSubmission.findMany.mockResolvedValue([
        submission({ id: 'pending', createdAt: new Date('2026-03-01') }),
        submission({
          id: 'done', status: 'completed',
          grades: [
            { questionId: 'q1', score: 4, maxScore: 5, gradedAt: new Date() },
            { questionId: null, score: 8, maxScore: 10, gradedAt: new Date() },
          ],
        }),
      ]);

      const out = await service.getChildAssessments('stu-1', 'parent-1');

      expect(prismaMock.assessmentSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'stu-1', status: { not: 'superseded' } } }),
      );
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ id: 'done', status: 'completed', score: 8, maxScore: 10, percentage: 80, passed: true });
    });

    it('keeps the parent\'s own home-practice reports as separate entries instead of competing with the assignment', async () => {
      prismaMock.assessmentSubmission.findMany.mockResolvedValue([
        submission({ id: 'report', status: 'graded', submissionType: 'parent_report', createdAt: new Date('2026-04-01'), grades: [{ questionId: null, score: 5, maxScore: 10 }] }),
        submission({ id: 'assignment', status: 'assigned' }),
      ]);

      const out = await service.getChildAssessments('stu-1', 'parent-1');

      expect(out.map((o: any) => o.id)).toEqual(['report', 'assignment']);
    });
  });

  describe('reportHomeAssessment', () => {
    const published = { id: 'a1', totalPoints: 10, passingScore: 6, title: 'Quiz', schoolId: 'school-1', status: 'published', deletedAt: null };

    it.each([
      ['an assessment from another school', { ...published, schoolId: 'other' }],
      ['an unpublished assessment', { ...published, status: 'draft' }],
      ['a deleted assessment', { ...published, deletedAt: new Date() }],
      ['an assessment that does not exist', null],
    ])('refuses %s', async (_label, assessment) => {
      prismaMock.assessment.findUnique.mockResolvedValue(assessment);
      prismaMock.student.findUnique.mockResolvedValue({ schoolId: 'school-1' });

      await expect(service.reportHomeAssessment('stu-1', 'a1', 5, undefined, 'parent-1')).rejects.toThrow('Assessment not found');
      expect(prismaMock.assessmentSubmission.create).not.toHaveBeenCalled();
    });

    it('records a report for a published assessment in the child\'s school', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue(published);
      prismaMock.student.findUnique.mockResolvedValue({ schoolId: 'school-1' });
      prismaMock.assessmentSubmission.create.mockResolvedValue({ id: 'new' });

      const res = await service.reportHomeAssessment('stu-1', 'a1', 7, 'went well', 'parent-1');

      expect(prismaMock.assessmentSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ submissionType: 'parent_report', status: 'graded' }) }),
      );
      expect(res).toMatchObject({ id: 'new', score: 7, percentage: 70, passed: true });
    });
  });
});
