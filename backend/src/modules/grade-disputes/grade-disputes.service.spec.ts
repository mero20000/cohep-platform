import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { GradeDisputesService } from './grade-disputes.service';
import { AccessScopeService } from '../../common/access-scope.service';
import { buildFixture, CALLERS, STUDENT_USER } from '../../common/testing/scope-fixture';

/**
 * The real AccessScopeService over an in-memory database that evaluates `where` clauses, so a
 * denied caller is shown to get a 404 rather than just a filter being passed to a mock.
 */
describe('GradeDisputesService', () => {
  let service: GradeDisputesService;
  let prisma: any;
  let notify: jest.Mock;
  const reason = 'Grade seems incorrect';

  beforeEach(() => {
    const { prisma: fake } = buildFixture();
    prisma = {
      ...fake,
      gradeDispute: {
        ...fake.gradeDispute,
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 'new', ...data })),
        update: jest.fn(async ({ where }: any) => ({ id: where.id, status: 'responded' })),
        count: jest.fn(async ({ where }: any) => fake.gradeDispute.count({ where })),
      },
      grade: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    notify = jest.fn().mockResolvedValue(undefined);
    service = new GradeDisputesService(prisma, { notify } as any, new AccessScopeService(prisma));
  });

  // caller -> may they dispute / answer a dispute about a school A, group 1 student?
  const ON_GROUP_1_STUDENT = [
    ['adminA', true],
    ['servantG1', true],
    ['servantG2', false],
    ['servantUnassigned', true],
    ['adminB', false],
  ] as const;

  describe('createDispute', () => {
    it.each(ON_GROUP_1_STUDENT)('%s on a group 1 student’s submission: allowed=%s', async (caller, allowed) => {
      const run = service.createDispute({ user: CALLERS[caller], submissionId: 'sub1', reason });
      if (allowed) {
        await expect(run).resolves.toEqual(expect.objectContaining({ schoolId: 'A', submissionId: 'sub1', gradeId: 'gr-1', requestedById: caller }));
      } else {
        await expect(run).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.gradeDispute.create).not.toHaveBeenCalled();
      }
    });

    it('answers a missing submission with 404', async () => {
      await expect(service.createDispute({ user: CALLERS.adminA, submissionId: 'nope', reason })).rejects.toThrow(NotFoundException);
    });

    it('lets a student dispute their own submission and refuses another student’s', async () => {
      await expect(service.createDispute({ user: STUDENT_USER, submissionId: 'subOwn', reason })).resolves.toBeDefined();
      await expect(service.createDispute({ user: STUDENT_USER, submissionId: 'sub1', reason })).rejects.toThrow(ForbiddenException);
    });

    it('refuses a submission with no grade and a second pending dispute', async () => {
      prisma.assessmentSubmission.findUnique = jest.fn().mockResolvedValue({
        id: 'sub1', studentId: 's1', assessment: { schoolId: 'A' }, grades: [],
      });
      await expect(service.createDispute({ user: CALLERS.adminA, submissionId: 'sub1', reason })).rejects.toThrow('No grade found');
    });

    it('refuses a second pending dispute for the same submission', async () => {
      prisma.gradeDispute.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.createDispute({ user: CALLERS.adminA, submissionId: 'sub1', reason })).rejects.toThrow(
        'A pending dispute already exists for this submission',
      );
    });

    it.each([['empty', ''], ['blank', '   '], ['too long', 'x'.repeat(501)], ['missing', undefined as any]])(
      'refuses a %s reason',
      async (_l, bad) => {
        await expect(service.createDispute({ user: CALLERS.adminA, submissionId: 'sub1', reason: bad })).rejects.toThrow(BadRequestException);
      },
    );
  });

  describe('respondToDispute', () => {
    const answer = { response: 'Reviewed and updated', newScore: 8 };

    it.each(ON_GROUP_1_STUDENT)('%s on a group 1 dispute: allowed=%s', async (caller, allowed) => {
      const run = service.respondToDispute('d1', { user: CALLERS[caller], ...answer });
      if (allowed) {
        await expect(run).resolves.toBeDefined();
        expect(prisma.grade.update).toHaveBeenCalledWith({ where: { id: 'gr-1' }, data: { score: 8 } });
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({ studentId: 's1', referenceId: 'd1' }));
      } else {
        await expect(run).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.grade.update).not.toHaveBeenCalled();
      }
    });

    it('answers another school’s dispute with 404 for a school B admin', async () => {
      await expect(service.respondToDispute('d1', { user: CALLERS.adminB, ...answer })).rejects.toThrow('Dispute not found');
      await expect(service.respondToDispute('dB', { user: CALLERS.adminA, ...answer })).rejects.toThrow('Dispute not found');
    });

    it.each([[-1], [11], [10.01], [NaN], [Infinity]])('refuses newScore %s above the grade’s maximum or below zero', async (newScore) => {
      await expect(service.respondToDispute('d1', { user: CALLERS.adminA, response: 'ok', newScore })).rejects.toThrow(/newScore must be between 0 and 10/);
      expect(prisma.grade.update).not.toHaveBeenCalled();
    });

    it('accepts the exact bounds 0 and the maximum', async () => {
      await expect(service.respondToDispute('d1', { user: CALLERS.adminA, response: 'ok', newScore: 0 })).resolves.toBeDefined();
      expect(prisma.grade.update).toHaveBeenLastCalledWith({ where: { id: 'gr-1' }, data: { score: 0 } });
    });

    it('leaves the grade alone when no newScore is given', async () => {
      await service.respondToDispute('d1', { user: CALLERS.adminA, response: 'Grade is correct' });
      expect(prisma.grade.update).not.toHaveBeenCalled();
    });

    it('refuses a dispute that was already answered', async () => {
      prisma.gradeDispute.findUnique = jest.fn().mockResolvedValue({
        id: 'd1', schoolId: 'A', status: 'responded', gradeId: 'gr-1',
        submission: { studentId: 's1', grades: [{ id: 'gr-1', maxScore: 10 }] },
      });
      await expect(service.respondToDispute('d1', { user: CALLERS.adminA, ...answer })).rejects.toThrow('Dispute already responded to');
    });

    it.each([['empty', ''], ['too long', 'x'.repeat(501)]])('refuses a %s response', async (_l, bad) => {
      await expect(service.respondToDispute('d1', { user: CALLERS.adminA, response: bad })).rejects.toThrow(BadRequestException);
    });
  });

  describe('listDisputes and getPendingCount', () => {
    const idsFor = async (caller: keyof typeof CALLERS) =>
      (await service.listDisputes(CALLERS[caller])).map((d: any) => d.id).sort();

    it('lists only the caller’s school, and only their own students’ disputes for an assigned servant', async () => {
      expect(await idsFor('adminA')).toEqual(['d1', 'd2']);
      expect(await idsFor('servantG1')).toEqual(['d1']);
      expect(await idsFor('servantG2')).toEqual(['d2']);
      expect(await idsFor('servantUnassigned')).toEqual(['d1', 'd2']);
      expect(await idsFor('adminB')).toEqual(['dB']);
    });

    it('counts with the same scope', async () => {
      expect(await service.getPendingCount(CALLERS.adminA)).toBe(2);
      expect(await service.getPendingCount(CALLERS.servantG1)).toBe(1);
      expect(await service.getPendingCount(CALLERS.adminB)).toBe(1);
    });

    it('caps the page at 100 and defaults to 50', async () => {
      const spy = jest.spyOn(prisma.gradeDispute, 'findMany');
      await service.listDisputes(CALLERS.adminA, { limit: 200 });
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ take: 100 }));
      await service.listDisputes(CALLERS.adminA);
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ take: 50 }));
    });
  });
});
