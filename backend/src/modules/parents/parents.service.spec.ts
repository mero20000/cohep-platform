import { Test, TestingModule } from '@nestjs/testing';
import { ParentsService, STUDENT_SELF } from './parents.service';
import { PrismaService } from '../../database/prisma.service';
import { HymnLearningService } from '../curriculum/hymn-learning.service';

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
    student: { findFirst: jest.fn() },
    studentParent: { findUnique: jest.fn() },
    familyLiturgy: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HymnLearningService, useValue: {} },
      ],
    }).compile();
    service = module.get<ParentsService>(ParentsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    // Parent link verified.
    prisma.studentParent.findUnique.mockResolvedValue({ id: 'link1' });
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
