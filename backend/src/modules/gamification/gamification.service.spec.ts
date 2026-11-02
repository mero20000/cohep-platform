import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';

describe('GamificationService - getLeaderboard parent scoping', () => {
  let svc: GamificationService;
  let prisma: any;

  const prismaMock = {
    xPTransaction: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    student: { findUnique: jest.fn(), findMany: jest.fn() },
    studentBadge: { count: jest.fn(), groupBy: jest.fn() },
    studentParent: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };

  const row = (id: string, xp: number, rank: number, firstName = 'F', lastName = 'Last') => ({
    id, firstName, lastName, xp, level: Math.floor(xp / 100) + 1, streak: 0, rank, badgeCount: 0,
  });

  // getLeaderboard calls student.findMany twice with different `where` shapes
  // in the parent-scoped path — once to batch-fetch names for the ids already
  // on the leaderboard (`where.id.in`), once to find email-linked children
  // (`where.parentEmail`). Both go through this same mock function, so it has
  // to branch on shape rather than let a test blanket-override it, or setting
  // up the second call silently breaks the first.
  let emailLinkedStudents: any[] = []

  const seedLeaderboard = () => {
    emailLinkedStudents = []
    prisma.xPTransaction.groupBy.mockResolvedValue([
      { studentId: 's1', _sum: { amount: 500 } },
      { studentId: 's2', _sum: { amount: 400 } },
      { studentId: 's3', _sum: { amount: 300 } },
      { studentId: 's4', _sum: { amount: 200 } },
    ]);
    prisma.student.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({ id: where.id, firstName: 'First' + where.id.slice(1), lastName: 'Sur' }));
    prisma.student.findMany.mockImplementation(({ where }: any) => {
      if (where?.id?.in) {
        return Promise.resolve((where.id.in as string[]).map((id: string) => ({ id, firstName: 'First' + id.slice(1), lastName: 'Sur' })));
      }
      return Promise.resolve(emailLinkedStudents);
    });
    prisma.studentBadge.count.mockResolvedValue(0);
    prisma.studentBadge.groupBy.mockResolvedValue([]);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue('sch1') } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    svc = module.get<GamificationService>(GamificationService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    seedLeaderboard();
  });

  it('returns full list for staff callers (unchanged)', async () => {
    const res = await svc.getLeaderboard('sch1', 20, { id: 'u1', roles: ['servant'] });
    expect(Array.isArray(res)).toBe(true);
    expect(res[0]).toMatchObject({ rank: 1, lastName: 'Sur' });
  });

  it('returns top3 minimal + own children for parent-only callers', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'p@x.com' });
    prisma.studentParent.findMany.mockResolvedValue([{ studentId: 's3' }]);
    emailLinkedStudents = [];

    const res: any = await svc.getLeaderboard('sch1', 20, { id: 'par1', roles: ['parent'] });

    expect(res.top3).toHaveLength(3);
    expect(res.top3[0]).toEqual({ rank: 1, firstName: 'First1', lastInitial: 'S', xp: 500 });
    expect(JSON.stringify(res.top3)).not.toContain('lastName');
    expect(JSON.stringify(res.top3)).not.toContain('photoUrl');
    expect(res.children.map((c: any) => c.id)).toEqual(['s3']);
    expect(res.children[0]).toMatchObject({ rank: 3, lastName: 'Sur' });
  });

  it('includes email-linked children too', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'p@x.com' });
    prisma.studentParent.findMany.mockResolvedValue([]);
    emailLinkedStudents = [{ id: 's2' }, { id: 's4' }];

    const res: any = await svc.getLeaderboard('sch1', 20, { id: 'par1', roles: ['parent'] });
    expect(res.children.map((c: any) => c.id)).toEqual(['s2', 's4']);
  });

  it('falls back to full list when no requestingUser', async () => {
    const res = await svc.getLeaderboard('sch1', 20);
    expect(Array.isArray(res)).toBe(true);
  });
});

describe('GamificationService - points_total late/absent/excused config', () => {
  let svc: GamificationService;
  let prisma: any;

  const pointsBadge = {
    id: 'badge-points', schoolId: 'sch1', isActive: true,
    criteria: { rule: 'points_total', points: 10 }, xpReward: 0,
  };
  const mixedRecords = [
    { status: 'present' },
    { status: 'late' },
    { status: 'absent' },
    { status: 'excused' },
  ];

  beforeEach(async () => {
    const prismaMock: any = {
      student: { findUnique: jest.fn().mockResolvedValue({ id: 's1', schoolId: 'sch1', groupId: null }) },
      badge: { findMany: jest.fn().mockResolvedValue([pointsBadge]) },
      studentBadge: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue(mixedRecords) },
      systemConfig: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prismaMock)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue('sch1') } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    svc = module.get<GamificationService>(GamificationService);
    prisma = module.get(PrismaService);
  });

  it('counts configured late/absent/excused points toward the badge', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({ value: { latePoints: 3, absentPoints: 1, excusedPoints: 2 } });
    // 5 (present) + 3 + 1 + 2 = 11 >= 10
    const result = await svc.computeBadgesForStudent('s1');
    expect(result.awarded).toBe(1);
  });

  it('defaults late/absent/excused to zero without config', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue(null);
    // 5 (present only) < 10
    const result = await svc.computeBadgesForStudent('s1');
    expect(result.awarded).toBe(0);
  });
});

describe('GamificationService - per-transaction XP management', () => {
  let svc: GamificationService;
  let audit: { log: jest.Mock };
  let prismaMock: any;
  let ledger: any[];
  let progressUpdates: any[];

  const STUDENT = { id: 'stu-1', schoolId: 'sch1', firstName: 'Robin', lastName: 'Amir' };
  const admin = { id: 'admin-1', schoolId: 'sch1', roles: ['admin'] };

  const row = (id: string, amount: number, day: number, over: any = {}) => ({
    id, studentId: 'stu-1', amount, balanceAfter: 0, type: 'attendance', description: null,
    referenceType: null, referenceId: null, createdBy: null, createdAt: new Date(2026, 0, day), ...over,
  });

  /** balanceAfter as a correct running balance, like addXp would have stored. */
  const seed = (rows: any[]) => {
    let run = 0;
    ledger = [...rows]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => ({ ...r, balanceAfter: (run += r.amount) }));
  };

  const mine = (where: any) => ledger.filter((r) => r.studentId === where.studentId && (!where.id || r.id === where.id));

  beforeEach(async () => {
    progressUpdates = [];
    prismaMock = {
      student: { findUnique: jest.fn(async () => STUDENT) },
      user: { findMany: jest.fn(async () => []) },
      assessmentSubmission: { findMany: jest.fn(async () => []) },
      studentProgress: { updateMany: jest.fn(async (a: any) => { progressUpdates.push(a); return { count: 1 }; }) },
      xPTransaction: {
        findFirst: jest.fn(async ({ where }: any) => (mine(where)[0] ? { ...mine(where)[0] } : null)),
        findMany: jest.fn(async ({ where, orderBy, skip = 0, take }: any) => {
          let rows = mine(where);
          const desc = Array.isArray(orderBy) ? orderBy[0].createdAt === 'desc' : false;
          rows = [...rows].sort((a, b) => (desc ? -1 : 1) * (a.createdAt.getTime() - b.createdAt.getTime()));
          return rows.slice(skip, take ? skip + take : undefined);
        }),
        aggregate: jest.fn(async ({ where }: any) => {
          const rows = mine(where);
          return { _sum: { amount: rows.reduce((n, r) => n + r.amount, 0) }, _count: rows.length };
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const r = ledger.find((x) => x.id === where.id);
          Object.assign(r, data);
          return r;
        }),
        delete: jest.fn(async ({ where }: any) => {
          ledger = ledger.filter((x) => x.id !== where.id);
          return {};
        }),
      },
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn((fn: any) => fn(prismaMock)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue('sch1') } },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = module.get(GamificationService);
  });

  describe('deleteXpTransaction', () => {
    it('removes one award, recalculates every later running balance, syncs progress and audits it', async () => {
      seed([row('a', 10, 1), row('b', 30, 2, { type: 'assessment', referenceType: 'submission', referenceId: 'sub-dup' }), row('c', 5, 3)]);

      const res = await svc.deleteXpTransaction('stu-1', 'b', 'Duplicate assessment award', admin);

      expect(res).toMatchObject({ deleted: true, removedAmount: 30, totalXp: 15, level: 1 });
      expect(ledger.map((r) => [r.id, r.balanceAfter])).toEqual([['a', 10], ['c', 15]]);
      expect(progressUpdates.at(-1)).toEqual({ where: { studentId: 'stu-1' }, data: { totalXp: 15 } });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'xp.transaction.delete', entityId: 'b', userId: 'admin-1', schoolId: 'sch1',
        oldValues: expect.objectContaining({ amount: 30, referenceId: 'sub-dup' }),
        metadata: { studentId: 'stu-1', reason: 'Duplicate assessment award' },
      }));
    });

    it('refuses to delete an award that belongs to another student', async () => {
      seed([row('a', 10, 1, { studentId: 'someone-else' })]);
      await expect(svc.deleteXpTransaction('stu-1', 'a', 'mistake', admin)).rejects.toThrow('XP transaction not found');
      expect(ledger).toHaveLength(1);
    });

    it('refuses a student from another school, but lets a super admin through', async () => {
      seed([row('a', 10, 1)]);
      const otherSchoolAdmin = { id: 'x', schoolId: 'other', roles: ['admin'] };

      await expect(svc.deleteXpTransaction('stu-1', 'a', 'mistake', otherSchoolAdmin)).rejects.toThrow('Student not found');
      expect(ledger).toHaveLength(1);

      await expect(
        svc.deleteXpTransaction('stu-1', 'a', 'mistake', { ...otherSchoolAdmin, roles: ['super_admin'] }),
      ).resolves.toMatchObject({ deleted: true });
    });

    it('will not take the student below zero because of a leftover negative adjustment', async () => {
      seed([row('a', 100, 1), row('adj', -80, 2, { type: 'xp_amendment' })]);

      await expect(svc.deleteXpTransaction('stu-1', 'a', 'duplicate', admin)).rejects.toThrow(/below zero/);
      expect(ledger).toHaveLength(2);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('does allow removing a negative adjustment, which moves the total up', async () => {
      seed([row('a', 100, 1), row('adj', -80, 2, { type: 'xp_amendment' })]);

      const res = await svc.deleteXpTransaction('stu-1', 'adj', 'adjustment was wrong', admin);

      expect(res.totalXp).toBe(100);
    });
  });

  describe('amendXpTransaction', () => {
    it('changes the amount of one award, keeps a note of the old value, and rebuilds balances', async () => {
      seed([row('a', 10, 1), row('b', 50, 2, { description: 'Assessment mark: 8/10' }), row('c', 5, 3)]);

      const res = await svc.amendXpTransaction('stu-1', 'b', 20, 'Marked twice, 20 is right', admin);

      expect(res).toMatchObject({ previousAmount: 50, newAmount: 20, totalXp: 35 });
      expect(ledger.find((r) => r.id === 'b').description).toBe('Assessment mark: 8/10 [amended 50 → 20: Marked twice, 20 is right]');
      expect(ledger.map((r) => r.balanceAfter)).toEqual([10, 30, 35]);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'xp.transaction.amend', entityId: 'b', oldValues: { amount: 50 }, newValues: { amount: 20 },
      }));
    });

    it('can also raise an award', async () => {
      seed([row('a', 10, 1)]);
      const res = await svc.amendXpTransaction('stu-1', 'a', 25, 'under-awarded', admin);
      expect(res.totalXp).toBe(25);
    });

    it.each([0, 1.5, 10001, -10001])('rejects an invalid amount (%s)', async (amount) => {
      seed([row('a', 10, 1)]);
      await expect(svc.amendXpTransaction('stu-1', 'a', amount, 'reason', admin)).rejects.toThrow(/whole number/);
    });

    it('will not push the total below zero', async () => {
      seed([row('a', 10, 1)]);
      await expect(svc.amendXpTransaction('stu-1', 'a', -20, 'too harsh', admin)).rejects.toThrow(/below zero/);
      expect(ledger[0].amount).toBe(10);
    });
  });

  describe('getXpLedger', () => {
    it('returns the full history newest first with totals, and flags XP from archived or missing attempts', async () => {
      seed([
        row('old', 10, 1),
        row('dup', 30, 2, { type: 'assessment', referenceType: 'submission', referenceId: 'sub-archived', createdBy: 'u1' }),
        row('gone', 20, 3, { type: 'assessment', referenceType: 'submission', referenceId: 'sub-deleted' }),
        row('live', 40, 4, { type: 'assessment', referenceType: 'submission', referenceId: 'sub-live' }),
      ]);
      prismaMock.assessmentSubmission.findMany.mockResolvedValue([
        { id: 'sub-archived', status: 'superseded' },
        { id: 'sub-live', status: 'completed' },
      ]);
      prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', firstName: 'Mina', lastName: 'S' }]);

      const res = await svc.getXpLedger('stu-1', 0, 50, admin);

      expect(res).toMatchObject({ totalXp: 100, level: 2, total: 4, firstName: 'Robin' });
      expect(res.items.map((i) => i.id)).toEqual(['live', 'gone', 'dup', 'old']);
      expect(Object.fromEntries(res.items.map((i) => [i.id, i.flag]))).toEqual({
        live: null, gone: 'missing_attempt', dup: 'archived_attempt', old: null,
      });
      expect(res.items.find((i) => i.id === 'dup')?.createdByName).toBe('Mina S');
    });

    it('pages the history and caps the page size', async () => {
      seed(Array.from({ length: 5 }, (_, i) => row(`t${i}`, 10, i + 1)));

      const res = await svc.getXpLedger('stu-1', 2, 99999, admin);

      expect(res.take).toBe(200);
      expect(res.items.map((i) => i.id)).toEqual(['t2', 't1', 't0']);
    });

    it('404s for a student of another school', async () => {
      seed([]);
      await expect(svc.getXpLedger('stu-1', 0, 50, { schoolId: 'other', roles: ['admin'] })).rejects.toThrow('Student not found');
    });
  });
});
