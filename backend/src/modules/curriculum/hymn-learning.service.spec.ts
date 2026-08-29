import { Test, TestingModule } from '@nestjs/testing';
import { HymnLearningService } from './hymn-learning.service';
import { PrismaService } from '../../database/prisma.service';

describe('HymnLearningService - subject item recording on hymn map', () => {
  let svc: HymnLearningService;
  let prisma: any;

  const prismaMock = {
    lesson: { findMany: jest.fn() },
    student: { findUnique: jest.fn() },
    studentParent: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    hymnPracticeSession: { findUnique: jest.fn(), create: jest.fn() },
    lessonProgress: { findUnique: jest.fn(), upsert: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HymnLearningService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    svc = module.get<HymnLearningService>(HymnLearningService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('includes subjectItem recording url on hymn map', async () => {
    prisma.lesson.findMany = jest.fn().mockResolvedValue([{
      id: 'l1', title: 'H', level: { id: 'lv', number: 1, name: 'L1' },
      subject: { id: 's1', name: 'Coptic Hymns', color: '#000' },
      lessonProgress: [], resources: [], audioUrl: null,
      subjectItem: { id: 'si1', name: 'Hymn', recordingUrl: 'https://r/rec.mp3', recordingMeta: { originalName: 'rec.mp3' } },
    }]);
    const res = await svc.getStudentHymnMap('stu1', 'sch1');
    expect(res[0].referenceRecordingUrl).toBe('https://r/rec.mp3');
    expect(res[0].referenceRecordingName).toBe('rec.mp3');
  });
});

describe('HymnLearningService - student-scoped write ownership (P-C1)', () => {
  let svc: HymnLearningService;
  let prisma: any;

  const prismaMock = {
    lesson: { findFirst: jest.fn() },
    student: { findUnique: jest.fn() },
    studentParent: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    hymnPracticeSession: { findUnique: jest.fn(), create: jest.fn() },
    lessonProgress: { findUnique: jest.fn(), upsert: jest.fn() },
  };

  const student = { id: 'stu1', groupId: 'g1', parentEmail: null, deletedAt: null };
  const dto = { studentId: 'stu1', lessonId: 'l1', schoolId: 'sch1', selfRating: 4 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HymnLearningService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    svc = module.get<HymnLearningService>(HymnLearningService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.lesson.findFirst.mockResolvedValue({ id: 'l1', schoolId: 'sch1' } as any);
    prisma.lessonProgress.upsert.mockResolvedValue({ id: 'p1' } as any);
    prisma.hymnPracticeSession.create.mockResolvedValue({ id: 's1' } as any);
  });

  describe('deletePracticeSession recomputes rather than wiping', () => {
    const sess = (over: any = {}) => ({
      studentId: 'stu1', lessonId: 'l1', progressId: 'p1', ...over,
    });

    beforeEach(() => {
      prisma.hymnPracticeSession.findUnique
        .mockResolvedValueOnce(sess())          // ownership lookup
        .mockResolvedValueOnce({ servantReviewedAt: null }); // reviewed check
      prisma.hymnPracticeSession.delete = jest.fn().mockResolvedValue({});
      prisma.hymnPracticeSession.findMany = jest.fn();
      prisma.lessonProgress.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.lessonProgress.update = jest.fn().mockResolvedValue({});
    });

    it('keeps progress when sessions survive the deletion', async () => {
      const day = (n: number) => new Date(2026, 0, n);
      prisma.hymnPracticeSession.findMany.mockResolvedValue([
        { selfRating: 5, servantRating: null, createdAt: day(1) },
        { selfRating: 5, servantRating: null, createdAt: day(2) },
        { selfRating: 5, servantRating: null, createdAt: day(3) },
      ]);

      await svc.deletePracticeSession('sess9', { id: 'stu1' });

      const data = prisma.lessonProgress.update.mock.calls[0][0].data;
      expect(data.sessionsCompleted).toBe(3);
      expect(data.srRepetitions).toBe(3);
      expect(data.masteryStatus).not.toBe('not_started');
    });

    it('resets to not_started only when nothing is left', async () => {
      prisma.hymnPracticeSession.findMany.mockResolvedValue([]);

      await svc.deletePracticeSession('sess9', { id: 'stu1' });

      const data = prisma.lessonProgress.update.mock.calls[0][0].data;
      expect(data.sessionsCompleted).toBe(0);
      expect(data.masteryStatus).toBe('not_started');
    });

    it('lets a servant rating override an inflated self-rating', async () => {
      prisma.hymnPracticeSession.findMany.mockResolvedValue([
        { selfRating: 5, servantRating: 1, createdAt: new Date(2026, 0, 1) },
      ]);

      await svc.deletePracticeSession('sess9', { id: 'stu1' });

      // quality 1 is below the SM-2 pass threshold, so repetitions stay at 0.
      const data = prisma.lessonProgress.update.mock.calls[0][0].data;
      expect(data.srRepetitions).toBe(0);
      expect(data.masteryStatus).toBe('not_started');
    });
  });

  it('rejects a lessonId belonging to another school (403)', async () => {
    prisma.lesson.findFirst.mockResolvedValue({ id: 'l1', schoolId: 'other-school' } as any);
    await expect(
      svc.logPracticeSession(dto, { id: 'stu1' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an unknown lessonId (404)', async () => {
    prisma.lesson.findFirst.mockResolvedValue(null);
    await expect(
      svc.logPracticeSession(dto, { id: 'stu1' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects unrelated parent logging practice for a student (403)', async () => {
    prisma.studentParent.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ email: 'other@x.com' });
    await expect(
      svc.logPracticeSession(dto, { id: 'par1', roles: ['parent'] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows parent for own child via StudentParent link', async () => {
    prisma.studentParent.findUnique.mockResolvedValue({ id: 'link1' });
    const res = await svc.logPracticeSession(dto, { id: 'par1', roles: ['parent'] });
    expect(res.mastery).toBeDefined();
  });

  it('allows servant whose metadata.groupId matches the student group', async () => {
    await expect(
      svc.logPracticeSession(dto, { id: 'srv1', roles: ['servant'], metadata: { groupId: 'g1' } }),
    ).resolves.toBeDefined();
  });

  it('rejects servant from another group', async () => {
    await expect(
      svc.logPracticeSession(dto, { id: 'srv2', roles: ['servant'], metadata: { groupId: 'g2' } }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('bypasses admin', async () => {
    await expect(
      svc.logPracticeSession(dto, { id: 'adm1', roles: ['admin'] }),
    ).resolves.toBeDefined();
  });

  it('review session checks ownership of the session student', async () => {
    prisma.hymnPracticeSession.findUnique.mockResolvedValue({ id: 'sess1', studentId: 'stu1' });
    prisma.hymnPracticeSession.update = jest.fn().mockResolvedValue({});
    await expect(
      svc.reviewSession('sess1', 'srvX', { servantRating: 4 }, { id: 'srv2', roles: ['servant'], metadata: { groupId: 'g9' } }),
    ).rejects.toMatchObject({ status: 403 });

    prisma.clearAllMocks?.();
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.hymnPracticeSession.findUnique.mockResolvedValue({ id: 'sess1', studentId: 'stu1' });
    await expect(
      svc.reviewSession('sess1', 'srv1', { servantRating: 4 }, { id: 'srv1', roles: ['servant'], metadata: { groupId: 'g1' } }),
    ).resolves.toBeDefined();
  });
});
