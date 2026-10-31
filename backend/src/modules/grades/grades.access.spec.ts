import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GradesService } from './grades.service';
import { AccessScopeService } from '../../common/access-scope.service';
import { buildFixture, CALLERS } from '../../common/testing/scope-fixture';

/**
 * Updating or deleting a class (school grade) by id. Moving a class to another group moves every
 * student in it, so the school and the caller's group both matter. gradeG1 is in group 1, gradeG2 in
 * group 2, gradeB in school B, gradeGone is deleted.
 */
describe('grade routes: access by caller', () => {
  let service: GradesService;
  let prisma: any;

  beforeEach(() => {
    const { prisma: fake } = buildFixture();
    const row = (id: string) => ({ id, name: 'N', nameAr: null, groupId: 'g1', orderIndex: 1, status: 'active', group: { name: 'G' }, _count: { students: 0 } });
    prisma = {
      schoolGrade: { ...fake.schoolGrade, update: jest.fn(async ({ where }: any) => row(where.id)) },
      user: fake.user,
      student: { ...fake.student, count: jest.fn().mockResolvedValue(0), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      group: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) },
    };
    service = new GradesService(
      prisma,
      { resolve: async (s: string) => s } as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      new AccessScopeService(prisma),
    );
  });

  type Caller = keyof typeof CALLERS;
  const MAY_USE_GROUP_1: Record<Caller, boolean> = {
    adminA: true, servantG1: true, servantG2: false, servantUnassigned: true, adminB: false, superAdmin: true,
  };
  const turnedAway = async (run: Promise<unknown>) => {
    try {
      await run;
      return false;
    } catch (e: any) {
      return e instanceof NotFoundException && e.message === 'Grade not found';
    }
  };

  describe.each([
    ['updateGrade', (u: any) => service.updateGrade('gradeG1', { name: 'Renamed' }, u), () => prisma.schoolGrade.update],
    ['deleteGrade', (u: any) => service.deleteGrade('gradeG1', u), () => prisma.schoolGrade.update],
  ])('%s on a group 1 class', (_name, call, write) => {
    it.each(Object.keys(MAY_USE_GROUP_1) as Caller[])('%s', async (caller) => {
      const denied = await turnedAway(call(CALLERS[caller]));
      expect(denied).toBe(!MAY_USE_GROUP_1[caller]);
      if (denied) expect(write()).not.toHaveBeenCalled();
      else expect(write()).toHaveBeenCalled();
    });
  });

  it('another school’s class, a deleted class and a missing class are all 404', async () => {
    for (const id of ['gradeB', 'gradeGone', 'nope']) {
      expect(await turnedAway(service.updateGrade(id, { name: 'X' }, CALLERS.adminA))).toBe(true);
      expect(await turnedAway(service.deleteGrade(id, CALLERS.adminA))).toBe(true);
    }
    expect(prisma.schoolGrade.update).not.toHaveBeenCalled();
    expect(prisma.student.updateMany).not.toHaveBeenCalled();
  });

  it('a user who is not in the database reaches nothing', async () => {
    expect(await turnedAway(service.updateGrade('gradeG1', { name: 'X' }, { id: 'ghost' }))).toBe(true);
    expect(await turnedAway(service.deleteGrade('gradeG1', undefined))).toBe(true);
  });

  describe('moving a class to another group (which moves its students)', () => {
    it('a group 1 servant cannot move their class to group 2', async () => {
      await expect(service.updateGrade('gradeG1', { groupId: 'g2' }, CALLERS.servantG1)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.schoolGrade.update).not.toHaveBeenCalled();
      expect(prisma.student.updateMany).not.toHaveBeenCalled();
    });

    it('an admin can, and the students follow', async () => {
      prisma.schoolGrade.update.mockResolvedValueOnce({
        id: 'gradeG1', name: 'N', nameAr: null, groupId: 'g2', orderIndex: 1, status: 'active', group: { name: 'G' }, _count: { students: 0 },
      });
      await service.updateGrade('gradeG1', { groupId: 'g2' }, CALLERS.adminA);
      expect(prisma.student.updateMany).toHaveBeenCalledWith({ where: { gradeId: 'gradeG1', deletedAt: null }, data: { groupId: 'g2' } });
    });

    it('a servant with no assignment is school-wide, as decided', async () => {
      await expect(service.updateGrade('gradeG1', { groupId: 'g2' }, CALLERS.servantUnassigned)).resolves.toBeDefined();
    });
  });
});
