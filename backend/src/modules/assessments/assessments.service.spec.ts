import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { AccessScopeService } from '../../common/access-scope.service';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { CreateAssessmentDto, CreateQuestionDto, SubmitAssessmentDto, UpdateAssessmentDto } from './dto/assessment.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';

// A staff member the service accepts everywhere; the real access rules are tested against a fake
// database in assessments.access.spec.ts and access-scope.service.spec.ts.
const staff = { id: 'admin-1', roles: ['admin'] };

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let prisma: any;
  let resolver: any;
  let audit: any;
  let notifications: any;
  let notifier: any;

  const schoolId = 'school-1';

  const baseDto: CreateAssessmentDto = {
    title: 'Midterm',
    levelId: 'level-1',
    subjectId: 'subject-1',
    totalPoints: 100,
    passingPoints: 60,
  };

  /** Lets every call through, answering "which assessment" from the same mock the rest of the file sets up. */
  const accessStub = () => ({
    loadActor: jest.fn(async (u: any) => ({
      id: u?.id ?? 'admin-1', schoolId, roles: u?.roles ?? ['admin'], isSuperAdmin: false, scope: u?.scope ?? {},
    })),
    assertAssessment: jest.fn(async (_actor: any, id: string, args: any = {}) => {
      const a = await prismaMock.assessment.findUnique({ where: { id }, ...args });
      if (!a || a.deletedAt) throw new NotFoundException('Assessment not found');
      return a;
    }),
    assertAssessmentAndStudent: jest.fn(async (_actor: any, assessmentId: string, studentId: string) => {
      const a = await prismaMock.assessment.findUnique({ where: { id: assessmentId } });
      if (!a || a.deletedAt) throw new NotFoundException('Assessment not found');
      return { assessment: a, student: { id: studentId, schoolId: a.schoolId } };
    }),
    studentWhere: jest.fn(() => ({})),
    schoolWhere: jest.fn(() => ({})),
    assertGroupAllowed: jest.fn(),
  });

  const prismaMock = {
    $transaction: jest.fn(async (arg: any) => Array.isArray(arg) ? Promise.all(arg) : arg(prismaMock)),
    assessment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    level: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
    group: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
    subject: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
    lesson: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
    assessmentQuestion: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      deleteMany: jest.fn(),
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
    xPTransaction: {
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    grade: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
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
        { provide: AccessScopeService, useValue: accessStub() },
      ],
    }).compile();

    service = module.get(AssessmentsService);
    prisma = prismaMock;
    resolver = module.get(SchoolResolver);
    audit = module.get(AuditService);
    notifications = module.get(StudentNotificationsService);
    notifier = notifications;
  });

  describe('gender audience', () => {
    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });
    });

    it('defaults a new assessment to everyone', async () => {
      await service.create({ ...baseDto }, 'school-1');

      expect(prisma.assessment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ metadata: expect.objectContaining({ gender: 'all' }) }) }),
      );
    });

    it('stores a boys-only or girls-only audience alongside the grade', async () => {
      await service.create({ ...baseDto, gender: 'female', grade: 'Grade 6' }, 'school-1');

      expect(prisma.assessment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: expect.objectContaining({ gender: 'female', grade: 'Grade 6' }) }),
        }),
      );
    });

    it('changes the audience on update without losing the rest of the metadata', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null, metadata: { term: 2, grade: 'Grade 6' } });

      await service.update('a1', { totalPoints: 100, passingPoints: 60, gender: 'male' }, staff);

      expect(prisma.assessment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: { term: 2, grade: 'Grade 6', gender: 'male' } }),
        }),
      );
    });

    it('leaves the audience alone when an update does not mention it', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null, metadata: { gender: 'female' } });

      await service.update('a1', { totalPoints: 100, passingPoints: 60, grade: 'Grade 7' }, staff);

      expect(prisma.assessment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ metadata: { gender: 'female', grade: 'Grade 7' } }) }),
      );
    });

    describe('enforced wherever students are chosen', () => {
      const girlsOnly = { id: 'a1', schoolId, levelId: 'l1', groupId: 'g1', deletedAt: null, status: 'draft', totalPoints: 10, metadata: { gender: 'female' } };

      it('assignStudents only picks girls for a girls-only assessment', async () => {
        prisma.assessment.findUnique.mockResolvedValue(girlsOnly);
        prisma.student.findMany.mockResolvedValue([{ id: 'girl-1' }]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);

        const res = await service.assignStudents('a1', ['girl-1', 'boy-1'], staff);

        expect(prisma.student.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ levelId: 'l1', groupId: 'g1', gender: 'female' }) }),
        );
        expect(prisma.assessmentSubmission.createMany).toHaveBeenCalledWith({
          data: [expect.objectContaining({ studentId: 'girl-1' })],
        });
        expect(res).toMatchObject({ assigned: 1, notEligible: 1 });
      });

      it('assignStudents does not filter by gender for an everyone assessment', async () => {
        prisma.assessment.findUnique.mockResolvedValue({ ...girlsOnly, metadata: { gender: 'all' } });
        prisma.student.findMany.mockResolvedValue([]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);

        await service.assignStudents('a1', ['x'], staff);

        const where = prisma.student.findMany.mock.calls[0][0].where;
        expect(where).not.toHaveProperty('gender');
      });

      it('an assessment with no audience recorded (created before this option) still means everyone', async () => {
        prisma.assessment.findUnique.mockResolvedValue({ ...girlsOnly, metadata: null });
        prisma.student.findMany.mockResolvedValue([]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);

        await service.assignStudents('a1', ['x'], staff);

        expect(prisma.student.findMany.mock.calls[0][0].where).not.toHaveProperty('gender');
      });

      it('publishing auto-assigns only the group\'s girls', async () => {
        prisma.assessment.findUnique.mockResolvedValue(girlsOnly);
        prisma.assessmentQuestion.findMany.mockResolvedValue([{ id: 'q1' }]);
        prisma.assessment.update.mockResolvedValue({ id: 'a1', status: 'published' });
        prisma.student.findMany.mockResolvedValue([{ id: 'girl-1' }]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);

        await service.publishAssessment('a1', staff);

        for (const call of prisma.student.findMany.mock.calls) {
          expect(call[0].where).toEqual(expect.objectContaining({ gender: 'female' }));
        }
      });

      it('the students dialog lists only the intended gender', async () => {
        prisma.assessment.findUnique.mockResolvedValue({ ...girlsOnly, status: 'published' });
        prisma.student.findMany.mockResolvedValue([]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);

        await service.getStudentsForAssessment('a1', undefined, staff);

        expect(prisma.student.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ gender: 'female', levelId: 'l1', groupId: 'g1' }) }),
        );
      });

      it('a manual mark cannot land on a student of the other gender', async () => {
        prisma.assessment.findUnique.mockResolvedValue({ ...girlsOnly, status: 'published' });
        prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
        prisma.student.findUnique.mockResolvedValue({ levelId: 'l1', groupId: 'g1', schoolId, gender: 'male' });

        await expect(service.markStudent('a1', 'boy-1', 5, 10, undefined, 'admin-1')).rejects.toThrow(/not assigned/);
        expect(prisma.assessmentSubmission.create).not.toHaveBeenCalled();
      });
    });
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

    describe('allowRecording', () => {
      const created = async (extra: any) => {
        prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
        prisma.assessment.create.mockResolvedValue({ id: 'a1' });
        await service.create({ ...baseDto, ...extra }, 'school-1');
        return prisma.assessment.create.mock.calls[0][0].data;
      };

      it('defaults allowRecording to true when omitted', async () => {
        expect((await created({})).allowRecording).toBe(true);
      });

      it('stores allowRecording false when it is turned off', async () => {
        expect((await created({ allowRecording: false })).allowRecording).toBe(false);
      });

      it('forces allowRecording true when recording is required', async () => {
        const data = await created({ requireRecording: true, allowRecording: false });
        expect(data.requireRecording).toBe(true);
        expect(data.allowRecording).toBe(true);
      });
    });

    it('defaults requireReview to false for quiz', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });

      await service.create({ ...baseDto }, 'school-1');

      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.requireReview).toBe(false);
    });

    it('defaults requireReview to true for exam', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });

      await service.create({ ...baseDto, type: 'exam' }, 'school-1');

      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.requireReview).toBe(true);
    });

    it('stores maxAttempts 3 when allowRetry is true and maxAttempts omitted', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });

      await service.create({ ...baseDto, allowRetry: true }, 'school-1');

      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.allowRetry).toBe(true);
      expect(data.maxAttempts).toBe(3);
    });

    it('stores maxAttempts null when allowRetry is false even if maxAttempts is sent', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });

      await service.create({ ...baseDto, allowRetry: false, maxAttempts: 5 }, 'school-1');

      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.allowRetry).toBe(false);
      expect(data.maxAttempts).toBeNull();
    });

    it('rejects an essay question with requireReview false', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.create(
          {
            ...baseDto,
            requireReview: false,
            questions: [{ text: 'Essay', type: 'essay', correctAnswer: '', points: 10, orderIndex: 0 }],
          },
          'school-1',
        ),
      ).rejects.toThrow(/review/);
    });

    it('rejects an essay question with allowRetry true', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.create(
          {
            ...baseDto,
            type: 'exam',
            allowRetry: true,
            questions: [{ text: 'Essay', type: 'essay', correctAnswer: '', points: 10, orderIndex: 0 }],
          },
          'school-1',
        ),
      ).rejects.toThrow(/retr/);
    });

    it('defaults requireReview to true for a quiz that contains an essay question', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.assessment.create.mockResolvedValue({ id: 'a1' });

      await service.create(
        {
          ...baseDto,
          questions: [{ text: 'Essay', type: 'essay', correctAnswer: '', points: 10, orderIndex: 0 }],
        },
        'school-1',
      );

      const data = prisma.assessment.create.mock.calls[0][0].data;
      expect(data.requireReview).toBe(true);
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
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, requireReview: true, allowRetry: false });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });

      await service.update('a1', {
        totalPoints: 100,
        passingPoints: 60,
        referenceRecordingUrl: 'https://x/rec2.mp3',
        referenceRecordingName: 'Rec2',
      }, staff);

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
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, requireReview: true, allowRetry: false });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });

      await service.update('a1', { totalPoints: 100, passingPoints: 60, type: 'exam' }, staff);

      const data = prisma.assessment.update.mock.calls[0][0].data;
      expect(data.type).toBe('exam');
    });

    describe('allowRecording', () => {
      const stored = (over: any = {}) => ({
        id: 'a1', metadata: {}, deletedAt: null, requireReview: true, allowRetry: false,
        requireRecording: false, allowRecording: true, ...over,
      });
      const updated = async (existing: any, dto: any) => {
        prisma.assessment.findUnique.mockResolvedValue(existing);
        prisma.assessment.update.mockResolvedValue({ id: 'a1' });
        await service.update('a1', { totalPoints: 100, passingPoints: 60, ...dto }, staff);
        return prisma.assessment.update.mock.calls[0][0].data;
      };

      it('forces allowRecording true when requireRecording is turned on', async () => {
        const data = await updated(stored({ allowRecording: false }), { requireRecording: true });
        expect(data.requireRecording).toBe(true);
        expect(data.allowRecording).toBe(true);
      });

      it('forces allowRecording true when the stored requireRecording is already on', async () => {
        const data = await updated(stored({ requireRecording: true }), { allowRecording: false });
        expect(data.allowRecording).toBe(true);
      });

      it('stores allowRecording false when recording is not required', async () => {
        const data = await updated(stored(), { allowRecording: false });
        expect(data.allowRecording).toBe(false);
      });

      it('leaves allowRecording unchanged when it is not provided', async () => {
        const data = await updated(stored({ allowRecording: false }), { title: 'New' });
        expect('allowRecording' in data).toBe(false);
      });

      it('stores the incoming value when requireRecording is turned off in the same update', async () => {
        const data = await updated(stored({ requireRecording: true }), { requireRecording: false, allowRecording: false });
        expect(data.allowRecording).toBe(false);
      });
    });

    it('throws NotFoundException for unknown assessment', async () => {
      prisma.assessment.findUnique.mockResolvedValue(null);

      await expect(
        service.update('a1', { totalPoints: 100, passingPoints: 60, title: 'X' }, staff),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts questions preserving existing ids', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100 });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });
      prisma.assessmentQuestion.updateMany.mockResolvedValue({ count: 1 });
      prisma.assessmentQuestion.create.mockResolvedValue({});
      prisma.assessmentQuestion.deleteMany.mockResolvedValue({});

      await service.update('a1', {
        totalPoints: 100,
        passingPoints: 60,
        questions: [
          { id: 'q1', text: 'Kept', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 50, orderIndex: 0 },
          { text: 'New', type: 'true_false', correctAnswer: 'true', points: 50, orderIndex: 1 },
        ],
      }, staff);

      expect(prisma.assessmentQuestion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'q1', assessmentId: 'a1' } }),
      );
      expect(prisma.assessmentQuestion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assessmentId: 'a1', questionText: 'New' }) }),
      );
    });

    it('refuses a question id that belongs to another assessment instead of overwriting it', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100 });
      prisma.assessmentQuestion.deleteMany.mockResolvedValue({});
      prisma.assessmentQuestion.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.update('a1', {
          totalPoints: 100,
          passingPoints: 60,
          questions: [{ id: 'q-of-another-assessment', text: 'Hijack', type: 'true_false', correctAnswer: 'true', points: 100, orderIndex: 0 }],
        }, staff),
      ).rejects.toThrow(/does not belong to this assessment/);
      expect(prisma.assessment.update).not.toHaveBeenCalled();
    });

    it.each([
      ['levelId', 'level'],
      ['groupId', 'group'],
      ['subjectId', 'subject'],
      ['lessonId', 'lesson'],
    ] as const)('refuses a %s from another school', async (field, table) => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', schoolId, metadata: {}, deletedAt: null, totalPoints: 100 });
      (prisma as any)[table].findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update('a1', { totalPoints: 100, passingPoints: 60, [field]: 'foreign-id' } as any, staff),
      ).rejects.toThrow(/not found in this school/);
      expect((prisma as any)[table].findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-id', schoolId }, select: { id: true } });
      expect(prisma.assessment.update).not.toHaveBeenCalled();
    });

    it('does not delete questions that have grades', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100 });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });
      prisma.assessmentQuestion.updateMany.mockResolvedValue({ count: 1 });
      prisma.assessmentQuestion.create.mockResolvedValue({});
      prisma.assessmentQuestion.deleteMany.mockResolvedValue({});

      await service.update('a1', {
        totalPoints: 100,
        passingPoints: 60,
        questions: [
          { id: 'q1', text: 'Kept', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 100, orderIndex: 0 },
        ],
      }, staff);

      // keptIds = ['q1']; deleteMany must exclude q1 and only target questions with no grades
      const args = prisma.assessmentQuestion.deleteMany.mock.calls[0][0];
      expect(args.where.assessmentId).toBe('a1');
      expect(args.where.id.notIn).toEqual(['q1']);
      expect(args.where.grades.none).toEqual({});
    });

    it('persists durationMinutes into metadata on update', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, totalPoints: 100, requireReview: true, allowRetry: false });
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });
      await service.update('a1', { totalPoints: 100, passingPoints: 60, durationMinutes: 30 }, staff);
      const data = prisma.assessment.update.mock.calls[0][0].data;
      expect(data.metadata.durationMinutes).toBe(30);
    });

    it('rejects adding an essay question to a retry-enabled assessment', async () => {
      prisma.assessment.findUnique.mockResolvedValue({
        id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100, requireReview: true, allowRetry: true, maxAttempts: 3,
      });

      await expect(
        service.update('a1', {
          totalPoints: 100,
          passingPoints: 60,
          questions: [{ text: 'Essay', type: 'essay', correctAnswer: '', points: 10, orderIndex: 0 }],
        }, staff),
      ).rejects.toThrow(/retr/);
    });

    it('rejects turning allowRetry on when stored questions include an essay', async () => {
      prisma.assessment.findUnique.mockResolvedValue({
        id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100, requireReview: true, allowRetry: false, maxAttempts: null,
      });
      prisma.assessmentQuestion.findMany.mockResolvedValue([{ type: 'essay' }]);

      await expect(
        service.update('a1', { totalPoints: 100, passingPoints: 60, allowRetry: true }, staff),
      ).rejects.toThrow(/retr/);
    });

    it('clears maxAttempts when allowRetry is switched off', async () => {
      prisma.assessment.findUnique.mockResolvedValue({
        id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100, requireReview: true, allowRetry: true, maxAttempts: 4,
      });
      prisma.assessmentQuestion.findMany.mockResolvedValue([]);
      prisma.assessment.update.mockResolvedValue({ id: 'a1' });

      await service.update('a1', { totalPoints: 100, passingPoints: 60, allowRetry: false }, staff);

      const data = prisma.assessment.update.mock.calls[0][0].data;
      expect(data.allowRetry).toBe(false);
      expect(data.maxAttempts).toBeNull();
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

  describe('submit review, recording and XP rules', () => {
    // A quiz with one 10-point question; the flags are overridden per test.
    const quiz = (over: any = {}) => ({
      id: 'a1', schoolId: 'school-1', status: 'published', deletedAt: null,
      title: 'Quiz', titleAr: null, lessonId: null,
      requireReview: false, requireRecording: false, allowRetry: false, maxAttempts: null,
      passingScore: 6, totalPoints: 10, dueDate: null, allowLateSubmission: false,
      questions: [{ id: 'q1', type: 'multiple_choice', correctAnswer: 'A', points: 10 }],
      ...over,
    });
    const right = { answers: [{ questionId: 'q1', answer: 'A' }] };
    const wrong = { answers: [{ questionId: 'q1', answer: 'B' }] };

    // A distinct client for the transaction, so a write that bypasses it is visible.
    let tx: any;

    beforeEach(() => {
      tx = {
        assessmentSubmission: { update: jest.fn().mockResolvedValue({ id: 's1' }) },
        grade: { deleteMany: jest.fn(), createMany: jest.fn(), create: jest.fn() },
        xPTransaction: {
          findFirst: jest.fn().mockResolvedValue(null),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
          create: jest.fn(),
          update: jest.fn(),
          deleteMany: jest.fn(),
        },
        lesson: { findUnique: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });
      prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 's1', grades: [], student: null });
    });

    afterEach(() => {
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    });

    it('rejects a portal submit without fileUrl when requireRecording is on', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({ requireRecording: true }));

      await expect(service.submit('a1', 'stu-1', { answers: [] }, { source: 'portal' })).rejects.toThrow(
        'A voice recording is required for this assessment',
      );
      await expect(service.submit('a1', 'stu-1', { answers: [] }, undefined)).rejects.toThrow(
        'A voice recording is required for this assessment',
      );
    });

    describe('allowRecording off', () => {
      const withFile = { answers: [], fileUrl: 'https://x/rec.webm' };

      it.each([
        ['portal', { source: 'portal' as const }],
        ['staff', { source: 'staff' as const }],
        ['anonymous', undefined],
      ])('rejects a %s submit that carries a fileUrl', async (_n, actor) => {
        prisma.assessment.findUnique.mockResolvedValue(quiz({ allowRecording: false }));

        await expect(service.submit('a1', 'stu-1', withFile, actor as any)).rejects.toThrow(
          'Voice recording is not enabled for this assessment',
        );
        expect(tx.assessmentSubmission.update).not.toHaveBeenCalled();
      });

      it('accepts a submit without a fileUrl', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz({ allowRecording: false }));

        await expect(
          service.submit('a1', 'stu-1', { answers: [] }, { source: 'portal' }),
        ).resolves.toBeDefined();
      });

      it('accepts a fileUrl when allowRecording is true', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz({ allowRecording: true }));

        await expect(
          service.submit('a1', 'stu-1', withFile, { source: 'portal' }),
        ).resolves.toBeDefined();
      });

      it('accepts a fileUrl when the field is missing (strict check)', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz());

        await expect(
          service.submit('a1', 'stu-1', withFile, { source: 'portal' }),
        ).resolves.toBeDefined();
      });
    });

    it('allows a staff submit without fileUrl when requireRecording is on', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({ requireRecording: true }));

      await expect(
        service.submit('a1', 'stu-1', { answers: [] }, { source: 'staff' }),
      ).resolves.toBeDefined();
    });

    it('auto-completes when requireReview is false and all questions are gradable', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz());

      const res: any = await service.submit('a1', 'stu-1', right);

      expect(tx.assessmentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
      );
      expect(notifications.notifyOrRefresh).toHaveBeenCalledTimes(1);
      expect(res.result).toEqual(expect.objectContaining({
        gradingComplete: true, earned: 10, max: 10, passed: true, attemptNumber: 1,
      }));
    });

    it('leaves status submitted when requireReview is true', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({ requireReview: true }));

      const res: any = await service.submit('a1', 'stu-1', right);

      expect(tx.assessmentSubmission.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
      );
      expect(notifications.notifyOrRefresh).not.toHaveBeenCalled();
      expect(tx.xPTransaction.create).not.toHaveBeenCalled();
      expect(res.result).toEqual(expect.objectContaining({ gradingComplete: false, earned: null, passed: null }));
    });

    it('leaves status submitted when an essay question exists even if requireReview is false', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({
        questions: [
          { id: 'q1', type: 'multiple_choice', correctAnswer: 'A', points: 5 },
          { id: 'q2', type: 'essay', correctAnswer: null, points: 5 },
        ],
      }));

      const res: any = await service.submit('a1', 'stu-1', right);

      expect(tx.assessmentSubmission.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
      );
      expect(res.result.gradingComplete).toBe(false);
    });

    it('does not ask reviewers to mark a submission that auto-completed', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz());
      const reviewers = jest.spyOn(service as any, 'notifyReviewers');

      await service.submit('a1', 'stu-1', right);

      expect(reviewers).not.toHaveBeenCalled();
    });

    it('asks reviewers to mark a submission that waits for review, as before', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({ requireReview: true }));
      const reviewers = jest.spyOn(service as any, 'notifyReviewers').mockResolvedValue(undefined);

      await service.submit('a1', 'stu-1', right);

      expect(reviewers).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'stu-1', 's1', undefined);
    });

    it('runs the shared scope check on a staff proxy submit, never on the portal submit', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({ requireReview: true }));
      const access = (service as any).access;

      await service.submit('a1', 'stu-1', right, { id: 'staff-1', roles: ['servant'], source: 'staff' });
      expect(access.assertAssessmentAndStudent).toHaveBeenCalledWith(expect.anything(), 'a1', 'stu-1');

      access.assertAssessmentAndStudent.mockClear();
      await service.submit('a1', 'stu-1', right, { source: 'portal' });
      await service.submit('a1', 'stu-1', right);
      expect(access.assertAssessmentAndStudent).not.toHaveBeenCalled();
    });

    describe('answer array hardening', () => {
      it('scores a question answered many times once, so the mark and XP cannot be inflated', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz());
        const repeated = { answers: Array.from({ length: 5 }, () => ({ questionId: 'q1', answer: 'A' })) };

        const res: any = await service.submit('a1', 'stu-1', repeated, { source: 'portal' });

        expect(tx.grade.createMany.mock.calls[0][0].data).toHaveLength(1);
        expect(res.result.earned).toBe(10);
        expect(tx.xPTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 100 }) }),
        );
      });

      it('keeps the last answer when a question is answered twice', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz());

        const res: any = await service.submit('a1', 'stu-1', {
          answers: [{ questionId: 'q1', answer: 'A' }, { questionId: 'q1', answer: 'B' }],
        });

        expect(res.result.earned).toBe(0);
        expect(tx.grade.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ questionId: 'q1', score: 0 })]);
      });

      it('refuses to auto-complete a mark above the assessment total', async () => {
        // Legacy data: question points summing past the total (validateQuestions now prevents it).
        prisma.assessment.findUnique.mockResolvedValue(quiz({
          questions: [
            { id: 'q1', type: 'multiple_choice', correctAnswer: 'A', points: 10 },
            { id: 'q2', type: 'multiple_choice', correctAnswer: 'A', points: 10 },
          ],
        }));

        await expect(service.submit('a1', 'stu-1', {
          answers: [{ questionId: 'q1', answer: 'A' }, { questionId: 'q2', answer: 'A' }],
        })).rejects.toThrow(/cannot exceed the assessment total/);
        expect(tx.xPTransaction.create).not.toHaveBeenCalled();
      });
    });

    describe('what auto-completes', () => {
      it('sends a submission with a recording to review even when review is off', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz());
        const reviewers = jest.spyOn(service as any, 'notifyReviewers').mockResolvedValue(undefined);

        const res: any = await service.submit('a1', 'stu-1', { ...right, fileUrl: 'https://cdn/rec.webm' });

        expect(tx.assessmentSubmission.update).not.toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
        );
        expect(tx.xPTransaction.create).not.toHaveBeenCalled();
        expect(reviewers).toHaveBeenCalled();
        // The student sees the normal "awaiting marking" state.
        expect(res.result).toEqual(expect.objectContaining({ gradingComplete: false, earned: null, passed: null }));
      });

      it('does not auto-complete an assessment with no questions', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz({ questions: [] }));

        const res: any = await service.submit('a1', 'stu-1', { answers: [] });

        expect(tx.assessmentSubmission.update).not.toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
        );
        expect(res.result.gradingComplete).toBe(false);
      });

      it('writes the overall grade row on auto-complete, unmarked by anyone', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz());

        await service.submit('a1', 'stu-1', right);

        expect(tx.grade.create).toHaveBeenCalledWith({
          data: { submissionId: 's1', questionId: null, score: 10, maxScore: 10, feedback: null, gradedBy: null },
        });
      });

      it('writes no overall grade row when the submission waits for review', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz({ requireReview: true }));

        await service.submit('a1', 'stu-1', right);

        expect(tx.grade.create).not.toHaveBeenCalled();
      });
    });

    it('reports attempt 1 of 3 and canRetry true for a failed no-review quiz with retry on', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({ allowRetry: true, maxAttempts: 3 }));

      const res: any = await service.submit('a1', 'stu-1', wrong);

      expect(res.result).toEqual({
        gradingComplete: true, earned: 0, max: 10, passed: false,
        attemptNumber: 1, maxAttempts: 3, attemptsRemaining: 2, canRetry: true, revealDetail: false,
      });
    });

    describe('response grades', () => {
      const withGrades = () =>
        prisma.assessmentSubmission.findUnique.mockResolvedValue({
          id: 's1', grades: [{ id: 'g1', questionId: 'q1', score: 0, maxScore: 10 }], student: null,
        });

      it('withholds per-question grades from a failing attempt that can retry', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz({ allowRetry: true, maxAttempts: 3 }));
        withGrades();

        const res: any = await service.submit('a1', 'stu-1', wrong);

        expect(res.grades).toEqual([]);
        expect(res.result.revealDetail).toBe(false);
        expect(res.id).toBe('s1');
      });

      it('keeps per-question grades when retry is off', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz());
        withGrades();

        const res: any = await service.submit('a1', 'stu-1', wrong);

        expect(res.grades).toHaveLength(1);
        expect(res.result.revealDetail).toBe(true);
      });

      it('keeps per-question grades when a retry-enabled attempt passed', async () => {
        prisma.assessment.findUnique.mockResolvedValue(quiz({ allowRetry: true, maxAttempts: 3 }));
        withGrades();

        const res: any = await service.submit('a1', 'stu-1', right);

        expect(res.grades).toHaveLength(1);
        expect(res.result.revealDetail).toBe(true);
      });
    });

    it('credits no XP for a failing attempt when retry is on', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({ allowRetry: true, maxAttempts: 3 }));

      await service.submit('a1', 'stu-1', wrong);

      expect(tx.xPTransaction.create).not.toHaveBeenCalled();
      expect(tx.xPTransaction.deleteMany).toHaveBeenCalled();
      expect(prisma.xPTransaction.deleteMany).not.toHaveBeenCalled();
    });

    it('credits one XP row for the passing attempt when retry is on', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({ allowRetry: true, maxAttempts: 3 }));

      await service.submit('a1', 'stu-1', right);

      expect(tx.xPTransaction.create).toHaveBeenCalledTimes(1);
      // The XP write must ride the transaction client, not the outer prisma.
      expect(prisma.xPTransaction.create).not.toHaveBeenCalled();
      expect(prisma.xPTransaction.findFirst).not.toHaveBeenCalled();
      expect(tx.xPTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: 'stu-1', amount: 100, referenceId: 's1' }),
        }),
      );
    });

    it('still credits XP for a failing mark when retry is off', async () => {
      prisma.assessment.findUnique.mockResolvedValue(quiz({
        questions: [
          { id: 'q1', type: 'multiple_choice', correctAnswer: 'A', points: 5 },
          { id: 'q2', type: 'multiple_choice', correctAnswer: 'A', points: 5 },
        ],
      }));

      await service.submit('a1', 'stu-1', {
        answers: [{ questionId: 'q1', answer: 'A' }, { questionId: 'q2', answer: 'B' }],
      });

      expect(tx.xPTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 50 }) }),
      );
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

  describe('markStudent XP', () => {
    const markable = (over: any = {}) => ({
      id: 'a1', deletedAt: null, totalPoints: 100, passingScore: 60, allowRetry: true,
      lessonId: null, title: 'Quiz', titleAr: null, ...over,
    });

    beforeEach(() => {
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'submitted' });
      prisma.assessmentSubmission.update.mockResolvedValue({ id: 's1' });
      prisma.assessmentSubmission.findUnique.mockResolvedValue({ id: 's1', grades: [], student: null });
      prisma.grade.findFirst.mockResolvedValue(null);
      prisma.xPTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    });

    it('removes XP when a passing retry-enabled submission is re-marked below the pass mark', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable());
      prisma.xPTransaction.findFirst.mockResolvedValue({ id: 'x1' });

      await service.markStudent('a1', 'stu-1', 40, 100, undefined, 'u1');

      expect(prisma.xPTransaction.deleteMany).toHaveBeenCalledWith({
        where: { referenceType: 'submission', referenceId: 's1' },
      });
      expect(prisma.xPTransaction.create).not.toHaveBeenCalled();
    });

    it('credits XP for 8/10 on a 100-point assessment with pass mark 60 when retry is on', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable());
      prisma.xPTransaction.findFirst.mockResolvedValue(null);

      await service.markStudent('a1', 'stu-1', 8, 10, undefined, 'u1');

      expect(prisma.xPTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 80 }) }),
      );
      expect(prisma.xPTransaction.deleteMany).not.toHaveBeenCalled();
    });

    it('scales XP to the assessment xpReward (4/5 with xpReward 50 earns 40)', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable({ totalPoints: 5, passingScore: 3, xpReward: 50 }));
      prisma.xPTransaction.findFirst.mockResolvedValue(null);

      await service.markStudent('a1', 'stu-1', 4, 5, undefined, 'u1');

      expect(prisma.xPTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 40 }) }),
      );
    });

    it('defaults to 100 XP for a full score when xpReward is not set', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable({ totalPoints: 5, passingScore: 3 }));
      prisma.xPTransaction.findFirst.mockResolvedValue(null);

      await service.markStudent('a1', 'stu-1', 5, 5, undefined, 'u1');

      expect(prisma.xPTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 100 }) }),
      );
    });

    it('credits no XP for 5/10 on a 100-point assessment with pass mark 60 when retry is on', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable());
      prisma.xPTransaction.findFirst.mockResolvedValue({ id: 'x1' });

      await service.markStudent('a1', 'stu-1', 5, 10, undefined, 'u1');

      expect(prisma.xPTransaction.deleteMany).toHaveBeenCalled();
      expect(prisma.xPTransaction.create).not.toHaveBeenCalled();
    });

    // 57 / 100 * 100 is 56.99999999999999 in floating point; exactly on the pass mark passes.
    it('keeps XP for 57/100 against a pass mark of 57 when retry is on', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable({ passingScore: 57 }));
      prisma.xPTransaction.findFirst.mockResolvedValue({ id: 'x1' });

      await service.markStudent('a1', 'stu-1', 57, 100, undefined, 'u1');

      expect(prisma.xPTransaction.deleteMany).not.toHaveBeenCalled();
      expect(prisma.xPTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'x1' }, data: expect.objectContaining({ amount: 57 }) }),
      );
    });

    it('applies the pass-only rule to a bulk-accepted auto score too (one XP path)', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable({ totalPoints: 10, passingScore: 6 }));
      prisma.assessmentSubmission.findFirst
        // acceptAutoScores' own lookup, then applyMark's live-attempt lookup
        .mockResolvedValueOnce({
          id: 's1', assessmentId: 'a1', studentId: 'stu-1', status: 'submitted', fileUrl: null,
          assessment: { id: 'a1', totalPoints: 10, questions: [{ type: 'multiple_choice' }] },
          grades: [{ questionId: 'q1', score: 4 }],
        })
        .mockResolvedValueOnce({ id: 's1', status: 'submitted', attemptNumber: 1 });

      const res = await service.acceptAutoScores('school-1', ['s1'], { id: 'admin-1', roles: ['admin'] });

      expect(res).toMatchObject({ accepted: 1, failed: 0 });
      expect(prisma.xPTransaction.create).not.toHaveBeenCalled();
      expect(prisma.xPTransaction.deleteMany).toHaveBeenCalledWith({
        where: { referenceType: 'submission', referenceId: 's1' },
      });
    });

    it('keeps the existing XP for a failing mark when retry is off', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable({ allowRetry: false }));
      prisma.xPTransaction.findFirst.mockResolvedValue(null);

      await service.markStudent('a1', 'stu-1', 40, 100, undefined, 'u1');

      expect(prisma.xPTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 40, referenceId: 's1' }) }),
      );
      expect(prisma.xPTransaction.deleteMany).not.toHaveBeenCalled();
    });

    it('updates the auto-complete overall row when a servant re-marks it, never adding a second', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable({ allowRetry: false }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.grade.findFirst.mockResolvedValue({ id: 'g-auto', questionId: null, score: 60, maxScore: 100, gradedBy: null });
      prisma.xPTransaction.findFirst.mockResolvedValue({ id: 'x1' });

      await service.markStudent('a1', 'stu-1', 70, 100, 'adjusted', 'u1');

      expect(prisma.grade.update).toHaveBeenCalledWith({
        where: { id: 'g-auto' },
        data: { score: 70, maxScore: 100, feedback: 'adjusted', gradedBy: 'u1' },
      });
      expect(prisma.grade.create).not.toHaveBeenCalled();
    });

    it('updates rather than duplicates XP on a second passing re-mark', async () => {
      prisma.assessment.findUnique.mockResolvedValue(markable());
      prisma.xPTransaction.findFirst.mockResolvedValue({ id: 'x1' });

      await service.markStudent('a1', 'stu-1', 80, 100, undefined, 'u1');

      expect(prisma.xPTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'x1' }, data: expect.objectContaining({ amount: 80 }) }),
      );
      expect(prisma.xPTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('getTakeQuestions', () => {
    const pubAssess = (over: any = {}) => ({
      id: 'a1', title: 'Quiz', titleAr: null, type: 'quiz', status: 'published',
      totalPoints: 10, passingScore: 5, dueDate: null,
      requireRecording: true, allowRetry: true, maxAttempts: 3,
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

    it('returns requireRecording, attemptNumber and the effective maxAttempts', async () => {
      prisma.assessment.findUnique.mockResolvedValue(pubAssess());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's2', status: 'assigned', attemptNumber: 2 });

      const res: any = await service.getTakeQuestions('a1', 'stu-1');

      expect(res.assessment.requireRecording).toBe(true);
      expect(res.assessment.attemptNumber).toBe(2);
      expect(res.assessment.maxAttempts).toBe(3);
    });

    it.each([[true], [false]])('returns allowRecording %s in the header', async (flag) => {
      prisma.assessment.findUnique.mockResolvedValue(pubAssess({ allowRecording: flag }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });

      const res: any = await service.getTakeQuestions('a1', 'stu-1');

      expect(res.assessment.allowRecording).toBe(flag);
    });

    it('reports a single attempt when retry is off, whatever maxAttempts is stored', async () => {
      prisma.assessment.findUnique.mockResolvedValue(pubAssess({ allowRetry: false, maxAttempts: 5 }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned', attemptNumber: 1 });

      const res: any = await service.getTakeQuestions('a1', 'stu-1');

      expect(res.assessment.maxAttempts).toBe(1);
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
        prisma.assessmentSubmission.findMany.mockResolvedValue([row()]);

        await service.getPendingReview('school-1', { ...servant, scope: { groupId: 'g1', levelId: 'l1' } } as any);

        expect(prisma.assessmentSubmission.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ student: { deletedAt: null, groupId: 'g1', levelId: 'l1' } }),
          }),
        );
      });

      it('shows a servant with no group or level the whole school, as the students module does', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([row()]);

        await service.getPendingReview('school-1', servant);

        expect(prisma.assessmentSubmission.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ student: { deletedAt: null } }),
          }),
        );
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

      it('counts the whole school for a servant with no assignment', async () => {
        prisma.assessmentSubmission.count.mockResolvedValue(2);
        prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
        const result = await service.getPendingReviewCount('school-1', servant);
        expect(result.count).toBe(2);
        expect(prisma.assessmentSubmission.count).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ student: { deletedAt: null } }) }),
        );
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
        const spy = jest.spyOn(service as any, 'applyMark').mockResolvedValue({} as any);

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
          deleteMany: jest.fn(),
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

    describe('getMarked', () => {
      const gradeRow = (over: any = {}) => ({
        score: 8, maxScore: 10, feedback: 'Well done', gradedAt: new Date('2026-02-01T10:00:00Z'),
        grader: { id: 'u1', firstName: 'Mina', lastName: 'S', userRoles: [{ role: { name: 'servant' } }] },
        submission: {
          id: 'sub-1', submittedAt: new Date('2026-02-01T08:00:00Z'), submissionType: 'online', isLate: false,
          fileUrl: 'https://cdn/rec.webm', fileType: 'audio/webm', durationSeconds: 30, metadata: { notes: 'Noisy room' },
          student: { id: 'stu-1', firstName: 'Robin', lastName: 'Amir', studentCode: 'S1', group: { id: 'g1', name: 'Group 1B' }, grade: { name: 'Grade 6' } },
          assessment: { id: 'a1', title: 'Quiz', titleAr: null, totalPoints: 10 },
        },
        ...over,
      });

      const returnedRow = (over: any = {}) => ({
        id: 'sub-r', isLate: false, submittedAt: new Date('2026-02-02T08:00:00Z'),
        fileUrl: 'https://cdn/old.webm', fileType: 'audio/webm', durationSeconds: 12,
        metadata: { notes: 'first try', returns: [{ at: '2026-02-03T09:00:00Z', by: 'u2', note: 'Please redo Q2' }] },
        student: { id: 'stu-2', firstName: 'Mina', lastName: 'Youssef', studentCode: 'S2', group: { id: 'g1', name: 'Group 1B' }, grade: { name: 'Grade 6' } },
        assessment: { id: 'a1', title: 'Quiz', titleAr: null, totalPoints: 10 },
        ...over,
      });

      beforeEach(() => {
        prisma.grade.findMany.mockResolvedValue([]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);
        prisma.user.findMany.mockResolvedValue([]);
      });

      it('leaves out auto-completed work: only a mark someone gave is listed', async () => {
        await service.getMarked('school-1', admin);

        expect(prisma.grade.findMany.mock.calls[0][0].where.gradedBy).toEqual({ not: null });
      });

      it('lists marked work with who marked it, whether that was an admin, and keeps the recording and notes', async () => {
        prisma.grade.findMany.mockResolvedValue([
          gradeRow(),
          gradeRow({ grader: { id: 'u2', firstName: 'Amir', lastName: 'A', userRoles: [{ role: { name: 'super_admin' } }] } }),
        ]);

        const res = await service.getMarked('school-1', admin);

        expect(prisma.grade.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              questionId: null,
              submission: expect.objectContaining({ status: 'completed', student: { deletedAt: null } }),
            }),
            orderBy: { gradedAt: 'desc' },
          }),
        );
        expect(res.truncated).toBe(false);
        expect(res.items[0]).toMatchObject({
          status: 'marked', submissionId: 'sub-1', score: 8, maxScore: 10, percentage: 80, feedback: 'Well done',
          recording: { url: 'https://cdn/rec.webm', type: 'audio/webm', durationSeconds: 30 },
          notes: 'Noisy room',
          by: { name: 'Mina S', isAdmin: false },
          student: { firstName: 'Robin', groupName: 'Group 1B' },
        });
        expect(res.items[1].by).toMatchObject({ name: 'Amir A', isAdmin: true });
      });

      it('lists work returned to the student as a separate status with the return comment and old recording', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([returnedRow()]);
        prisma.user.findMany.mockResolvedValue([
          { id: 'u2', firstName: 'Amir', lastName: 'A', userRoles: [{ role: { name: 'admin' } }] },
        ]);

        const res = await service.getMarked('school-1', admin, 365);

        expect(prisma.assessmentSubmission.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ status: 'assigned' }) }),
        );
        expect(res.items).toHaveLength(1);
        expect(res.items[0]).toMatchObject({
          status: 'returned', submissionId: 'sub-r', score: null, percentage: null, maxScore: 10,
          feedback: 'Please redo Q2',
          recording: { url: 'https://cdn/old.webm' },
          notes: 'first try',
          by: { id: 'u2', name: 'Amir A', isAdmin: true },
          at: new Date('2026-02-03T09:00:00Z'),
        });
      });

      it('shows the latest return only, ignores assigned rows with no return history, and drops returns outside the window', async () => {
        const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          returnedRow({
            id: 'multi',
            metadata: { returns: [{ at: new Date().toISOString(), by: 'u2', note: 'first' }, { at: new Date().toISOString(), by: 'u2', note: 'second' }] },
          }),
          returnedRow({ id: 'no-returns', metadata: { notes: 'just notes' } }),
          returnedRow({ id: 'stale', metadata: { returns: [{ at: old, by: 'u2', note: 'ancient' }] } }),
        ]);

        const res = await service.getMarked('school-1', admin);

        expect(res.items.map((i: any) => i.submissionId)).toEqual(['multi']);
        expect(res.items[0].feedback).toBe('second');
        expect(res.items[0].by).toBeNull();
      });

      it('interleaves marked and returned work newest first', async () => {
        prisma.grade.findMany.mockResolvedValue([gradeRow()]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([returnedRow()]);

        const res = await service.getMarked('school-1', admin, 365);

        expect(res.items.map((i: any) => i.status)).toEqual(['returned', 'marked']);
      });

      it('has no submitted time for work staff entered directly, and tolerates a deleted marker', async () => {
        prisma.grade.findMany.mockResolvedValue([
          gradeRow({ grader: null, submission: { ...gradeRow().submission, submissionType: 'manual', fileUrl: null, metadata: null } }),
        ]);

        const [item] = (await service.getMarked('school-1', admin)).items;

        expect(item.submittedAt).toBeNull();
        expect(item.by).toBeNull();
        expect(item.recording).toBeNull();
        expect(item.notes).toBeNull();
      });

      it('limits a servant to their own group, and shows the whole school to one with no assignment', async () => {
        await service.getMarked('school-1', { ...servant, scope: { groupId: 'g1', levelId: 'l1' } } as any);
        expect(prisma.grade.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              submission: expect.objectContaining({ student: { deletedAt: null, groupId: 'g1', levelId: 'l1' } }),
            }),
          }),
        );

        prisma.grade.findMany.mockClear();
        await service.getMarked('school-1', servant);
        expect(prisma.grade.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ submission: expect.objectContaining({ student: { deletedAt: null } }) }),
          }),
        );
      });

      it('flags truncation when more than the cap exist and clamps the window', async () => {
        prisma.grade.findMany.mockResolvedValue(Array.from({ length: 501 }, () => gradeRow()));

        const res = await service.getMarked('school-1', admin, 9999);

        expect(res.truncated).toBe(true);
        expect(res.items).toHaveLength(500);
        expect(res.days).toBe(365);
      });
    });

    describe('resetPendingSubmission', () => {
      const pending = (over: any = {}) => ({
        id: 'sub-1', assessmentId: 'a1', studentId: 'stu-1', status: 'submitted', attemptNumber: 2,
        metadata: { notes: 'hi' },
        assessment: { id: 'a1', title: 'Quiz', titleAr: null, schoolId },
        ...over,
      });

      it('archives the pending attempt as admin-discarded, opens a fresh one with the same attempt number, audits and notifies', async () => {
        prisma.assessmentSubmission.findFirst.mockResolvedValue(pending());
        prisma.assessmentSubmission.create.mockResolvedValue({ id: 'sub-new' });

        const res = await service.resetPendingSubmission('school-1', 'sub-1', admin);

        expect(prisma.assessmentSubmission.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ id: 'sub-1', status: 'submitted', assessment: { schoolId, deletedAt: null } }),
          }),
        );
        expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith({
          where: { id: 'sub-1' },
          data: {
            status: 'superseded',
            metadata: { notes: 'hi', discardedByAdmin: { at: expect.any(String), by: 'admin-1' } },
          },
        });
        expect(prisma.assessmentSubmission.create).toHaveBeenCalledWith({
          data: { assessmentId: 'a1', studentId: 'stu-1', submissionType: 'online', status: 'assigned', attemptNumber: 2 },
        });
        expect(res).toEqual({ reset: true, newSubmissionId: 'sub-new' });
        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'assessment.reset', userId: 'admin-1', entityId: 'sub-1' }),
        );
        expect(notifier.notifyOrRefresh).toHaveBeenCalledWith(
          expect.objectContaining({ studentId: 'stu-1', type: 'assessment_reset', referenceId: 'sub-new' }),
        );
      });

      it('refuses a submission that is not awaiting review (already marked, returned, or another school)', async () => {
        prisma.assessmentSubmission.findFirst.mockResolvedValue(null);

        await expect(service.resetPendingSubmission('school-1', 'sub-1', admin)).rejects.toThrow(/no longer awaiting review/);
        expect(prisma.assessmentSubmission.update).not.toHaveBeenCalled();
        expect(prisma.assessmentSubmission.create).not.toHaveBeenCalled();
      });
    });

    describe('getReviewStats', () => {
      it('leaves auto-completed work out of the marking turnaround', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        await service.getReviewStats('school-1');

        const completed = prisma.assessmentSubmission.findMany.mock.calls[1][0];
        expect(completed.where.grades.some.gradedBy).toEqual({ not: null });
        expect(completed.select.grades.where.gradedBy).toEqual({ not: null });
      });

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

  describe('assessment-student integrity', () => {
    const admin = { id: 'admin-1', roles: ['super_admin'] };
    const assessmentRow = (over: any = {}) => ({
      id: 'a1', schoolId, levelId: 'l1', groupId: 'g1', deletedAt: null, totalPoints: 10, title: 'Quiz', ...over,
    });

    describe('assignStudents', () => {
      it('assigns only students of the assessment\'s level and group, once each, and reports the rest', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessmentRow());
        prisma.student.findMany.mockResolvedValue([{ id: 'stu-1' }, { id: 'stu-2' }]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([{ studentId: 'stu-2' }]);

        const res = await service.assignStudents('a1', ['stu-1', 'stu-2', 'stu-3', 'stu-1'], staff);

        expect(prisma.student.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ schoolId, levelId: 'l1', groupId: 'g1', deletedAt: null }),
          }),
        );
        expect(prisma.assessmentSubmission.createMany).toHaveBeenCalledWith({
          data: [{ assessmentId: 'a1', studentId: 'stu-1', submissionType: 'assigned', status: 'assigned' }],
        });
        expect(res).toEqual({ assigned: 1, skipped: 3, notEligible: 1 });
      });

      it('does not treat an archived or parent-report row as already assigned', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessmentRow({ groupId: null }));
        prisma.student.findMany.mockResolvedValue([{ id: 'stu-1' }]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);

        await service.assignStudents('a1', ['stu-1'], staff);

        expect(prisma.assessmentSubmission.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: { not: 'superseded' },
              submissionType: { not: 'parent_report' },
            }),
          }),
        );
        expect(prisma.assessmentSubmission.createMany).toHaveBeenCalled();
      });

      it('creates nothing when no student is eligible', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessmentRow());
        prisma.student.findMany.mockResolvedValue([]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);

        const res = await service.assignStudents('a1', ['stu-9'], staff);

        expect(prisma.assessmentSubmission.createMany).not.toHaveBeenCalled();
        expect(res).toEqual({ assigned: 0, skipped: 1, notEligible: 1 });
      });
    });

    describe('unassignStudent', () => {
      it('removes every live record for the pair so a duplicate cannot be left behind', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessmentRow());
        prisma.assessmentSubmission.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
        prisma.grade.deleteMany = jest.fn();
        prisma.assessmentSubmission.deleteMany = jest.fn();

        await service.unassignStudent('a1', 'stu-1', staff);

        expect(prisma.grade.deleteMany).toHaveBeenCalledWith({ where: { submissionId: { in: ['s1', 's2'] } } });
        expect(prisma.assessmentSubmission.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s1', 's2'] } } });
      });

      it('404s when the student has no live record', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessmentRow());
        prisma.assessmentSubmission.findMany.mockResolvedValue([]);
        await expect(service.unassignStudent('a1', 'stu-1', staff)).rejects.toThrow(/not assigned/);
      });
    });

    describe('markStudent for a student with no record', () => {
      it('refuses to create a manual mark for a student outside the assessment\'s level or group', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessmentRow());
        prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
        prisma.student.findUnique.mockResolvedValue({ levelId: 'l2', groupId: 'g1', schoolId });

        await expect(service.markStudent('a1', 'stu-1', 5, 10, undefined, 'admin-1')).rejects.toThrow(/not assigned/);
        expect(prisma.assessmentSubmission.create).not.toHaveBeenCalled();
      });

      it('refuses a student from another school', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessmentRow());
        prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
        prisma.student.findUnique.mockResolvedValue({ levelId: 'l1', groupId: 'g1', schoolId: 'other-school' });

        await expect(service.markStudent('a1', 'stu-1', 5, 10, undefined, 'admin-1')).rejects.toThrow(/not assigned/);
      });
    });

    describe('getStudentsForAssessment', () => {
      it('shows the done record, not a newer pending duplicate', async () => {
        prisma.assessment.findUnique.mockResolvedValue(assessmentRow());
        prisma.student.findMany.mockResolvedValue([
          { id: 'stu-1', firstName: 'Robin', lastName: 'Amir', studentCode: 'STU-00032', grade: null, status: 'active' },
        ]);
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          { id: 'done', studentId: 'stu-1', status: 'completed', attemptNumber: 1, createdAt: new Date('2026-01-01'), grades: [{ questionId: null, score: 8, maxScore: 10, gradedAt: new Date(), grader: null }] },
          { id: 'dupe', studentId: 'stu-1', status: 'assigned', attemptNumber: 1, createdAt: new Date('2026-02-01'), grades: [] },
        ]);

        const [row] = (await service.getStudentsForAssessment('a1', undefined, staff)) as any[];

        expect(row.submissionStatus).toBe('completed');
        expect(row.mark).toBe(8);
      });
    });

    describe('getIntegrityReport', () => {
      const student = { id: 'stu-1', firstName: 'Robin', lastName: 'Amir', studentCode: 'STU-00032', levelId: 'l1', groupId: 'g1', level: { name: 'L1' }, group: { name: 'G1' } };
      const assessment = (over: any = {}) => ({ id: 'a1', title: 'Quiz', levelId: 'l1', groupId: 'g1', totalPoints: 10, level: { name: 'L1' }, group: { name: 'G1' }, ...over });
      const sub = (over: any = {}) => ({
        id: 's', assessmentId: 'a1', studentId: 'stu-1', status: 'assigned', attemptNumber: 1,
        createdAt: new Date('2026-01-01'), submittedAt: new Date('2026-01-01'), submissionType: 'assigned', fileUrl: null,
        grades: [], student, assessment: assessment(), ...over,
      });

      it('finds the done-and-pending duplicate, proposes keeping the done one, and counts it', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          sub({ id: 'done', status: 'completed', grades: [{ questionId: null, score: 8, maxScore: 10 }] }),
          sub({ id: 'pending', createdAt: new Date('2026-02-01') }),
        ]);

        const res = await service.getIntegrityReport('school-1', 'STU-00032');

        expect(prisma.assessmentSubmission.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: { not: 'superseded' },
              submissionType: { not: 'parent_report' },
              student: { deletedAt: null, studentCode: 'STU-00032' },
            }),
          }),
        );
        expect(res.counts).toEqual({ duplicate: 1, notAssigned: 0, reviewOnly: 0 });
        expect(res.findings[0]).toMatchObject({
          kind: 'duplicate',
          student: { name: 'Robin Amir', studentCode: 'STU-00032' },
          keep: { id: 'done', status: 'completed', score: 8, maxScore: 10 },
          archive: [{ id: 'pending', status: 'assigned' }],
          fixable: true,
        });
      });

      it('flags an untouched assignment for an assessment that is not for the student as fixable, and one with work as review-only', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          sub({ id: 'stale', assessmentId: 'old', assessment: assessment({ id: 'old', title: 'Old test', levelId: 'l9' }) }),
          sub({ id: 'worked', assessmentId: 'hist', status: 'completed', assessment: assessment({ id: 'hist', title: 'Last year', groupId: 'g9' }) }),
          sub({ id: 'fine', assessmentId: 'ok' }),
        ]);

        const res = await service.getIntegrityReport('school-1');

        expect(res.scanned).toBe(3);
        expect(res.counts).toEqual({ duplicate: 0, notAssigned: 1, reviewOnly: 1 });
        const stale = res.findings.find((f: any) => f.assessmentId === 'old');
        const worked = res.findings.find((f: any) => f.assessmentId === 'hist');
        expect(stale).toMatchObject({ kind: 'not_assigned', reason: 'level', fixable: true });
        expect(worked).toMatchObject({ kind: 'not_assigned', reason: 'group', fixable: false });
        expect(res.findings.find((f: any) => f.assessmentId === 'ok')).toBeUndefined();
      });

      it('flags an untouched assignment whose audience excludes the student\'s gender, and says which gender it is for', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          sub({
            id: 'wrong-gender', assessmentId: 'girls',
            student: { ...student, gender: 'male' },
            assessment: assessment({ id: 'girls', title: 'Girls quiz', metadata: { gender: 'female' } }),
          }),
          sub({
            id: 'right-gender', assessmentId: 'girls2',
            student: { ...student, gender: 'female' },
            assessment: assessment({ id: 'girls2', metadata: { gender: 'female' } }),
          }),
        ]);

        const res = await service.getIntegrityReport('school-1');

        expect(res.findings).toHaveLength(1);
        expect(res.findings[0]).toMatchObject({
          kind: 'not_assigned', reason: 'gender', fixable: true,
          student: { gender: 'male' }, assessment: { gender: 'female' },
        });
      });

      it('does not report a student\'s earlier retry attempts as duplicates', async () => {
        // The query leaves out superseded attempts, so a retry chain reaches the scan as its
        // one live attempt.
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          sub({ id: 'attempt-2', status: 'completed', attemptNumber: 2, grades: [{ questionId: 'q1', score: 8, maxScore: 10 }] }),
        ]);

        const res = await service.getIntegrityReport('school-1');

        expect(prisma.assessmentSubmission.findMany.mock.calls[0][0].where.status).toEqual({ not: 'superseded' });
        expect(res.counts).toEqual({ duplicate: 0, notAssigned: 0, reviewOnly: 0 });
        expect(res.findings).toEqual([]);
      });

      it('reports nothing for clean data', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([sub()]);
        const res = await service.getIntegrityReport('school-1');
        expect(res.findings).toEqual([]);
        expect(res.counts).toEqual({ duplicate: 0, notAssigned: 0, reviewOnly: 0 });
      });
    });

    describe('fixIntegrity', () => {
      const fixRow = (over: any = {}) => ({
        id: 's', status: 'assigned', attemptNumber: 1, createdAt: new Date('2026-01-01'), metadata: null,
        student: { levelId: 'l1', groupId: 'g1' }, assessment: { levelId: 'l1', groupId: 'g1' }, ...over,
      });
      const item = { assessmentId: 'a1', studentId: 'stu-1' };

      it('merges a duplicate by archiving the weaker record into the one it keeps, and audits it', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          fixRow({ id: 'done', status: 'completed' }),
          fixRow({ id: 'pending', createdAt: new Date('2026-02-01'), metadata: { notes: 'x' } }),
        ]);

        const res = await service.fixIntegrity('school-1', [{ kind: 'duplicate', ...item }], admin);

        expect(prisma.assessmentSubmission.update).toHaveBeenCalledTimes(1);
        expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith({
          where: { id: 'pending' },
          data: {
            status: 'superseded',
            metadata: { notes: 'x', mergedInto: 'done', mergedByAdmin: { at: expect.any(String), by: 'admin-1' } },
          },
        });
        expect(res).toMatchObject({ fixed: 1, failed: 0 });
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'assessment.integrity.merge', entityId: 'done' }));
      });

      it('leaves a student\'s earlier retry attempts alone: only live records are candidates', async () => {
        // A retry chain is one live attempt plus superseded ones the query never returns.
        prisma.assessmentSubmission.findMany.mockResolvedValue([fixRow({ id: 'attempt-2', status: 'completed', attemptNumber: 2 })]);

        const res = await service.fixIntegrity('school-1', [{ kind: 'duplicate', ...item }], admin);

        expect(prisma.assessmentSubmission.findMany.mock.calls[0][0].where.status).toEqual({ not: 'superseded' });
        expect(prisma.assessmentSubmission.update).not.toHaveBeenCalled();
        expect(res.results[0]).toMatchObject({ ok: false, error: 'Already clean' });
      });

      it('treats a gender mismatch as not assigned, and a student of the right gender as now eligible', async () => {
        prisma.assessmentSubmission.findMany
          .mockResolvedValueOnce([fixRow({ id: 'g1', student: { levelId: 'l1', groupId: 'g1', gender: 'male' }, assessment: { levelId: 'l1', groupId: 'g1', metadata: { gender: 'female' } } })])
          .mockResolvedValueOnce([fixRow({ id: 'g2', student: { levelId: 'l1', groupId: 'g1', gender: 'female' }, assessment: { levelId: 'l1', groupId: 'g1', metadata: { gender: 'female' } } })]);

        const res = await service.fixIntegrity('school-1', [
          { kind: 'not_assigned', ...item },
          { kind: 'not_assigned', assessmentId: 'a2', studentId: 'stu-1' },
        ], admin);

        expect(res.results[0]).toMatchObject({ ok: true, archived: 1 });
        expect(res.results[1]).toMatchObject({ ok: false });
        expect(res.results[1].error).toMatch(/eligible/);
      });

      it('removes an untouched not-assigned record but refuses one that carries work', async () => {
        prisma.assessmentSubmission.findMany
          .mockResolvedValueOnce([fixRow({ id: 'stale', assessment: { levelId: 'l9', groupId: null } })])
          .mockResolvedValueOnce([fixRow({ id: 'worked', status: 'completed', assessment: { levelId: 'l9', groupId: null } })]);

        const res = await service.fixIntegrity('school-1', [
          { kind: 'not_assigned', ...item },
          { kind: 'not_assigned', assessmentId: 'a2', studentId: 'stu-1' },
        ], admin);

        expect(prisma.assessmentSubmission.update).toHaveBeenCalledTimes(1);
        expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'stale' }, data: expect.objectContaining({ status: 'superseded' }) }),
        );
        expect(res.results[0]).toMatchObject({ ok: true, archived: 1 });
        expect(res.results[1]).toMatchObject({ ok: false });
        expect(res.results[1].error).toMatch(/review it manually/);
      });

      it('re-checks current data: skips a duplicate that is already clean and a student who is now eligible', async () => {
        prisma.assessmentSubmission.findMany
          .mockResolvedValueOnce([fixRow({ id: 'only' })])
          .mockResolvedValueOnce([fixRow({ id: 'now-ok' })]);

        const res = await service.fixIntegrity('school-1', [
          { kind: 'duplicate', ...item },
          { kind: 'not_assigned', assessmentId: 'a2', studentId: 'stu-1' },
        ], admin);

        expect(prisma.assessmentSubmission.update).not.toHaveBeenCalled();
        expect(res).toMatchObject({ fixed: 0, failed: 2 });
        expect(res.results[0].error).toMatch(/Already clean/);
        expect(res.results[1].error).toMatch(/eligible/);
      });

      it('reports a missing record and one failing item without stopping the rest', async () => {
        prisma.assessmentSubmission.findMany
          .mockResolvedValueOnce([])
          .mockRejectedValueOnce(new Error('db down'))
          .mockResolvedValueOnce([fixRow({ id: 'a', status: 'completed' }), fixRow({ id: 'b' })]);

        const res = await service.fixIntegrity('school-1', [
          { kind: 'duplicate', ...item },
          { kind: 'duplicate', assessmentId: 'a2', studentId: 'stu-1' },
          { kind: 'duplicate', assessmentId: 'a3', studentId: 'stu-1' },
        ], admin);

        expect(res.results.map((r: any) => r.ok)).toEqual([false, false, true]);
        expect(res.results[1].error).toBe('db down');
      });
    });
  });

  describe('prepareRetake', () => {
    const yesterday = () => new Date(Date.now() - 86_400_000);
    const tomorrow = () => new Date(Date.now() + 86_400_000);

    // Total 10, pass mark 5: the default live grades below (none) score 0, a failure.
    const retakeable = (over: any = {}) => ({
      id: 'a1', status: 'published', deletedAt: null,
      allowRetry: true, maxAttempts: 3, passingScore: 5, totalPoints: 10,
      dueDate: null, allowLateSubmission: false,
      questions: [{ id: 'q1', type: 'multiple_choice' }],
      ...over,
    });

    beforeEach(() => {
      prisma.grade.findMany.mockResolvedValue([]);
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

    it('reuses the open attempt on a second call', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable());
      prisma.assessmentSubmission.findFirst.mockResolvedValueOnce({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.assessmentSubmission.create.mockResolvedValue({ id: 's2', attemptNumber: 2 });

      const first = await service.prepareRetake('a1', 'stu-1');

      // The second call finds the attempt the first one opened.
      prisma.assessmentSubmission.findFirst.mockResolvedValueOnce({ id: 's2', status: 'assigned', attemptNumber: 2 });
      const second = await service.prepareRetake('a1', 'stu-1');

      expect(second.newSubmissionId).toBe(first.newSubmissionId);
      expect(prisma.assessmentSubmission.create).toHaveBeenCalledTimes(1);
    });

    it('archives the prior attempt and increments the attempt number', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
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

    it('refuses when allowRetry is off', async () => {
      // A legacy row can keep a stored maxAttempts after retry was switched off.
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ allowRetry: false, maxAttempts: 3 }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });

      await expect(service.prepareRetake('a1', 'stu-1')).rejects.toThrow(/Retakes are not enabled/);
      expect(prisma.assessmentSubmission.create).not.toHaveBeenCalled();
    });

    it('refuses when the student already passed', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.grade.findMany.mockResolvedValue([{ questionId: 'q1', score: 8, maxScore: 10 }]);

      await expect(service.prepareRetake('a1', 'stu-1')).rejects.toThrow(/already passed/);
      expect(prisma.assessmentSubmission.create).not.toHaveBeenCalled();
    });

    it('compares the pass mark on the total scale', async () => {
      // 8/10 on a 100-point assessment is 80 points against a pass mark of 60.
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ totalPoints: 100, passingScore: 60 }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.grade.findMany.mockResolvedValue([{ questionId: null, score: 8, maxScore: 10 }]);

      await expect(service.prepareRetake('a1', 'stu-1')).rejects.toThrow(/already passed/);
    });

    it('refuses when attempts are exhausted', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ maxAttempts: 2 }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's2', status: 'completed', attemptNumber: 2 });

      await expect(service.prepareRetake('a1', 'stu-1')).rejects.toThrow(
        /No attempts remaining/,
      );
    });

    it('refuses after the due date when late submission is not allowed', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ dueDate: yesterday() }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });

      await expect(service.prepareRetake('a1', 'stu-1')).rejects.toThrow(/due date has passed/);
      expect(prisma.assessmentSubmission.create).not.toHaveBeenCalled();
    });

    it('gives a neutral message when a new attempt is blocked for a reason other than the due date', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable());
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'unknown', attemptNumber: 1 });

      await expect(service.prepareRetake('a1', 'stu-1')).rejects.toThrow(
        'A new attempt cannot be started right now',
      );
    });

    it('allows after the due date when late submission is allowed', async () => {
      prisma.assessment.findUnique.mockResolvedValue(
        retakeable({ dueDate: yesterday(), allowLateSubmission: true }),
      );
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.assessmentSubmission.create.mockResolvedValue({ id: 's2', attemptNumber: 2 });

      const res = await service.prepareRetake('a1', 'stu-1');

      expect(res.newSubmissionId).toBe('s2');
    });

    it('allows before the due date', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ dueDate: tomorrow() }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.assessmentSubmission.create.mockResolvedValue({ id: 's2', attemptNumber: 2 });

      const res = await service.prepareRetake('a1', 'stu-1');

      expect(res.newSubmissionId).toBe('s2');
    });

    it('reports remaining attempts when a cap is set', async () => {
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ maxAttempts: 3 }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed', attemptNumber: 1 });
      prisma.assessmentSubmission.create.mockResolvedValue({ id: 's2', attemptNumber: 2 });

      const res = await service.prepareRetake('a1', 'stu-1');

      expect(res.attemptsRemaining).toBe(1);
    });

    it('does not count an attempt an admin discarded against maxAttempts', async () => {
      // resetPendingSubmission reopens the same attempt number, so the live attempt is still 1.
      prisma.assessment.findUnique.mockResolvedValue(retakeable({ maxAttempts: 2 }));
      prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's2', status: 'completed', attemptNumber: 1 });
      prisma.assessmentSubmission.findMany.mockResolvedValue([
        { metadata: { discardedByAdmin: { at: 'x', by: 'admin-1' } } },
        { metadata: null },
      ]);
      prisma.assessmentSubmission.create.mockResolvedValue({ id: 's3', attemptNumber: 2 });

      await expect(service.prepareRetake('a1', 'stu-1')).resolves.toMatchObject({ attemptNumber: 2 });
    });
  });

  describe('getSubmissionReview', () => {
    const yesterday = () => new Date(Date.now() - 86_400_000);

    // Total 10, pass mark 5. Retry is off unless a test turns it on.
    const review = (status: string, grades: any[], over: any = {}, assessmentOver: any = {}) => ({
      id: 'sub1', studentId: 'stu-1', assessmentId: 'a1', status, attemptNumber: 1,
      submissionContent: JSON.stringify([{ questionId: 'q1', answer: 'B' }]),
      submittedAt: new Date(), fileUrl: null, durationSeconds: null, isLate: false,
      metadata: null,
      assessment: {
        id: 'a1', title: 'Quiz', titleAr: null, type: 'quiz',
        totalPoints: 10, passingScore: 5,
        allowRetry: false, maxAttempts: null, dueDate: null, allowLateSubmission: false,
        questions: [{ id: 'q1', questionText: 'Q?', type: 'multiple_choice', options: ['A', 'B'], points: 10, correctAnswer: 'B' }],
        ...assessmentOver,
      },
      grades,
      ...over,
    });
    const g = (score: number, questionId: string | null = 'q1', maxScore = 10) => (
      { questionId, score, maxScore, feedback: null, feedbackAr: null }
    );

    // The viewed row is fetched by id; the live row by the liveSubmission query.
    const open = (viewed: any, live: any = viewed) => {
      prisma.assessmentSubmission.findFirst.mockImplementation(async (args: any) =>
        args.where.id ? viewed : live,
      );
    };

    // Reachable directly with a known submission id, so it must not leak the key early.
    it('withholds the answer key and the score until marking is complete', async () => {
      open(review('submitted', [g(10)]));

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.gradingComplete).toBe(false);
      expect(res.grade.earned).toBeNull();
      expect(res.grade.percentage).toBeNull();
      expect(res.questions[0].correctAnswer).toBeNull();
      expect(res.questions[0].score).toBeNull();
    });

    it('releases the answer key once marking is complete', async () => {
      open(review('completed', [g(10)]));

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.gradingComplete).toBe(true);
      expect(res.questions[0].correctAnswer).toBe('B');
      expect(res.grade.percentage).toBe(100);
    });

    // The servant's overall row and the per-question auto-grades used to be summed
    // together, which double-counted and pushed the percentage past 100.
    it('treats a servant overall mark as authoritative rather than summing it in', async () => {
      open(review('completed', [g(10), g(8, null)]));

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.earned).toBe(8);
      expect(res.grade.percentage).toBe(80);
    });

    it('never reports a percentage above 100', async () => {
      open(review('completed', [g(25, null)]));

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.percentage).toBe(100);
    });

    it('reports passed for a mark exactly on the pass mark (57/100 against 57)', async () => {
      open(review('completed', [g(57, null, 100)], {}, { totalPoints: 100, passingScore: 57 }));

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.passed).toBe(true);
    });

    it('decides passed on the total scale', async () => {
      // 8/10 on a 100-point assessment is 80 points against a pass mark of 60.
      open(review('completed', [g(8, null)], {}, { totalPoints: 100, passingScore: 60 }));

      const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

      expect(res.grade.passed).toBe(true);
    });

    describe('answer-key gate', () => {
      const retry = { allowRetry: true, maxAttempts: 3 };

      it('withholds correctAnswer and per-question marks for a failed student with attempts left', async () => {
        open(review('completed', [g(2)], {}, retry));

        const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

        expect(res.attempt.answerKeyOpen).toBe(false);
        expect(res.questions[0].correctAnswer).toBeNull();
        expect(res.questions[0].isCorrect).toBeNull();
        expect(res.questions[0].score).toBeNull();
        // The student's own answer and overall mark stay visible.
        expect(res.questions[0].studentAnswer).toBe('B');
        expect(res.grade.earned).toBe(2);
      });

      it('releases them once the student passed', async () => {
        open(review('completed', [g(8)], {}, retry));

        const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

        expect(res.attempt.answerKeyOpen).toBe(true);
        expect(res.questions[0].correctAnswer).toBe('B');
        expect(res.questions[0].score).toBe(8);
        expect(res.questions[0].isCorrect).toBe(false);
      });

      it('releases them when attempts are exhausted', async () => {
        open(review('completed', [g(2)], { attemptNumber: 3 }, retry));

        const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

        expect(res.attempt.answerKeyOpen).toBe(true);
        expect(res.questions[0].correctAnswer).toBe('B');
      });

      it('releases them after the due date passes', async () => {
        open(review('completed', [g(2)], {}, { ...retry, dueDate: yesterday() }));

        const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

        expect(res.attempt.canRetry).toBe(false);
        expect(res.attempt.answerKeyOpen).toBe(true);
        expect(res.questions[0].correctAnswer).toBe('B');
      });

      it('releases them when retry is off, whatever maxAttempts is stored', async () => {
        open(review('completed', [g(2)], {}, { allowRetry: false, maxAttempts: 3 }));

        const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

        expect(res.attempt.max).toBe(1);
        expect(res.attempt.answerKeyOpen).toBe(true);
        expect(res.questions[0].correctAnswer).toBe('B');
      });

      // A student who failed attempt 1 and opened attempt 2 must not read the key off
      // attempt 1 by id: it is superseded, and attempt 2 is still in play.
      it('withholds them for a superseded attempt opened by id while a new attempt is open', async () => {
        const viewed = review('superseded', [g(2)], {}, retry);
        const live = { id: 'sub2', status: 'assigned', attemptNumber: 2 };
        open(viewed, live);

        const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

        expect(res.questions[0].correctAnswer).toBeNull();
        expect(res.questions[0].isCorrect).toBeNull();
        expect(res.questions[0].score).toBeNull();
      });

      it('withholds them for a superseded attempt even when the live attempt has since passed', async () => {
        const viewed = review('superseded', [g(2)], {}, retry);
        const live = { id: 'sub2', status: 'completed', attemptNumber: 2 };
        open(viewed, live);
        prisma.grade.findMany.mockResolvedValue([g(8)]);

        const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

        expect(res.attempt.answerKeyOpen).toBe(true);
        expect(res.questions[0].correctAnswer).toBeNull();
        expect(res.questions[0].score).toBeNull();
      });

      it('reports attempt { number, max, remaining, canRetry }', async () => {
        open(review('completed', [g(2)], {}, retry));

        const res: any = await service.getSubmissionReview('sub1', 'stu-1', 'a1');

        expect(res.attempt).toEqual({
          number: 1, max: 3, remaining: 2, canRetry: true, answerKeyOpen: false,
        });
      });
    });
  });

  // An auto-completed submission has per-question grade rows and no overall row.
  describe('marks for auto-completed submissions', () => {
    const row = (status: string, grades: any[]) => ({ studentId: 'stu-1', status, grades });
    const g = (questionId: string | null, score: number, maxScore: number) => ({ questionId, score, maxScore });

    describe('getStudentsForAssessment', () => {
      beforeEach(() => {
        prisma.assessment.findUnique.mockResolvedValue({
          id: 'a1', schoolId: 'school-1', deletedAt: null, levelId: 'l1', groupId: null, totalPoints: 10,
        });
        prisma.student.findMany.mockResolvedValue([
          { id: 'stu-1', firstName: 'A', lastName: 'B', studentCode: 'S1', grade: null, status: 'active' },
        ]);
      });

      it('returns the summed per-question mark for an auto-completed submission', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          row('completed', [g('q1', 3, 5), g('q2', 4, 5)]),
        ]);

        const res: any = await service.getStudentsForAssessment('a1', undefined, staff);

        expect(res[0].mark).toBe(7);
        expect(res[0].maxMark).toBe(10);
      });

      it('keeps the overall mark authoritative when one exists', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          row('completed', [g('q1', 10, 10), g(null, 8, 10)]),
        ]);

        const res: any = await service.getStudentsForAssessment('a1', undefined, staff);

        expect(res[0].mark).toBe(8);
        expect(res[0].maxMark).toBe(10);
      });

      it('shows no mark while a submission is still waiting for review', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          row('submitted', [g('q1', 3, 5)]),
        ]);

        const res: any = await service.getStudentsForAssessment('a1', undefined, staff);

        expect(res[0].mark).toBeNull();
      });
    });

    describe('getStats', () => {
      const completed = (assessment: any, grades: any[]) => ({ grades, assessment });

      beforeEach(() => {
        prisma.assessment.count.mockResolvedValue(1);
        prisma.assessment.groupBy.mockResolvedValue([]);
      });

      it('counts a passing auto-completed submission in passCount', async () => {
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          completed({ passingScore: 5, totalPoints: 10 }, [g('q1', 3, 5), g('q2', 3, 5)]),
          completed({ passingScore: 5, totalPoints: 10 }, [g('q1', 1, 5), g('q2', 1, 5)]),
        ]);

        const res: any = await service.getStats('school-1');

        expect(res.grading).toEqual({ gradedCount: 2, passCount: 1, passRate: 50, avgScore: 4 });
      });

      it('compares an overall mark on the total scale', async () => {
        // 8/10 on a 100-point assessment is 80 points against a pass mark of 60.
        prisma.assessmentSubmission.findMany.mockResolvedValue([
          completed({ passingScore: 60, totalPoints: 100 }, [g(null, 8, 10)]),
        ]);

        const res: any = await service.getStats('school-1');

        expect(res.grading.passCount).toBe(1);
      });
    });
  });

  describe('reassessStudent, unassignStudent and re-assign with retry attempts', () => {
    const open = { id: 'a1', deletedAt: null, schoolId: 'school-1' };

    beforeEach(() => {
      prisma.assessment.findUnique.mockResolvedValue(open);
      prisma.assessmentSubmission.update.mockResolvedValue({ id: 's2' });
    });

    it('reassess targets the live attempt, never a superseded one', async () => {
      // liveSubmission filters out superseded rows; an unfiltered lookup would not.
      prisma.assessmentSubmission.findFirst.mockImplementation(async (args: any) =>
        args.where.status?.not === 'superseded' ? { id: 's2', status: 'completed', attemptNumber: 2 } : { id: 's1', status: 'superseded' },
      );

      await service.reassessStudent('a1', 'stu-1', staff);

      expect(prisma.grade.deleteMany).toHaveBeenCalledWith({ where: { submissionId: 's2' } });
      expect(prisma.assessmentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's2' }, data: { status: 'assigned' } }),
      );
    });

    it('reassess throws NotFoundException when the student has no live attempt', async () => {
      prisma.assessmentSubmission.findFirst.mockResolvedValue(null);

      await expect(service.reassessStudent('a1', 'stu-1', staff)).rejects.toThrow('not assigned');
    });

    it('unassign removes the live row and its grades, and leaves archived attempts alone', async () => {
      prisma.assessmentSubmission.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

      await service.unassignStudent('a1', 'stu-1', staff);

      // Only live rows: superseded attempts and parent reports are history and stay.
      expect(prisma.assessmentSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assessmentId: 'a1', studentId: 'stu-1',
            status: { not: 'superseded' }, submissionType: { not: 'parent_report' },
          },
        }),
      );
      expect(prisma.grade.deleteMany).toHaveBeenCalledWith({ where: { submissionId: { in: ['s1', 's2'] } } });
      expect(prisma.assessmentSubmission.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s1', 's2'] } } });
    });

    it('unassign throws NotFoundException when the student has no live attempt', async () => {
      prisma.assessmentSubmission.findMany.mockResolvedValue([]);

      await expect(service.unassignStudent('a1', 'stu-1', staff)).rejects.toThrow('not assigned');
    });

    it('assigns the student again after an unassign', async () => {
      prisma.assessmentSubmission.findMany.mockResolvedValue([]);

      const res = await service.assignStudents('a1', ['stu-1'], staff);

      expect(res).toEqual({ assigned: 1, skipped: 0, notEligible: 0 });
      expect(prisma.assessmentSubmission.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ assessmentId: 'a1', studentId: 'stu-1', status: 'assigned' })],
      });
    });
  });

  describe('publishAssessment', () => {
    it('rejects publish when assessment has no questions', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', status: 'draft', deletedAt: null, totalPoints: 0 });
      prisma.assessmentQuestion.findMany.mockResolvedValue([]);
      await expect(service.publishAssessment('a1', staff)).rejects.toThrow('Cannot publish assessment without questions');
    });

    it('publishes and auto-assigns group students', async () => {
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', status: 'draft', deletedAt: null, totalPoints: 10, levelId: 'l1', groupId: 'g1', schoolId: 's1' });
      prisma.assessmentQuestion.findMany.mockResolvedValue([{ id: 'q1' }]);
      prisma.student.findMany.mockResolvedValue([{ id: 'stu-1' }, { id: 'stu-2' }]);
      prisma.assessmentSubmission.findMany.mockResolvedValue([]);
      prisma.assessment.update.mockResolvedValue({ id: 'a1', status: 'published' });
      const res = await service.publishAssessment('a1', staff);
      expect(res.status).toBe('published');
      expect(prisma.assessmentSubmission.createMany).toHaveBeenCalled();
    });
  });
});

describe('DTO validation', () => {
  describe('gender audience', () => {
    const make = (gender?: any) => Object.assign(new CreateAssessmentDto(), {
      title: 'Quiz', levelId: '550e8400-e29b-41d4-a716-446655440000', subjectId: '550e8400-e29b-41d4-a716-446655440001',
      totalPoints: 10, passingPoints: 6, ...(gender === undefined ? {} : { gender }),
    });

    it.each([undefined, 'all', 'male', 'female'])('accepts %s', async (g) => {
      expect(await validate(make(g))).toHaveLength(0);
    });

    it.each(['boys', 'MALE', 'other', ''])('rejects %p', async (g) => {
      const errors = await validate(make(g));
      expect(errors.some((e) => e.property === 'gender')).toBe(true);
    });
  });

  describe('submit answers', () => {
    const answers = (n: number) => Array.from({ length: n }, (_, i) => ({
      questionId: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`, answer: 'A',
    }));
    const make = (n: number) => plainToInstance(SubmitAssessmentDto, { answers: answers(n) });

    it('accepts up to 200 answers', async () => {
      expect(await validate(make(200))).toHaveLength(0);
    });

    it('rejects an oversized answer array', async () => {
      const errors = await validate(make(201));
      expect(errors.some((e) => e.property === 'answers')).toBe(true);
    });
  });

  describe('allowRecording', () => {
    const create = (v?: any) => Object.assign(new CreateAssessmentDto(), {
      title: 'Quiz', levelId: '550e8400-e29b-41d4-a716-446655440000', subjectId: '550e8400-e29b-41d4-a716-446655440001',
      totalPoints: 10, passingPoints: 6, ...(v === undefined ? {} : { allowRecording: v }),
    });
    const update = (v?: any) => Object.assign(new UpdateAssessmentDto(), {
      totalPoints: 10, passingPoints: 6, ...(v === undefined ? {} : { allowRecording: v }),
    });

    it.each([undefined, true, false])('create accepts %p', async (v) => {
      expect(await validate(create(v))).toHaveLength(0);
    });

    it.each(['false', 0, 'yes'])('create rejects %p', async (v) => {
      const errors = await validate(create(v));
      expect(errors.some((e) => e.property === 'allowRecording')).toBe(true);
    });

    it.each([undefined, true, false])('update accepts %p', async (v) => {
      expect(await validate(update(v))).toHaveLength(0);
    });

    it.each(['false', 1])('update rejects %p', async (v) => {
      const errors = await validate(update(v));
      expect(errors.some((e) => e.property === 'allowRecording')).toBe(true);
    });
  });

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

  it('rejects maxAttempts of 1 and 11', async () => {
    for (const n of [1, 11]) {
      const dto = new CreateAssessmentDto();
      (dto as any).maxAttempts = n;
      const errors = await validate(dto as any);
      expect(errors.filter(e => e.property === 'maxAttempts').length).toBeGreaterThan(0);
    }
  });

  it('accepts maxAttempts 2..10', async () => {
    for (let n = 2; n <= 10; n++) {
      const dto = new CreateAssessmentDto();
      (dto as any).maxAttempts = n;
      const errors = await validate(dto as any);
      expect(errors.filter(e => e.property === 'maxAttempts')).toHaveLength(0);
    }
  });
});
