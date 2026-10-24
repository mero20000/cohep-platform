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
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let prisma: any;
  let resolver: any;
  let audit: any;
  let notifier: any;

  const schoolId = 'school-1';

  const baseDto: CreateAssessmentDto = {
    title: 'Midterm',
    levelId: 'level-1',
    subjectId: 'subject-1',
    totalPoints: 100,
    passingPoints: 60,
  };

  const prismaMock = {
    $transaction: jest.fn(async (arg: any) => Array.isArray(arg) ? Promise.all(arg) : arg(prismaMock)),
    assessment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    assessmentQuestion: {
      findMany: jest.fn(),
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
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    student: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    notification: {
      upsert: jest.fn(),
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
        { provide: StudentNotificationsService, useValue: { notify: jest.fn().mockResolvedValue(null), notifyOrRefresh: jest.fn().mockResolvedValue(null) } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(AssessmentsService);
    prisma = prismaMock;
    resolver = module.get(SchoolResolver);
    audit = module.get(AuditService);
    notifier = module.get(StudentNotificationsService);
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

    it.each([false, true])(
      'accepts a past-due submission and stamps isLate (allowLateSubmission=%s)',
      async (allowLate) => {
        prisma.assessment.findUnique.mockResolvedValue(overdueAssess(allowLate));
        prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });
        prisma.assessmentSubmission.update.mockResolvedValue({ id: 's1' });
        prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 's1', grades: [], student: null });

        await service.submit('a1', 'stu-1', { answers: [] });

        expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ isLate: true }) }),
        );
      },
    );

    it('keeps the return history when a resubmission carries student notes', async () => {
      prisma.assessment.findUnique.mockResolvedValue(overdueAssess(true));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({
        id: 's1', status: 'assigned', attemptNumber: 1, metadata: { returns: [{ note: 'redo Q2' }] },
      });
      prisma.assessmentSubmission.update.mockResolvedValue({ id: 's1' });
      prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 's1', grades: [], student: null });

      await service.submit('a1', 'stu-1', { answers: [], notes: 'fixed it' });

      expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: { returns: [{ note: 'redo Q2' }], notes: 'fixed it' } }),
        }),
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

  describe('pending review', () => {
    const admin = { id: 'admin-1', roles: ['super_admin'] };
    const servant = { id: 'srv-1', roles: ['servant'] };

    const row = (over: any = {}) => ({
      id: 'sub-1', submittedAt: new Date('2026-01-01'), isLate: true, attemptNumber: 1,
      submissionContent: JSON.stringify([{ questionId: 'q1', answer: 'B' }]),
      student: {
        id: 'stu-1', firstName: 'Robin', lastName: 'Amir', studentCode: 'S1',
        level: { id: 'l1', name: 'Level 1' }, group: { id: 'g1', name: 'Group 1B' }, grade: { name: 'Grade 6' },
      },
      assessment: {
        id: 'a1', title: 'Quiz', titleAr: null, type: 'quiz', dueDate: null, totalPoints: 10,
        questions: [
          { id: 'q1', questionText: 'Pick', type: 'mcq', points: 5, correctAnswer: 'B', orderIndex: 0 },
          { id: 'q2', questionText: 'Explain', type: 'essay', points: 5, correctAnswer: '', orderIndex: 1 },
        ],
      },
      grades: [{ questionId: 'q1', score: 5 }],
      ...over,
    });

    describe('getPendingReview', () => {
      it('gives admins every live submitted row, mapping answers, auto score and essay flag', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([row()]);

        const result = await service.getPendingReview('school-1', admin);

        expect(prisma.assessmentSubmission.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: 'submitted',
              assessment: { schoolId, deletedAt: null },
              student: { deletedAt: null },
            }),
          }),
        );
        expect(result[0]).toMatchObject({
          submissionId: 'sub-1', isLate: true, hasEssay: true, autoScore: 5,
          student: { firstName: 'Robin', groupName: 'Group 1B', gradeName: 'Grade 6' },
          assessment: { id: 'a1', totalPoints: 10 },
        });
        expect(result[0].answers[0]).toMatchObject({ answer: 'B', awarded: 5, correctAnswer: 'B' });
        expect(result[0].answers[1]).toMatchObject({ answer: null, awarded: null, correctAnswer: null });
      });

      it('limits a servant to the group and level on their profile', async () => {
        prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'g1', levelId: 'l1', teachingGender: 'both' } });
        prisma.assessmentSubmission.findMany.mockResolvedValue([row()]);

        await service.getPendingReview('school-1', servant);

        expect(prisma.assessmentSubmission.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ student: { deletedAt: null, groupId: 'g1', levelId: 'l1' } }),
          }),
        );
      });

      it('shows a non-admin with no group or level nothing rather than everything', async () => {
        prisma.user.findUnique.mockResolvedValue({ metadata: {} });

        const result = await service.getPendingReview('school-1', servant);

        expect(result).toEqual([]);
        expect(prisma.assessmentSubmission.findMany).not.toHaveBeenCalled();
      });

      it('includes the student recording, notes, the reference recording and answers to since-removed questions', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          row({
            fileUrl: 'https://cdn/rec.webm', fileType: 'audio/webm', durationSeconds: 42,
            metadata: { notes: 'Sorry, noisy room', returns: [] },
            submissionContent: JSON.stringify([
              { questionId: 'q1', answer: 'B' },
              { questionId: 'gone', answer: 'old answer' },
            ]),
            assessment: {
              ...row().assessment,
              referenceRecordingUrl: 'https://cdn/ref.mp3', referenceRecordingName: 'Reference',
            },
          }),
        ]);

        const [r] = await service.getPendingReview('school-1', admin);

        expect(r.recording).toEqual({ url: 'https://cdn/rec.webm', type: 'audio/webm', durationSeconds: 42 });
        expect(r.notes).toBe('Sorry, noisy room');
        expect(r.assessment.referenceRecordingUrl).toBe('https://cdn/ref.mp3');
        expect(r.extraAnswers).toEqual([{ questionId: 'gone', answer: 'old answer' }]);
      });

      it('reports no recording or notes for a plain typed submission', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([row({ fileUrl: null, metadata: null })]);

        const [r] = await service.getPendingReview('school-1', admin);

        expect(r.recording).toBeNull();
        expect(r.notes).toBeNull();
        expect(r.extraAnswers).toEqual([]);
      });

      it('survives unparseable submission content', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([row({ submissionContent: 'not json' })]);

        const result = await service.getPendingReview('school-1', admin);

        expect(result[0].answers.every((a: any) => a.answer === null)).toBe(true);
      });
    });

    describe('getPendingReviewCount', () => {
      it('returns the count and the oldest waiting submission', async () => {
        prisma.assessmentSubmission.count.mockResolvedValue(3);
        prisma.assessmentSubmission.findFirst.mockResolvedValue({ submittedAt: new Date('2026-01-01') });

        const result = await service.getPendingReviewCount('school-1', admin);

        expect(result).toEqual({ count: 3, oldestSubmittedAt: new Date('2026-01-01') });
      });

      it('reports zero for an unscoped non-admin', async () => {
        prisma.user.findUnique.mockResolvedValue({ metadata: null });
        expect(await service.getPendingReviewCount('school-1', servant)).toEqual({ count: 0, oldestSubmittedAt: null });
      });
    });

    describe('acceptAutoScores', () => {
      const sub = (over: any = {}) => ({
        id: 'sub-1', assessmentId: 'a1', studentId: 'stu-1', status: 'submitted',
        assessment: { id: 'a1', totalPoints: 10, questions: [{ type: 'multiple_choice' }] },
        grades: [{ questionId: 'q1', score: 4 }, { questionId: 'q2', score: 3 }, { questionId: null, score: 99 }],
        ...over,
      });

      it('refuses submissions that contain an essay', async () => {
        prisma.assessmentSubmission.findFirst.mockResolvedValue(
          sub({ assessment: { id: 'a1', totalPoints: 10, questions: [{ type: 'essay' }] } }),
        );
        const spy = jest.spyOn(service, 'markStudent');

        const result = await service.acceptAutoScores('school-1', ['sub-1'], admin);

        expect(result).toMatchObject({ accepted: 0, failed: 1 });
        expect(result.results[0].error).toMatch(/essay/);
        expect(spy).not.toHaveBeenCalled();
      });

      it.each([
        ['a recording', { fileUrl: 'https://cdn/rec.webm' }],
        ['no questions', { assessment: { id: 'a1', totalPoints: 10, questions: [] } }],
      ])('refuses a submission with %s', async (_label, over) => {
        prisma.assessmentSubmission.findFirst.mockResolvedValue(sub(over));
        const spy = jest.spyOn(service, 'markStudent');

        const result = await service.acceptAutoScores('school-1', ['sub-1'], admin);

        expect(result).toMatchObject({ accepted: 0, failed: 1 });
        expect(result.results[0].error).toMatch(/manual marking/);
        expect(spy).not.toHaveBeenCalled();
      });

      it('marks with the sum of question grades only, and reports rows no longer awaiting review', async () => {
        prisma.assessmentSubmission.findFirst
          .mockResolvedValueOnce(sub())
          .mockResolvedValueOnce(null);
        const spy = jest.spyOn(service, 'markStudent').mockResolvedValue({} as any);

        const result = await service.acceptAutoScores('school-1', ['sub-1', 'sub-2'], admin);

        expect(spy).toHaveBeenCalledWith('a1', 'stu-1', 7, 10, undefined, 'admin-1', expect.objectContaining({ viaAutoAccept: true }));
        expect(result).toMatchObject({ accepted: 1, failed: 1 });
      });
    });

    describe('returnSubmission', () => {
      const assessment = { id: 'a1', schoolId, title: 'Quiz', titleAr: null, deletedAt: null };

      it('reopens a submitted attempt, keeps a history entry and notifies the student', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessment);
        prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'submitted', attemptNumber: 1, metadata: null });
        prisma.assessmentSubmission.update.mockResolvedValue({ id: 'sub-1', status: 'assigned' });

        await service.returnSubmission('a1', 'stu-1', 'Please redo Q2', admin);

        expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'assigned',
              metadata: { returns: [expect.objectContaining({ note: 'Please redo Q2', by: 'admin-1' })] },
            }),
          }),
        );
        expect(notifier.notifyOrRefresh).toHaveBeenCalledWith(
          expect.objectContaining({ studentId: 'stu-1', type: 'assessment_returned' }),
        );
      });

      it('refuses anything that is not awaiting review', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessment);
        prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'completed', attemptNumber: 1 });

        await expect(service.returnSubmission('a1', 'stu-1', undefined, admin)).rejects.toThrow(/awaiting review/);
        expect(prisma.assessmentSubmission.update).not.toHaveBeenCalled();
      });
    });

    describe('markStudent with per-question scores', () => {
      const assessment = {
        id: 'a1', schoolId, deletedAt: null, totalPoints: 10, lessonId: null, title: 'Quiz', titleAr: null,
        questions: [{ id: 'q1', points: 4 }, { id: 'q2', points: 6 }],
      };

      beforeEach(() => {
        prisma.assessment.findUnique.mockResolvedValue(assessment);
        prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'submitted', attemptNumber: 1 });
        prisma.assessmentSubmission.update.mockResolvedValue({ id: 'sub-1' });
        prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 'sub-1', grades: [], student: null });
        prisma.grade.findFirst.mockResolvedValue(null);
        prisma.grade.create.mockResolvedValue({});
        prisma.xPTransaction = {
          findFirst: jest.fn().mockResolvedValue(null),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
          create: jest.fn(),
          update: jest.fn(),
        };
      });

      it('uses the sum of question scores as the overall mark and stores each question grade', async () => {
        await service.markStudent('a1', 'stu-1', 999, 10, 'nice', 'admin-1', {
          questionScores: [{ questionId: 'q1', score: 3 }, { questionId: 'q2', score: 4.5 }],
          actor: admin,
        });

        expect(prisma.grade.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ questionId: 'q1', score: 3, maxScore: 4 }) }),
        );
        expect(prisma.grade.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ questionId: null, score: 7.5, maxScore: 10 }) }),
        );
        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'assessment.mark',
            userId: 'admin-1',
            metadata: expect.objectContaining({ markedByAdmin: true }),
          }),
        );
      });

      it('adds extraScore (e.g. a recording) to the per-question sum', async () => {
        await service.markStudent('a1', 'stu-1', 0, 10, undefined, 'admin-1', {
          questionScores: [{ questionId: 'q1', score: 3 }],
          extraScore: 2.5,
          actor: admin,
        });

        expect(prisma.grade.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ questionId: null, score: 5.5, maxScore: 10 }) }),
        );
      });

      it('uses extraScore as the whole mark when there are no per-question scores (oral / recording only)', async () => {
        await service.markStudent('a1', 'stu-1', 0, 10, undefined, 'admin-1', { extraScore: 8, actor: admin });

        expect(prisma.grade.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ questionId: null, score: 8, maxScore: 10 }) }),
        );
      });

      it('rejects a total that exceeds the maximum once extraScore is added', async () => {
        await expect(
          service.markStudent('a1', 'stu-1', 0, 10, undefined, 'admin-1', {
            questionScores: [{ questionId: 'q2', score: 6 }],
            extraScore: 5,
          }),
        ).rejects.toThrow(/score cannot exceed maxScore/);
      });

      it('rejects a question score above that question\'s points', async () => {
        await expect(
          service.markStudent('a1', 'stu-1', 0, 10, undefined, 'admin-1', { questionScores: [{ questionId: 'q1', score: 5 }] }),
        ).rejects.toThrow(/cannot exceed its 4 points/);
      });

      it('rejects an unknown question', async () => {
        await expect(
          service.markStudent('a1', 'stu-1', 0, 10, undefined, 'admin-1', { questionScores: [{ questionId: 'nope', score: 1 }] }),
        ).rejects.toThrow(/Unknown question/);
      });
    });

    describe('getReviewStats', () => {
      it('summarises backlog and turnaround per group and per marker', async () => {
        const g = { id: 'g1', name: 'Group 1B' };
        prisma.assessmentSubmission.findMany
          .mockResolvedValueOnce([
            { submittedAt: new Date('2026-01-02'), student: { group: g } },
            { submittedAt: new Date('2026-01-01'), student: { group: g } },
          ])
          .mockResolvedValueOnce([
            {
              submittedAt: new Date('2026-01-01T00:00:00Z'),
              student: { group: g },
              grades: [{ gradedAt: new Date('2026-01-01T10:00:00Z'), grader: { id: 'u1', firstName: 'Mina', lastName: 'S' } }],
            },
          ]);

        const stats = await service.getReviewStats('school-1');

        expect(stats.totalPending).toBe(2);
        expect(stats.groups[0]).toMatchObject({
          groupName: 'Group 1B', pending: 2, oldestPendingAt: new Date('2026-01-01'), completed: 1, avgTurnaroundHours: 10,
        });
        expect(stats.markers[0]).toMatchObject({ name: 'Mina S', completed: 1, avgTurnaroundHours: 10 });
      });
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

  describe('publishAssessment', () => {
    it('rejects publish when assessment has no questions', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', status: 'draft', deletedAt: null, totalPoints: 0 });
      prisma.assessmentQuestion.findMany.mockResolvedValue([]);
      await expect(service.publishAssessment('a1')).rejects.toThrow('Cannot publish assessment without questions');
    });

    it('publishes and auto-assigns group students', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', status: 'draft', deletedAt: null, totalPoints: 10, levelId: 'l1', groupId: 'g1', schoolId: 's1' });
      prisma.assessmentQuestion.findMany.mockResolvedValue([{ id: 'q1' }]);
      prisma.student.findMany.mockResolvedValue([{ id: 'stu-1' }, { id: 'stu-2' }]);
      prisma.assessmentSubmission.findMany.mockResolvedValue([]);
      prisma.assessment.update.mockResolvedValue({ id: 'a1', status: 'published' });
      const res = await service.publishAssessment('a1');
      expect(res.status).toBe('published');
      expect(prisma.assessmentSubmission.createMany).toHaveBeenCalled();
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
