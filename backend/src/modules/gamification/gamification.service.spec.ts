import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

describe('GamificationService - getLeaderboard parent scoping', () => {
  let svc: GamificationService;
  let prisma: any;

  const prismaMock = {
    xPTransaction: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    student: { findUnique: jest.fn(), findMany: jest.fn() },
    studentBadge: { count: jest.fn() },
    studentParent: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };

  const row = (id: string, xp: number, rank: number, firstName = 'F', lastName = 'Last') => ({
    id, firstName, lastName, xp, level: Math.floor(xp / 100) + 1, streak: 0, rank, badgeCount: 0,
  });

  const seedLeaderboard = () => {
    prisma.xPTransaction.groupBy.mockResolvedValue([
      { studentId: 's1', _sum: { amount: 500 } },
      { studentId: 's2', _sum: { amount: 400 } },
      { studentId: 's3', _sum: { amount: 300 } },
      { studentId: 's4', _sum: { amount: 200 } },
    ]);
    prisma.student.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({ id: where.id, firstName: 'First' + where.id.slice(1), lastName: 'Sur' }));
    prisma.studentBadge.count.mockResolvedValue(0);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue('sch1') } },
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
    prisma.student.findMany.mockResolvedValue([]);

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
    prisma.student.findMany.mockResolvedValue([{ id: 's2' }, { id: 's4' }]);

    const res: any = await svc.getLeaderboard('sch1', 20, { id: 'par1', roles: ['parent'] });
    expect(res.children.map((c: any) => c.id)).toEqual(['s2', 's4']);
  });

  it('falls back to full list when no requestingUser', async () => {
    const res = await svc.getLeaderboard('sch1', 20);
    expect(Array.isArray(res)).toBe(true);
  });
});
