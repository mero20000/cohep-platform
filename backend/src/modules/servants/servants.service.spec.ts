import { Test, TestingModule } from '@nestjs/testing';
import { ServantsService } from './servants.service';
import { PrismaService } from '../../database/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

describe('ServantsService.listServants', () => {
  let service: ServantsService;
  let prisma: any;

  const S = (over = {}) => ({
    id: 'u1', firstName: 'John', lastName: 'Doe', firstNameAr: 'جون', lastNameAr: 'دو',
    email: 'j@x.com', phone: '+20123456789', avatarUrl: null, isActive: true,
    lastLoginAt: null, schoolId: 'school-1', deletedAt: null,
    userRoles: [{ role: { id: 'r1', name: 'servant', displayName: 'Servant' } }],
    metadata: null,
    ...over,
  });

  const prismaMock = { user: { findMany: jest.fn() } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServantsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GamificationService, useValue: { addXp: jest.fn(), awardBadge: jest.fn() } },
      ],
    }).compile();
    service = module.get<ServantsService>(ServantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  const staff = { id: 'staff-1', schoolId: 'school-1', roles: ['admin'] };
  const superAdmin = { id: 'sa-1', schoolId: 'school-1', roles: ['super_admin'] };

  it('returns only servant-role users, excluding deleted', async () => {
    prisma.user.findMany.mockResolvedValue([
      S(),
      S({ id: 'u2', userRoles: [{ role: { id: 'r2', name: 'group_leader', displayName: 'Group Leader' } }] }),
      S({ id: 'u3', userRoles: [{ role: { id: 'r3', name: 'servant', displayName: 'Servant' } }], deletedAt: new Date() }),
    ]);

    const result = await service.listServants(staff, {});

    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(['u1', 'u2']);
    expect(result[0].userRoles[0].role.name).toBe('servant');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: 'school-1' }) }),
    );
  });

  it('super_admin is not school-scoped', async () => {
    prisma.user.findMany.mockResolvedValue([S()]);
    await service.listServants(superAdmin, {});
    const arg = prisma.user.findMany.mock.calls[0][0];
    expect(arg.where.schoolId).toBeUndefined();
  });

  it('filters by search across name and email', async () => {
    prisma.user.findMany.mockResolvedValue([S()]);
    await service.listServants(staff, { search: 'joh' });
    const arg = prisma.user.findMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual(expect.arrayContaining([
      { email: { contains: 'joh', mode: 'insensitive' } },
    ]));
  });

  it('filters by role, levelId, groupId, teachingSubject', async () => {
    prisma.user.findMany.mockResolvedValue([S()]);
    const rows = [
      S({ id: 'a', userRoles: [{ role: { name: 'servant' } }] }),
      S({ id: 'b', userRoles: [{ role: { name: 'group_leader' } }], metadata: { levelId: 'L1', groupId: 'G1', teachingSubjects: ['coptic_hymns'] } }),
      S({ id: 'c', userRoles: [{ role: { name: 'level_leader' } }] }),
    ];
    prisma.user.findMany.mockResolvedValue(rows);

    const out = await service.listServants(staff, { role: 'group_leader', levelId: 'L1', groupId: 'G1', teachingSubject: 'coptic_hymns' });

    expect(out.map(r => r.id)).toEqual(['b']);
  });
});
