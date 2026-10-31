import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';

// Fixed "now": 2026-11-01 07:xx in Cairo.
const NOW = new Date('2026-11-01T05:10:00Z');

describe('GamificationService.claimBirthdayGift', () => {
  let svc: GamificationService;
  let prisma: any;
  let notify: jest.Mock;

  const student = (dob: string, over: any = {}) => ({
    id: 's1', schoolId: 'school-1', dateOfBirth: new Date(`${dob}T00:00:00Z`), metadata: {},
    school: { timezone: 'Africa/Cairo' }, ...over,
  });
  const badge = { id: 'b-2026', name: 'Birthday Blessing 2026', nameAr: 'x', iconUrl: 'cake', xpReward: 50 };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    notify = jest.fn();
    prisma = {
      student: { findUnique: jest.fn() },
      badge: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
      studentBadge: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      xPTransaction: { create: jest.fn() },
      studentProgress: { updateMany: jest.fn() },
      $transaction: jest.fn(),
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ balance: 100 }]),
    };
    const module = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SchoolResolver, useValue: { resolve: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: StudentNotificationsService, useValue: { notify, notifyOrRefresh: jest.fn() } },
      ],
    }).compile();
    svc = module.get(GamificationService);
    prisma.student.findUnique.mockResolvedValue(student('2016-11-01'));
    prisma.badge.findFirst.mockResolvedValue(badge);
    prisma.badge.findUnique.mockResolvedValue(badge);
  });

  afterEach(() => jest.useRealTimers());

  it('awards this year\'s badge (which carries the 50 XP) on the birthday', async () => {
    jest.spyOn(svc, 'awardBadge').mockResolvedValue({} as any);
    const res = await svc.claimBirthdayGift('s1');
    expect(svc.awardBadge).toHaveBeenCalledWith('s1', 'b-2026');
    expect(res).toEqual({ claimed: true, xp: 50, badge: { name: 'Birthday Blessing 2026', nameAr: 'x', iconUrl: 'cake' } });
  });

  it('creates the yearly badge for the school the first time, with the gift XP and a grant-only rule', async () => {
    prisma.badge.findFirst.mockResolvedValue(null);
    prisma.badge.create.mockResolvedValue(badge);
    jest.spyOn(svc, 'awardBadge').mockResolvedValue({} as any);
    await svc.claimBirthdayGift('s1');
    expect(prisma.badge.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      schoolId: 'school-1', name: 'Birthday Blessing 2026', category: 'birthday', xpReward: 50,
      criteria: { rule: 'birthday', year: 2026 },
    }) });
  });

  it('is idempotent: a second claim pays nothing', async () => {
    prisma.studentBadge.findFirst.mockResolvedValue({ id: 'sb' });
    const award = jest.spyOn(svc, 'awardBadge');
    const res = await svc.claimBirthdayGift('s1');
    expect(res).toMatchObject({ claimed: false, xp: 0 });
    expect(award).not.toHaveBeenCalled();
  });

  it('treats a racing double tap as already claimed instead of failing', async () => {
    jest.spyOn(svc, 'awardBadge').mockRejectedValue(new BadRequestException('Badge already awarded to this student'));
    expect(await svc.claimBirthdayGift('s1')).toMatchObject({ claimed: false, xp: 0 });
    jest.spyOn(svc, 'awardBadge').mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    expect(await svc.claimBirthdayGift('s1')).toMatchObject({ claimed: false, xp: 0 });
  });

  it('still surfaces unexpected failures', async () => {
    jest.spyOn(svc, 'awardBadge').mockRejectedValue(new Error('db down'));
    await expect(svc.claimBirthdayGift('s1')).rejects.toThrow('db down');
  });

  it('works up to a week after the birthday, not before or after', async () => {
    jest.spyOn(svc, 'awardBadge').mockResolvedValue({} as any);
    jest.setSystemTime(new Date('2026-11-08T10:00:00Z'));
    await expect(svc.claimBirthdayGift('s1')).resolves.toMatchObject({ claimed: true });
    jest.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    await expect(svc.claimBirthdayGift('s1')).rejects.toThrow('no birthday gift');
    jest.setSystemTime(new Date('2026-10-31T10:00:00Z'));
    await expect(svc.claimBirthdayGift('s1')).rejects.toThrow('no birthday gift');
  });

  it('refuses an opted-out family, an implausible age, and an unknown student', async () => {
    prisma.student.findUnique.mockResolvedValue(student('2016-11-01', { metadata: { birthdayOptOut: true } }));
    await expect(svc.claimBirthdayGift('s1')).rejects.toThrow('turned off');
    prisma.student.findUnique.mockResolvedValue(student('2026-11-01'));
    await expect(svc.claimBirthdayGift('s1')).rejects.toThrow('no birthday gift');
    prisma.student.findUnique.mockResolvedValue(null);
    await expect(svc.claimBirthdayGift('s1')).rejects.toThrow(NotFoundException);
  });

  describe('a birthday badge is grant-only', () => {
    const owned = { badgeId: 'b-2026' };
    const birthdayBadge = { ...badge, xpReward: 50, criteria: { rule: 'birthday', year: 2026 } };

    it('is never revoked by a recheck, so its XP is not clawed back', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1', schoolId: 'school-1', groupId: null });
      prisma.studentBadge.findMany.mockResolvedValue([owned]);
      prisma.badge.findUnique.mockResolvedValue(birthdayBadge);
      prisma.badge.findMany = jest.fn().mockResolvedValue([]);
      await svc.computeBadgesForStudent('s1', undefined, true);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.studentBadge.deleteMany).not.toHaveBeenCalled();
    });

    it('is never auto-awarded to anyone by the criteria loop', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1', schoolId: 'school-1', groupId: null });
      prisma.badge.findMany = jest.fn().mockResolvedValue([birthdayBadge]);
      const res = await svc.computeBadgesForStudent('s1');
      expect(res).toEqual({ awarded: 0, total: 1 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
