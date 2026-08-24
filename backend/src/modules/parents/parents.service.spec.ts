import { Test, TestingModule } from '@nestjs/testing';
import { ParentsService } from './parents.service';
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