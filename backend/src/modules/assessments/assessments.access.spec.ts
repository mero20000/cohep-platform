import { NotFoundException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AccessScopeService } from '../../common/access-scope.service';
import { buildFixture, CALLERS } from '../../common/testing/scope-fixture';

/**
 * Who may reach which assessment and student through each by-id route, against the real
 * AccessScopeService and an in-memory database that evaluates `where`. A denied caller must get a
 * 404 and must change nothing; an allowed caller must get past the gate.
 *
 * Callers: admin of school A, servant of group 1, servant of group 2, servant with no assignment
 * (school-wide by decision), admin of school B. Data: assessment a1 and student s1 are group 1,
 * a2 and s2 are group 2, aWide is for the whole level, aB and sB are school B.
 */
describe('assessment routes: access by caller', () => {
  let service: AssessmentsService;
  let prisma: any;
  let writes: jest.Mock[];

  beforeEach(() => {
    const { prisma: fake } = buildFixture();
    const write = () => jest.fn().mockResolvedValue({ count: 0 });
    prisma = {
      user: fake.user,
      student: fake.student,
      assessment: { ...fake.assessment, update: write() },
      assessmentSubmission: {
        ...fake.assessmentSubmission,
        create: write(), createMany: write(), update: write(), delete: write(), deleteMany: write(),
      },
      assessmentQuestion: { findMany: jest.fn().mockResolvedValue([]), updateMany: write(), create: write(), deleteMany: write() },
      grade: { create: write(), update: write(), createMany: write(), deleteMany: write(), findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      xPTransaction: { deleteMany: write() },
      level: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
      group: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
      subject: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
      lesson: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
      $transaction: jest.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
    };
    writes = [
      prisma.assessment.update, prisma.assessmentSubmission.create, prisma.assessmentSubmission.createMany,
      prisma.assessmentSubmission.update, prisma.assessmentSubmission.delete, prisma.assessmentSubmission.deleteMany,
      prisma.assessmentQuestion.updateMany, prisma.assessmentQuestion.create, prisma.assessmentQuestion.deleteMany,
      prisma.grade.create, prisma.grade.update, prisma.grade.createMany, prisma.grade.deleteMany,
      prisma.xPTransaction.deleteMany, prisma.$transaction,
    ];
    service = new AssessmentsService(
      prisma,
      { resolve: async (s: string) => s } as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      { notify: jest.fn(), notifyOrRefresh: jest.fn() } as any,
      new AccessScopeService(prisma),
    );
  });

  type Caller = keyof typeof CALLERS;
  const ALL: Caller[] = ['adminA', 'servantG1', 'servantG2', 'servantUnassigned', 'adminB'];

  /** Passed the gate, or was turned away at it. Anything else the route does afterwards is irrelevant here. */
  const reachedRoute = async (run: Promise<unknown>) => {
    try {
      await run;
      return true;
    } catch (e: any) {
      return !(e instanceof NotFoundException && /^(Assessment|Student) not found$/.test(e.message));
    }
  };

  // [route name, call, who may use it on a1/s1]
  const GROUP_1_ONLY: Array<[string, (u: any) => Promise<unknown>]> = [
    ['findOne', (u) => service.findOne('a1', u)],
    ['update', (u) => service.update('a1', { totalPoints: 100, passingPoints: 60, title: 'T' }, u)],
    ['delete', (u) => service.delete('a1', u)],
    ['publish', (u) => service.publishAssessment('a1', u)],
    ['getSubmissions', (u) => service.getSubmissions('a1', u)],
    ['assignStudents', (u) => service.assignStudents('a1', ['s1'], u)],
    ['getStudentsForAssessment', (u) => service.getStudentsForAssessment('a1', undefined, u)],
    ['unassignStudent', (u) => service.unassignStudent('a1', 's1', u)],
    ['reassessStudent', (u) => service.reassessStudent('a1', 's1', u)],
    ['markStudent', (u) => service.markStudent('a1', 's1', 5, 10, undefined, u.id, { actor: u })],
    ['returnSubmission', (u) => service.returnSubmission('a1', 's1', 'redo', u)],
    ['getTakeQuestions', (u) => service.getTakeQuestions('a1', 's1', u)],
    ['submit (proxy)', (u) => service.submit('a1', 's1', { answers: [] }, u)],
  ];
  const MAY_USE: Record<Caller, boolean> = {
    adminA: true, servantG1: true, servantG2: false, servantUnassigned: true, adminB: false, superAdmin: true,
  };

  describe.each(GROUP_1_ONLY)('%s on a group 1 assessment and student', (_name, call) => {
    it.each([...ALL, 'superAdmin' as Caller])('%s', async (caller) => {
      const reached = await reachedRoute(call(CALLERS[caller]));
      expect(reached).toBe(MAY_USE[caller]);
      if (!MAY_USE[caller]) writes.forEach((w) => expect(w).not.toHaveBeenCalled());
    });
  });

  it('a user who is not in the database reaches nothing', async () => {
    for (const [, call] of GROUP_1_ONLY) expect(await reachedRoute(call({ id: 'ghost' }))).toBe(false);
    expect(await reachedRoute(GROUP_1_ONLY[0][1](undefined))).toBe(false);
    writes.forEach((w) => expect(w).not.toHaveBeenCalled());
  });

  describe('another school’s records are 404 for everyone in school A, whatever the route', () => {
    const FOREIGN: Array<[string, (u: any) => Promise<unknown>]> = [
      ['findOne', (u) => service.findOne('aB', u)],
      ['update', (u) => service.update('aB', { totalPoints: 100, passingPoints: 60 }, u)],
      ['delete', (u) => service.delete('aB', u)],
      ['markStudent', (u) => service.markStudent('aB', 'sB', 5, 10, undefined, u.id, { actor: u })],
      ['assignStudents', (u) => service.assignStudents('aB', ['sB'], u)],
    ];
    it.each(FOREIGN)('%s', async (_n, call) => {
      for (const caller of ['adminA', 'servantG1', 'servantUnassigned'] as Caller[]) {
        expect(await reachedRoute(call(CALLERS[caller]))).toBe(false);
      }
      writes.forEach((w) => expect(w).not.toHaveBeenCalled());
    });
  });

  describe('student-level routes check the student as well as the assessment', () => {
    it('a group 1 servant cannot act on a group 2 student through a level-wide assessment', async () => {
      const u = CALLERS.servantG1;
      expect(await reachedRoute(service.markStudent('aWide', 's2', 5, 10, undefined, u.id, { actor: u }))).toBe(false);
      expect(await reachedRoute(service.unassignStudent('aWide', 's2', u))).toBe(false);
      expect(await reachedRoute(service.reassessStudent('aWide', 's2', u))).toBe(false);
      expect(await reachedRoute(service.returnSubmission('aWide', 's2', 'x', u))).toBe(false);
      expect(await reachedRoute(service.getTakeQuestions('aWide', 's2', u))).toBe(false);
      writes.forEach((w) => expect(w).not.toHaveBeenCalled());
    });

    it('the same servant can act on their own student through it', async () => {
      const u = CALLERS.servantG1;
      expect(await reachedRoute(service.markStudent('aWide', 's1', 5, 10, undefined, u.id, { actor: u }))).toBe(true);
    });

    it('a student from another school cannot be marked on a school A assessment by a super admin', async () => {
      const u = CALLERS.superAdmin;
      expect(await reachedRoute(service.markStudent('a1', 'sB', 5, 10, undefined, u.id, { actor: u }))).toBe(false);
    });
  });

  describe('lists are filtered to the caller’s students', () => {
    const submissionIds = async (c: Caller) =>
      ((await service.getSubmissions('aWide', CALLERS[c])) as any[]).map((s) => s.id).sort();
    const studentIds = async (c: Caller) =>
      ((await service.getStudentsForAssessment('aWide', undefined, CALLERS[c])) as any[]).map((s) => s.id).sort();

    it('submissions', async () => {
      expect(await submissionIds('adminA')).toEqual(['subW1', 'subW2']);
      expect(await submissionIds('servantG1')).toEqual(['subW1']);
      expect(await submissionIds('servantG2')).toEqual(['subW2']);
      expect(await submissionIds('servantUnassigned')).toEqual(['subW1', 'subW2']);
    });

    it('students of an assessment', async () => {
      expect(await studentIds('adminA')).toEqual(['s1', 's2', 'stuUser']);
      expect(await studentIds('servantG1')).toEqual(['s1', 'stuUser']);
      expect(await studentIds('servantG2')).toEqual(['s2']);
    });

    it('assign counts a student outside the caller’s group as not eligible', async () => {
      // s1 and s2 both already have a live record on aWide, so nothing is created either way.
      expect(await service.assignStudents('aWide', ['s1', 's2'], CALLERS.servantG1)).toEqual({ assigned: 0, skipped: 2, notEligible: 1 });
      expect(await service.assignStudents('aWide', ['s1', 's2'], CALLERS.adminA)).toEqual({ assigned: 0, skipped: 2, notEligible: 0 });
      expect(await service.assignStudents('aWide', ['s1', 's2'], CALLERS.servantUnassigned)).toEqual({ assigned: 0, skipped: 2, notEligible: 0 });
    });
  });

  describe('a servant may not point an assessment at another group', () => {
    it('refuses moving it to a group outside their own', async () => {
      await expect(
        service.update('a1', { totalPoints: 100, passingPoints: 60, groupId: 'g2' }, CALLERS.servantG1),
      ).rejects.toThrow('You can only use your own group');
      expect(prisma.assessment.update).not.toHaveBeenCalled();
    });
    it('lets an admin do it', async () => {
      await service.update('a1', { totalPoints: 100, passingPoints: 60, groupId: 'g2' }, CALLERS.adminA);
      expect(prisma.assessment.update).toHaveBeenCalled();
    });
  });
});
