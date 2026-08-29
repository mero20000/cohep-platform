import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { CreateAssessmentDto, CreateQuestionDto } from './dto/assessment.dto';
import { validate } from 'class-validator';

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let prisma: any;
  let resolver: any;
  let audit: any;

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
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    grade: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(AssessmentsService);
    prisma = prismaMock;
    resolver = module.get(SchoolResolver);
    audit = module.get(AuditService);
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

    it('persists durationMinutes into metadata on create', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });
      await service.create({ ...baseDto, durationMinutes: 45 }, 'school-1');
      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.metadata.durationMinutes).toBe(45);
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

    it('persists durationMinutes into metadata on update', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, totalPoints: 100 });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });
      await service.update('a1', { totalPoints: 100, passingPoints: 60, durationMinutes: 30 });
      const data = prisma.assessment.update.mock.calls[0][0].data;
      expect(data.metadata.durationMinutes).toBe(30);
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

  describe('submit assignment', () => {
    it('rejects when the student is not assigned', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', status: 'published', deletedAt: null, questions: [] });
      prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
      await expect(service.submit('a1', 'stu-1', { answers: [] })).rejects.toThrow('not assigned');
    });

    it('does not create a grade row for essay questions', async () => {
      prisma.assessment.findUnique.mockResolvedValue({
        id: 'a1', status: 'published', deletedAt: null,
        questions: [
          { id: 'q1', type: 'essay', correctAnswer: null, points: 10 },
        ],
      });
      // submit() fills in the assigned attempt row rather than inserting beside it.
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });
      prisma.assessmentSubmission.update.mockResolvedValue({ id: 'sub1' });
      prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 'sub1', grades: [], student: null });
      prisma.grade.createMany = jest.fn().mockResolvedValue({ count: 0 });

      await service.submit('a1', 'stu-1', { answers: [{ questionId: 'q1', answer: 'My essay' }] });

      expect(prisma.grade.createMany).not.toHaveBeenCalled();
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

  describe('getTakeQuestions', () => {
    const pubAssess = (over: any = {}) => ({
      id: 'a1', title: 'Quiz', titleAr: null, type: 'quiz', status: 'published',
      totalPoints: 10, passingScore: 5, dueDate: null,
      metadata: { durationMinutes: 30 },
      subject: { id: 'sub1', name: 'Hymns', nameAr: null },
      questions: [
        { id: 'q1', questionText: 'What?', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 5, orderIndex: 0 },
        { id: 'q2', questionText: 'Explain', type: 'essay', options: null, correctAnswer: null, points: 5, orderIndex: 1 },
      ],
      ...over,
    });

    it('returns questions without correctAnswer and the assessment header', async () => {
      prisma.assessment.findUnique.mockResolvedValue(pubAssess());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned' });

      const res = await service.getTakeQuestions('a1', 'stu-1');

      expect(res.assessment.durationMinutes).toBe(30);
      expect(res.questions).toHaveLength(2);
      expect(res.questions[0]).toEqual({
        id: 'q1', text: 'What?', type: 'multiple_choice', options: ['A', 'B'], points: 5, orderIndex: 0,
      });
      expect(JSON.stringify(res.questions)).not.toContain('correctAnswer');
    });

    it('throws BadRequestException when not published', async () => {
      prisma.assessment.findUnique.mockResolvedValue(pubAssess({ status: 'draft' }));
      await expect(service.getTakeQuestions('a1', 'stu-1')).rejects.toThrow('not open');
    });

    it('throws BadRequestException when the student is not assigned', async () => {
      prisma.assessment.findUnique.mockResolvedValue(pubAssess());
      prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
      await expect(service.getTakeQuestions('a1', 'stu-1')).rejects.toThrow('not assigned');
    });

    it('throws BadRequestException when already completed', async () => {
      prisma.assessment.findUnique.mockResolvedValue(pubAssess());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed' });
      await expect(service.getTakeQuestions('a1', 'stu-1')).rejects.toThrow('already submitted');
    });
  });
  describe('proxy submit audit + RBAC', () => {
    const staffAssess = () => ({
      id: 'a1', schoolId: 'school-1', status: 'published', deletedAt: null, questions: [],
    });

    it('writes a PROXY_SUBMIT audit row on proxied submit', async () => {
      prisma.assessment.findUnique.mockResolvedValue(staffAssess());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });
      prisma.assessmentSubmission.update.mockResolvedValue({ id: 'sub9' });
      prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 'sub9', grades: [], student: null });

      await service.submit('a1', 'stu-1', { answers: [] }, { id: 'staff-1', schoolId: 'school-1' });

      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        schoolId: 'school-1',
        userId: 'staff-1',
        action: 'PROXY_SUBMIT',
        entityType: 'assessment_submission',
        entityId: 'sub9',
        newValues: { studentId: 'stu-1', assessmentId: 'a1' },
      }));
    });

    it('rejects a non-staff role for the staff-only submit route (RolesGuard)', () => {
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue([...STAFF_ROLES]) } as any;
      const guard = new RolesGuard(reflector);
      expect(
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['parent'] } }) }),
          getHandler: () => undefined,
          getClass: () => undefined,
        } as any),
      ).toBe(false);
    });

    it('allows a staff role for the submit route (RolesGuard)', () => {
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue([...STAFF_ROLES]) } as any;
      const guard = new RolesGuard(reflector);
      expect(
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['servant'] } }) }),
          getHandler: () => undefined,
          getClass: () => undefined,
        } as any),
      ).toBe(true);
    });
  });

  describe('due date enforcement', () => {
    const yesterday = () => new Date(Date.now() - 86_400_000);

    const overdueAssess = (allowLate: boolean) => ({
      id: 'a1', schoolId: 'school-1', status: 'published', deletedAt: null,
      questions: [], dueDate: yesterday(), allowLateSubmission: allowLate,
    });

    it('refuses a late submission when allowLateSubmission is false', async () => {
      prisma.assessment.findUnique.mockResolvedValue(overdueAssess(false));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });

      await expect(service.submit('a1', 'stu-1', { answers: [] })).rejects.toThrow(
        /late submissions are not allowed/,
      );
    });

    it('accepts a late submission and stamps isLate when allowLateSubmission is true', async () => {
      prisma.assessment.findUnique.mockResolvedValue(overdueAssess(true));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });
      prisma.assessmentSubmission.update.mockResolvedValue({ id: 's1' });
      prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 's1', grades: [], student: null });

      await service.submit('a1', 'stu-1', { answers: [] });

      expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isLate: true }) }),
      );
    });

    it('does not mark a submission late when there is no due date', async () => {
      prisma.assessment.findUnique.mockResolvedValue({
        id: 'a1', schoolId: 'school-1', status: 'published', deletedAt: null,
        questions: [], dueDate: null, allowLateSubmission: false,
      });
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });
      prisma.assessmentSubmission.update.mockResolvedValue({ id: 's1' });
      prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 's1', grades: [], student: null });

      await service.submit('a1', 'stu-1', { answers: [] });

      expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isLate: false }) }),
      );
    });
  });

  describe('prepareRetake', () => {
    const retakeable = (over: any = {}) => ({
      id: 'a1', status: 'published', deletedAt: null, maxAttempts: null,
      questions: [{ id: 'q1', type: 'multiple_choice' }],
      ...over,
    });

    // The previous guard tested `grade.score === null`, which is unreachable: Grade.score
    // is a non-nullable Decimal. Grading-in-progress is the 'submitted' status.
    it('refuses a retake while the attempt is submitted but not yet marked', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'submitted', attemptNumber: 1 });

      await expect(service.prepareRetake('a1', 'stu-1')).rejects.toThrow(
        /grading is in progress/,
      );
    });

    it('reuses an already-open attempt instead of opening a second one', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 2 });

      const res = await service.prepareRetake('a1', 'stu-1');

      expect(res.newSubmissionId).toBe('s1');
      expect(prisma.assessmentSubmission.create).not.toHaveBeenCalled();
    });

    it('archives the prior attempt and increments the attempt number', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.assessmentSubmission.count.mockResolvedValue(1);
      prisma.assessmentSubmission.create.mockResolvedValue({ id: 's2', attemptNumber: 2 });

      const res = await service.prepareRetake('a1', 'stu-1');

      expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'superseded' },
      });
      expect(prisma.assessmentSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'assigned', attemptNumber: 2 }),
        }),
      );
      expect(res.attemptNumber).toBe(2);
    });

    it('refuses a retake once maxAttempts is used up', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ maxAttempts: 2 }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's2', status: 'completed', attemptNumber: 2 });
      prisma.assessmentSubmission.count.mockResolvedValue(2);

      await expect(service.prepareRetake('a1', 'stu-1')).rejects.toThrow(
        /No attempts remaining/,
      );
    });

    it('reports remaining attempts when a cap is set', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ maxAttempts: 3 }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.assessmentSubmission.count.mockResolvedValue(1);
      prisma.assessmentSubmission.create.mockResolvedValue({ id: 's2', attemptNumber: 2 });

      const res = await service.prepareRetake('a1', 'stu-1');

      expect(res.attemptsRemaining).toBe(1);
    });
  });

  describe('getSubmissionReview', () => {
    const review = (status: string, grades: any[]) => ({
      id: 'sub1', studentId: 'stu-1', assessmentId: 'a1', status,
      submissionContent: JSON.stringify([{ questionId: 'q1', answer: 'B' }]),
      submittedAt: new Date(), fileUrl: null, durationSeconds: null, isLate: false,
      metadata: null,
      assessment: {
        id: 'a1', title: 'Quiz', titleAr: null, type: 'quiz',
        totalPoints: 10, passingScore: 5,
        questions: [{ id: 'q1', questionText: 'Q?', type: 'multiple_choice', options: ['A', 'B'], points: 10, correctAnswer: 'B' }],
      },
      grades,
    });

    // Reachable directly with a known submission id, so it must not leak the key early.
    it('withholds the answer key and the score until marking is complete', async () => {
      prisma.assessmentSubmission.findFirst.mockResolvedValue(
        review('submitted', [{ questionId: 'q1', score: 10, maxScore: 10, feedback: null, feedbackAr: null }]),
      );

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.gradingComplete).toBe(false);
      expect(res.grade.earned).toBeNull();
      expect(res.grade.percentage).toBeNull();
      expect(res.questions[0].correctAnswer).toBeNull();
      expect(res.questions[0].score).toBeNull();
    });

    it('releases the answer key once marking is complete', async () => {
      prisma.assessmentSubmission.findFirst.mockResolvedValue(
        review('completed', [{ questionId: 'q1', score: 10, maxScore: 10, feedback: null, feedbackAr: null }]),
      );

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.gradingComplete).toBe(true);
      expect(res.questions[0].correctAnswer).toBe('B');
      expect(res.grade.percentage).toBe(100);
    });

    // The servant's overall row and the per-question auto-grades used to be summed
    // together, which double-counted and pushed the percentage past 100.
    it('treats a servant overall mark as authoritative rather than summing it in', async () => {
      prisma.assessmentSubmission.findFirst.mockResolvedValue(
        review('completed', [
          { questionId: 'q1', score: 10, maxScore: 10, feedback: null, feedbackAr: null },
          { questionId: null, score: 8, maxScore: 10, feedback: 'good', feedbackAr: null },
        ]),
      );

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.earned).toBe(8);
      expect(res.grade.percentage).toBe(80);
    });

    it('never reports a percentage above 100', async () => {
      prisma.assessmentSubmission.findFirst.mockResolvedValue(
        review('completed', [{ questionId: null, score: 25, maxScore: 10, feedback: null, feedbackAr: null }]),
      );

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.percentage).toBe(100);
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

  it('accepts durationMinutes', async () => {
    const dto = new CreateAssessmentDto();
    (dto as any).title = 'Quiz';
    (dto as any).levelId = 'fa4c1d37-6f2c-4fdb-b30e-4eb6d9e03395';
    (dto as any).subjectId = '7587acbb-92bd-4557-b2b2-9d217d3b34c1';
    (dto as any).totalPoints = 10;
    (dto as any).passingPoints = 5;
    (dto as any).durationMinutes = 30;
    const errors = await validate(dto as any);
    expect(errors).toEqual([]);
  });

  it('rejects a negative durationMinutes', async () => {
    const dto = new CreateAssessmentDto();
    (dto as any).title = 'Quiz';
    (dto as any).levelId = 'fa4c1d37-6f2c-4fdb-b30e-4eb6d9e03395';
    (dto as any).subjectId = '7587acbb-92bd-4557-b2b2-9d217d3b34c1';
    (dto as any).totalPoints = 10;
    (dto as any).passingPoints = 5;
    (dto as any).durationMinutes = -5;
    const errors = await validate(dto as any);
    expect(errors.length).toBeGreaterThan(0);
  });
});
