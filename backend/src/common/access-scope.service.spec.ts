import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessScopeService, NO_SCHOOL } from './access-scope.service';
import { buildFixture, CALLERS } from './testing/scope-fixture';

describe('AccessScopeService', () => {
  const { prisma } = buildFixture();
  const access = new AccessScopeService(prisma);
  const actorOf = (k: keyof typeof CALLERS) => access.loadActor(CALLERS[k]);

  describe('loadActor', () => {
    it('reads school, roles and the assignment from the profile', async () => {
      expect(await actorOf('servantG1')).toEqual({
        id: 'servantG1', schoolId: 'A', roles: ['servant'], isSuperAdmin: false, scope: { groupId: 'g1', levelId: 'L1' },
      });
    });

    it('treats a servant with no assignment as school-wide', async () => {
      expect((await actorOf('servantUnassigned')).scope).toEqual({});
    });

    it('never narrows an admin, whatever is on the profile', async () => {
      const a = await access.loadActor({ id: 'adminA' });
      expect(a.scope).toEqual({});
    });

    it('limits an assigned servant by teaching gender but not "both"', async () => {
      const { prisma: p } = buildFixture();
      p.user = { findUnique: async () => ({ id: 'x', schoolId: 'A', isActive: true, deletedAt: null, metadata: { groupId: 'g1', teachingGender: 'female' }, userRoles: [{ role: { name: 'group_leader' } }] }) };
      expect((await new AccessScopeService(p).loadActor({ id: 'x' })).scope).toEqual({ groupId: 'g1', gender: 'female' });
      p.user = { findUnique: async () => ({ id: 'x', schoolId: 'A', isActive: true, deletedAt: null, metadata: { groupId: 'g1', teachingGender: 'both' }, userRoles: [{ role: { name: 'group_leader' } }] }) };
      expect((await new AccessScopeService(p).loadActor({ id: 'x' })).scope).toEqual({ groupId: 'g1' });
    });

    it.each([
      ['no user', undefined],
      ['an unknown user', { id: 'ghost' }],
    ])('matches nothing for %s', async (_l, user) => {
      const a = await access.loadActor(user);
      expect(a.schoolId).toBeNull();
      expect(access.schoolWhere(a)).toEqual({ schoolId: NO_SCHOOL });
      await expect(access.assertStudent(a, 's1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('matches nothing for a deactivated or deleted user', async () => {
      const { prisma: p } = buildFixture();
      p.user = { findUnique: async () => ({ id: 'x', schoolId: 'A', isActive: false, deletedAt: null, metadata: null, userRoles: [{ role: { name: 'admin' } }] }) };
      expect((await new AccessScopeService(p).loadActor({ id: 'x' })).schoolId).toBeNull();
    });

    it('builds the demo guest from the token, without a database row', async () => {
      const a = await access.loadActor({ id: 'demo-guest', isDemo: true, schoolId: 'A' });
      expect(a).toEqual({ id: 'demo-guest', schoolId: 'A', roles: ['demo_viewer'], isSuperAdmin: false, scope: {} });
    });
  });

  // Rows: caller -> student -> expected. true = found, false = 404.
  describe('assertStudent', () => {
    it.each([
      ['adminA', 's1', true],
      ['adminA', 's2', true],
      ['adminA', 'sB', false],
      ['adminA', 'sGone', false],
      ['servantG1', 's1', true],
      ['servantG1', 's2', false],
      ['servantG2', 's1', false],
      ['servantG2', 's2', true],
      ['servantUnassigned', 's1', true],
      ['servantUnassigned', 's2', true],
      ['servantUnassigned', 'sB', false],
      ['adminB', 's1', false],
      ['adminB', 'sB', true],
      ['superAdmin', 's1', true],
      ['superAdmin', 'sB', true],
    ] as const)('%s on %s: found=%s', async (caller, studentId, found) => {
      const result = access.assertStudent(await actorOf(caller), studentId);
      if (found) await expect(result).resolves.toEqual(expect.objectContaining({ id: studentId }));
      else await expect(result).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertAssessment', () => {
    it.each([
      ['adminA', 'a1', true],
      ['adminA', 'a2', true],
      ['adminA', 'aB', false],
      ['adminA', 'aGone', false],
      ['servantG1', 'a1', true],
      ['servantG1', 'a2', false],
      ['servantG1', 'aWide', true],
      ['servantG2', 'a1', false],
      ['servantG2', 'a2', true],
      ['servantUnassigned', 'a1', true],
      ['servantUnassigned', 'a2', true],
      ['adminB', 'a1', false],
      ['adminB', 'aB', true],
      ['superAdmin', 'aB', true],
    ] as const)('%s on %s: found=%s', async (caller, assessmentId, found) => {
      const result = access.assertAssessment(await actorOf(caller), assessmentId);
      if (found) await expect(result).resolves.toEqual(expect.objectContaining({ id: assessmentId }));
      else await expect(result).rejects.toThrow('Assessment not found');
    });
  });

  describe('studentWhere / list filters', () => {
    it('lists only the students the caller may touch', async () => {
      const ids = async (k: keyof typeof CALLERS) =>
        (await prisma.student.findMany({ where: access.studentWhere(await actorOf(k)) })).map((s: any) => s.id).sort();
      // stuUser is a student who is also a user, in group 1
      expect(await ids('adminA')).toEqual(['s1', 's2', 'stuUser']);
      expect(await ids('servantG1')).toEqual(['s1', 'stuUser']);
      expect(await ids('servantG2')).toEqual(['s2']);
      expect(await ids('servantUnassigned')).toEqual(['s1', 's2', 'stuUser']);
      expect(await ids('adminB')).toEqual(['sB']);
      expect(await ids('superAdmin')).toEqual(['s1', 's2', 'sB', 'stuUser']);
    });
  });

  describe('assertAssessmentAndStudent', () => {
    it('passes when the caller may touch both', async () => {
      await expect(access.assertAssessmentAndStudent(await actorOf('servantG1'), 'a1', 's1')).resolves.toBeDefined();
    });
    it('404s on a student outside the caller’s group even when the assessment is theirs', async () => {
      await expect(access.assertAssessmentAndStudent(await actorOf('servantG1'), 'aWide', 's2')).rejects.toThrow('Student not found');
    });
    it('404s when the student and the assessment are in different schools (super admin)', async () => {
      await expect(access.assertAssessmentAndStudent(await actorOf('superAdmin'), 'a1', 'sB')).rejects.toThrow('Student not found');
    });
  });

  describe('assertInSchool and assertGroupAllowed', () => {
    it('404s on another school and on a missing record', async () => {
      const a = await actorOf('adminA');
      expect(() => access.assertInSchool(a, { schoolId: 'A' })).not.toThrow();
      expect(() => access.assertInSchool(a, { schoolId: 'B' }, 'Grade')).toThrow('Grade not found');
      expect(() => access.assertInSchool(a, null, 'Grade')).toThrow('Grade not found');
    });
    it('lets only the caller’s own group through for a group-limited servant', async () => {
      const g1 = await actorOf('servantG1');
      const open = await actorOf('servantUnassigned');
      const admin = await actorOf('adminA');
      expect(() => access.assertGroupAllowed(g1, 'g1')).not.toThrow();
      expect(() => access.assertGroupAllowed(g1, 'g2')).toThrow(ForbiddenException);
      expect(() => access.assertGroupAllowed(open, 'g2')).not.toThrow();
      expect(() => access.assertGroupAllowed(admin, 'g2')).not.toThrow();
    });
  });
});
