import { Test, TestingModule } from '@nestjs/testing';
import { ServantsService } from './servants.service';
import { PrismaService } from '../../database/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';

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
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
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
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
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

describe('getGroupMates', () => {
  let service: ServantsService;
  let prisma: any;

  beforeEach(async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        ServantsService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: GamificationService, useValue: { addXp: jest.fn(), awardBadge: jest.fn() } },
      ],
    }).compile();
    service = module.get<ServantsService>(ServantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('returns [] when the caller has no metadata.groupId', async () => {
    prisma.user.findUnique.mockResolvedValue({ metadata: {}, schoolId: 'school-1' });
    const result = await service.getGroupMates('me');
    expect(result).toEqual([]);
  });

  it('returns only servants sharing the same groupId, excluding self', async () => {
    prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'g1' }, schoolId: 'school-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', firstName: 'A', lastName: 'B', firstNameAr: null, lastNameAr: null, avatarUrl: null, phone: '+1', metadata: { groupId: 'g1' } },
      { id: 'b', firstName: 'C', lastName: 'D', firstNameAr: null, lastNameAr: null, avatarUrl: null, phone: null, metadata: { groupId: 'g2' } },
    ]);
    const result = await service.getGroupMates('me');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('scopes the findMany to the caller school and never selects passwordHash', async () => {
    prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'g1' }, schoolId: 'school-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', firstName: 'A', lastName: 'B', firstNameAr: null, lastNameAr: null, avatarUrl: null, phone: '+1', metadata: { groupId: 'g1' } },
    ]);
    await service.getGroupMates('me');

    const findManyArgs = prisma.user.findMany.mock.calls[0][0];
    expect(findManyArgs.where.schoolId).toBe('school-1');
    expect(findManyArgs.where.id).toEqual({ not: 'me' });
    expect(findManyArgs.where.deletedAt).toBeNull();
    expect(findManyArgs.where.userRoles).toEqual({
      some: { role: { name: { in: ['servant', 'group_leader', 'level_leader'] } } },
    });
    expect(findManyArgs.select).toEqual({
      id: true, firstName: true, lastName: true,
      firstNameAr: true, lastNameAr: true, avatarUrl: true, phone: true,
      metadata: true,
    });
    expect(findManyArgs.select.passwordHash).toBeUndefined();

    const findUniqueArgs = prisma.user.findUnique.mock.calls[0][0];
    expect(findUniqueArgs.select.schoolId).toBe(true);
  });
});

describe('getServantProfile', () => {
  let service: ServantsService;
  let prisma: any;

  const mockUser = {
    id: 'servant-1',
    firstName: 'John',
    lastName: 'Doe',
    schoolId: 'school-1',
    deletedAt: null,
    avatarUrl: null,
    createdAt: new Date('2021-06-01T00:00:00.000Z'),
    userRoles: [{ role: { name: 'servant' } }],
    servantProfile: {
      yearsOfService: 5,
      totalStudents: 50,
      totalSessions: 100,
      totalHymns: 25,
      totalReviews: 10,
      currentLevelName: 'Level 1',
      currentGroupName: 'Group A',
      lastCalculatedAt: new Date('2026-01-01'),
    },
    metadata: { teachingSubjects: ['coptic_hymns'] },
  };

  const mockViewerSameSchool = {
    id: 'viewer-1',
    schoolId: 'school-1',
  };

  const mockViewerDifferentSchool = {
    id: 'viewer-other',
    schoolId: 'school-2',
  };

  beforeEach(async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        ServantsService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: GamificationService, useValue: { addXp: jest.fn(), awardBadge: jest.fn() } },
      ],
    }).compile();
    service = module.get<ServantsService>(ServantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should return profile for same-school viewer', async () => {
    prisma.user.findUnique.mockImplementation(async (args) => {
      if (args.where.id === 'servant-1') return mockUser;
      if (args.where.id === 'viewer-1') return mockViewerSameSchool;
      return null;
    });

    const result = await service.getServantProfile('servant-1', 'viewer-1');
    expect(result).toBeDefined();
    expect(result?.userId).toBe('servant-1');
    expect(result?.name).toBe('John Doe');
    expect(result?.roles).toEqual(['servant']);
    expect(result?.yearsOfService).toBe(5);
    expect(result?.totalStudents).toBe(50);
    expect(result?.assignedLevel).toBe('Level 1');
    expect(result?.assignedGroup).toBe('Group A');
    expect(result?.teachingSubjects).toEqual(['coptic_hymns']);
  });

  it('should return null for different-school viewer', async () => {
    prisma.user.findUnique.mockImplementation(async (args) => {
      if (args.where.id === 'servant-1') return mockUser;
      if (args.where.id === 'viewer-other') return mockViewerDifferentSchool;
      return null;
    });

    const result = await service.getServantProfile('servant-1', 'viewer-other');
    expect(result).toBeNull();
  });

  it('should return null if user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await service.getServantProfile('nonexistent', 'viewer-1');
    expect(result).toBeNull();
  });

  it('should return null if user is deleted', async () => {
    const deletedUser = { ...mockUser, deletedAt: new Date() };
    prisma.user.findUnique.mockImplementation(async (args) => {
      if (args.where.id === 'servant-1') return deletedUser;
      if (args.where.id === 'viewer-1') return mockViewerSameSchool;
      return null;
    });
    const result = await service.getServantProfile('servant-1', 'viewer-1');
    expect(result).toBeNull();
  });

  it('returns metadata.dateJoined when set', async () => {
    const userWithDateJoined = {
      ...mockUser,
      metadata: { dateJoined: '2020-01-15', teachingSubjects: [] },
    };
    prisma.user.findUnique.mockImplementation(async (args) => {
      if (args.where.id === 'servant-1') return userWithDateJoined;
      if (args.where.id === 'viewer-1') return mockViewerSameSchool;
      return null;
    });

    const result = await service.getServantProfile('servant-1', 'viewer-1');
    expect(result?.dateJoined).toBe('2020-01-15');
  });

  it('falls back to user.createdAt when metadata.dateJoined is absent', async () => {
    prisma.user.findUnique.mockImplementation(async (args) => {
      if (args.where.id === 'servant-1') return mockUser;
      if (args.where.id === 'viewer-1') return mockViewerSameSchool;
      return null;
    });

    const result = await service.getServantProfile('servant-1', 'viewer-1');
    expect(result?.dateJoined).toBe('2021-06-01T00:00:00.000Z');
  });
});

describe('getServantTimeline', () => {
  let service: ServantsService;
  let prisma: any;

  const mockMilestones = [
    { type: 'years_of_service', threshold: 1, label: '1 year of service', reachedAt: new Date('2022-01-01') },
    { type: 'students_taught', threshold: 10, label: '10th student taught', reachedAt: new Date('2023-06-15') },
  ];

  beforeEach(async () => {
    const prismaMock = {
      servantMilestone: {
        findMany: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        ServantsService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: GamificationService, useValue: { addXp: jest.fn(), awardBadge: jest.fn() } },
      ],
    }).compile();
    service = module.get<ServantsService>(ServantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should return timeline for owner', async () => {
    prisma.servantMilestone.findMany.mockResolvedValue(mockMilestones);
    const result = await service.getServantTimeline('servant-1', 'servant-1');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('years_of_service');
    expect(result[1].type).toBe('students_taught');
    expect(prisma.servantMilestone.findMany).toHaveBeenCalledWith({
      where: { userId: 'servant-1' },
      orderBy: { reachedAt: 'asc' },
      select: { type: true, threshold: true, label: true, reachedAt: true },
    });
  });

  it('should return empty array for non-owner', async () => {
    const result = await service.getServantTimeline('servant-1', 'other-user');
    expect(result).toEqual([]);
    expect(prisma.servantMilestone.findMany).not.toHaveBeenCalled();
  });

  it('should return empty array if no milestones', async () => {
    prisma.servantMilestone.findMany.mockResolvedValue([]);
    const result = await service.getServantTimeline('servant-1', 'servant-1');
    expect(result).toEqual([]);
  });
});

describe('checkAndLogMilestones', () => {
  let service: ServantsService;
  let prisma: any;

  beforeEach(async () => {
    const prismaMock = {
      servantMilestone: {
        upsert: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        ServantsService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: GamificationService, useValue: { addXp: jest.fn(), awardBadge: jest.fn() } },
      ],
    }).compile();
    service = module.get<ServantsService>(ServantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should create milestones when thresholds are crossed', async () => {
    const stats = {
      yearsOfService: 5,
      totalStudents: 50,
      totalSessions: 100,
      totalHymns: 25,
    };
    // We need to call the private method via any
    await (service as any).checkAndLogMilestones('profile-1', 'servant-1', stats);
    // Expect upsert to be called for each threshold that is <= stats value
    // years_of_service thresholds: [1,3,5,10,15,20] -> 1,3,5
    // students_taught: [10,50,100,500] -> 10,50
    // sessions_taught: [25,50,100,250,500] -> 25,50,100
    // hymns_covered: [10,25,50,100] -> 10,25
    const expectedCalls = 10;
    expect(prisma.servantMilestone.upsert).toHaveBeenCalledTimes(expectedCalls);
    // Verify first few calls
    expect(prisma.servantMilestone.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_type_threshold: { userId: 'servant-1', type: 'years_of_service', threshold: 1 } },
        create: expect.objectContaining({ label: '1 year of service' }),
      }),
    );
  });

  it('should not create milestones when thresholds not crossed', async () => {
    const stats = {
      yearsOfService: 0,
      totalStudents: 5,
      totalSessions: 10,
      totalHymns: 5,
    };
    await (service as any).checkAndLogMilestones('profile-1', 'servant-1', stats);
    expect(prisma.servantMilestone.upsert).not.toHaveBeenCalled();
  });

  it('should create milestones at exact thresholds', async () => {
    const stats = {
      yearsOfService: 1,
      totalStudents: 10,
      totalSessions: 25,
      totalHymns: 10,
    };
    await (service as any).checkAndLogMilestones('profile-1', 'servant-1', stats);
    // Each type has exactly one threshold met
    expect(prisma.servantMilestone.upsert).toHaveBeenCalledTimes(4);
    // Verify each type
    const calls = prisma.servantMilestone.upsert.mock.calls;
    const types = calls.map(call => call[0].where.userId_type_threshold.type);
    expect(types).toEqual(
      expect.arrayContaining(['years_of_service', 'students_taught', 'sessions_taught', 'hymns_covered']),
    );
  });
});

describe('getSchoolServantSummary', () => {
  let service: ServantsService;
  let prisma: any;

  const prismaMock = { user: { findMany: jest.fn() } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServantsService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: GamificationService, useValue: { addXp: jest.fn(), awardBadge: jest.fn() } },
      ],
    }).compile();
    service = module.get<ServantsService>(ServantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('returns metadata.dateJoined when set', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u2',
        firstName: 'A',
        lastName: 'B',
        avatarUrl: null,
        createdAt: new Date('2021-06-01T00:00:00.000Z'),
        metadata: { dateJoined: '2020-01-15' },
        servantProfile: null,
        userRoles: [{ role: { name: 'servant' } }],
      },
    ] as any);

    const result = await service.getSchoolServantSummary('school-1');
    expect(result[0].dateJoined).toBe('2020-01-15');
  });

  it('falls back to user.createdAt when metadata.dateJoined is absent', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u2',
        firstName: 'A',
        lastName: 'B',
        avatarUrl: null,
        createdAt: new Date('2021-06-01T00:00:00.000Z'),
        metadata: {},
        servantProfile: null,
        userRoles: [{ role: { name: 'servant' } }],
      },
    ] as any);

    const result = await service.getSchoolServantSummary('school-1');
    expect(result[0].dateJoined).toBe(new Date('2021-06-01T00:00:00.000Z').toISOString());
  });
});

describe('ServantsService.rejectLiturgy', () => {
  let service: ServantsService;
  let prisma: any;

  const prismaMock = {
    familyLiturgy: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServantsService,
        { provide: StudentNotificationsService, useValue: { notify: jest.fn(), notifyOrRefresh: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: GamificationService, useValue: { addXp: jest.fn(), awardBadge: jest.fn() } },
      ],
    }).compile();
    service = module.get<ServantsService>(ServantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    prisma.familyLiturgy.findUnique.mockResolvedValue({
      id: 'fl1', studentId: 'stu-1', status: 'pending', student: { schoolId: 'school-1' },
    });
    prisma.user.findUnique.mockResolvedValue({ schoolId: 'school-1' });
    prisma.familyLiturgy.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'fl1', ...data }),
    );
  });

  // The whole point of this change: the claim must survive a rejection.
  it('never deletes the claim', async () => {
    await service.rejectLiturgy('fl1', 'staff-1', 'Wrong date');
    expect(prisma.familyLiturgy.delete).not.toHaveBeenCalled();
  });

  it('marks the claim rejected and records who, when and why', async () => {
    const res: any = await service.rejectLiturgy('fl1', 'staff-1', 'Not at this liturgy');

    const data = prisma.familyLiturgy.update.mock.calls[0][0].data;
    expect(data.status).toBe('rejected');
    expect(data.rejectedBy).toBe('staff-1');
    expect(data.rejectedAt).toBeInstanceOf(Date);
    expect(data.rejectionReason).toBe('Not at this liturgy');
    expect(res.status).toBe('rejected');
  });

  it('clears any earlier verification so the two cannot both stand', async () => {
    await service.rejectLiturgy('fl1', 'staff-1', 'Filed twice');
    const data = prisma.familyLiturgy.update.mock.calls[0][0].data;
    expect(data.verifiedBy).toBeNull();
    expect(data.verifiedAt).toBeNull();
  });

  it('stores a whitespace-only reason as null rather than as blank text', async () => {
    await service.rejectLiturgy('fl1', 'staff-1', '   ');
    expect(prisma.familyLiturgy.update.mock.calls[0][0].data.rejectionReason).toBeNull();
  });

  it('refuses a claim from another school and changes nothing', async () => {
    prisma.user.findUnique.mockResolvedValue({ schoolId: 'other-school' });
    await expect(service.rejectLiturgy('fl1', 'staff-1', 'nope')).rejects.toMatchObject({ status: 403 });
    expect(prisma.familyLiturgy.update).not.toHaveBeenCalled();
    expect(prisma.familyLiturgy.delete).not.toHaveBeenCalled();
  });

  it('404s on an unknown claim', async () => {
    prisma.familyLiturgy.findUnique.mockResolvedValue(null);
    await expect(service.rejectLiturgy('nope', 'staff-1', 'x')).rejects.toMatchObject({ status: 404 });
  });
});
