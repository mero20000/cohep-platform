import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { CreateAssessmentDto, CreateQuestionDto } from './dto/assessment.dto';
import { validate } from 'class-validator';

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let prisma: any;
  let resolver: any;

  const schoolId = 'school-1';

  const baseDto: CreateAssessmentDto = {
    title: 'Midterm',
    levelId: 'level-1',
    subjectId: 'subject-1',
    totalPoints: 100,
    passingPoints: 60,
  };

  const prismaMock = {
    $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
    assessment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    assessmentQuestion: {
      deleteMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    assessmentSubmission: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
      ],
    }).compile();

    service = module.get(AssessmentsService);
    prisma = prismaMock;
    resolver = module.get(SchoolResolver);
  });

  describe('create', () => {
    it('persists referenceRecordingUrl on create', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });

      await service.create(
        {
          ...baseDto,
          referenceRecordingUrl: 'https://x/rec.mp3',
          referenceRecordingName: 'Rec',
        },
        'school-1',
      );

      expect(prisma.assessment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceRecordingUrl: 'https://x/rec.mp3',
            referenceRecordingName: 'Rec',
          }),
        }),
      );
    });

    it('sets referenceRecording fields to null when omitted', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a2' });

      await service.create({ ...baseDto }, 'school-1');

      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.referenceRecordingUrl).toBeNull();
      expect(data.referenceRecordingName).toBeNull();
    });

    it('persists the provided type', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });

      await service.create({ ...baseDto, type: 'exam' }, 'school-1');

      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.type).toBe('exam');
    });

    it('defaults type to quiz when omitted', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });

      await service.create({ ...baseDto }, 'school-1');

      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.type).toBe('quiz');
    });
  });

  describe('findAll', () => {
    it('filters by type', async () => {
      prisma.assessment.findMany.mockResolvedValue([]);
      prisma.assessment.count.mockResolvedValue(0);

      await service.findAll('school-1', { type: 'exam' });

      const where = prisma.assessment.findMany.mock.calls[0][0].where;
      expect(where.type).toBe('exam');
    });
  });

  describe('update', () => {
    it('persists referenceRecordingUrl on update', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });

      await service.update('a1', {
        totalPoints: 100,
        passingPoints: 60,
        referenceRecordingUrl: 'https://x/rec2.mp3',
        referenceRecordingName: 'Rec2',
      });

      expect(prisma.assessment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceRecordingUrl: 'https://x/rec2.mp3',
            referenceRecordingName: 'Rec2',
          }),
        }),
      );
    });

    it('persists the provided type', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });

      await service.update('a1', { totalPoints: 100, passingPoints: 60, type: 'exam' });

      const data = prisma.assessment.update.mock.calls[0][0].data;
      expect(data.type).toBe('exam');
    });

    it('throws NotFoundException for unknown assessment', async () => {
      prisma.assessment.findUnique.mockResolvedValue(null);

      await expect(
        service.update('a1', { totalPoints: 100, passingPoints: 60, title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts questions preserving existing ids', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100 });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });
      prisma.assessmentQuestion.update.mockResolvedValue({});
      prisma.assessmentQuestion.create.mockResolvedValue({});
      prisma.assessmentQuestion.deleteMany.mockResolvedValue({});

      await service.update('a1', {
        totalPoints: 100,
        passingPoints: 60,
        questions: [
          { id: 'q1', text: 'Kept', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 50, orderIndex: 0 },
          { text: 'New', type: 'true_false', correctAnswer: 'true', points: 50, orderIndex: 1 },
        ],
      });

      expect(prisma.assessmentQuestion.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'q1' } }),
      );
      expect(prisma.assessmentQuestion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assessmentId: 'a1', questionText: 'New' }) }),
      );
    });

    it('does not delete questions that have grades', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100 });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });
      prisma.assessmentQuestion.update.mockResolvedValue({});
      prisma.assessmentQuestion.create.mockResolvedValue({});
      prisma.assessmentQuestion.deleteMany.mockResolvedValue({});

      await service.update('a1', {
        totalPoints: 100,
        passingPoints: 60,
        questions: [
          { id: 'q1', text: 'Kept', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 100, orderIndex: 0 },
        ],
      });

      // keptIds = ['q1']; deleteMany must exclude q1 and only target questions with no grades
      const args = prisma.assessmentQuestion.deleteMany.mock.calls[0][0];
      expect(args.where.assessmentId).toBe('a1');
      expect(args.where.id.notIn).toEqual(['q1']);
      expect(args.where.grades.none).toEqual({});
    });
  });

  describe('create validation', () => {
    it('throws when question points exceed totalPoints', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      await expect(
        service.create(
          {
            ...baseDto,
            totalPoints: 10,
            questions: [
              { text: 'A', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 20, orderIndex: 0 },
            ],
          },
          'school-1',
        ),
      ).rejects.toThrow('exceed total points');
    });

    it('throws when multiple-choice correctAnswer is not an option', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      await expect(
        service.create(
          {
            ...baseDto,
            questions: [
              { text: 'A', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'Z', points: 10, orderIndex: 0 },
            ],
          },
          'school-1',
        ),
      ).rejects.toThrow('Correct answer must be one of the options');
    });
  });

  describe('submit validation', () => {
    it('rejects a duplicate submission', async () => {
      prisma.assessment.findUnique.mockResolvedValue({
        id: 'a1', deletedAt: null, status: 'published', questions: [],
      });
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'submitted' });

      await expect(
        service.submit('a1', 'stu-1', { answers: [] }),
      ).rejects.toThrow('already submitted');
    });
  });

  describe('markStudent validation', () => {
    it('throws when score exceeds maxScore', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null, totalPoints: 100 });
      prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
      prisma.assessmentSubmission.create.mockResolvedValue({ id: 's1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

      await expect(
        service.markStudent('a1', 'stu-1', 90, 80, 'ok', 'u1'),
      ).rejects.toThrow('score cannot exceed maxScore');
    });
  });
});

describe('DTO validation', () => {
  it('accepts a question with an optional id', async () => {
    const q = new CreateQuestionDto();
    q.id = '550e8400-e29b-41d4-a716-446655440000';
    q.text = 'Q1';
    q.type = 'multiple_choice';
    q.options = ['A', 'B'];
    q.correctAnswer = 'A';
    q.points = 10;
    q.orderIndex = 0;
    const errors = await validate(q);
    expect(errors).toHaveLength(0);
  });

  it.each(['quiz', 'test', 'exam', 'oral', 'homework'])('accepts type %s', async (t) => {
    const dto = new CreateAssessmentDto();
    (dto as any).type = t;
    const errors = await validate(dto as any);
    expect(errors.filter(e => e.property === 'type')).toHaveLength(0);
  });

  it('rejects an invalid type', async () => {
    const dto = new CreateAssessmentDto();
    (dto as any).type = 'general';
    const errors = await validate(dto as any);
    expect(errors.filter(e => e.property === 'type').length).toBeGreaterThan(0);
  });
});
