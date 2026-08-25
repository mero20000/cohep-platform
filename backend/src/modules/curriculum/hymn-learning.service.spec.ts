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
    prisma.lessonProgress.upsert.mockResolvedValue({ id: 'p1' } as any);
    prisma.hymnPracticeSession.create.mockResolvedValue({ id: 's1' } as any);
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
