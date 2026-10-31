import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { BirthdayNotifier } from './birthday-notifier.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { NotificationsService } from '../notifications/notifications.service';

// Fixed "now": 2026-11-01 07:xx in Cairo (UTC+2).
const NOW = new Date('2026-11-01T05:10:00Z');

describe('servant birthday flow', () => {
  const schoolId = 'school-1';
  const user = { id: 'servant-1' };
  let service: DashboardService;
  let prisma: any;

  const mk = (id: string, dob: string, metadata: any = {}) => ({
    id, firstName: `F${id}`, lastName: 'L', firstNameAr: null, lastNameAr: null, photoUrl: null,
    dateOfBirth: new Date(`${dob}T00:00:00Z`), metadata,
  });

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    prisma = {
      user: { findUnique: jest.fn() },
      school: { findUnique: jest.fn() },
      student: { findMany: jest.fn(), findUnique: jest.fn() },
      attendanceSession: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      lessonProgress: { count: jest.fn().mockResolvedValue(0) },
      studentBirthdayGreeting: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn(), deleteMany: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
      ],
    }).compile();
    service = module.get(DashboardService);
    prisma.school.findUnique.mockResolvedValue({ name: 'NiAngelos School', timezone: 'Africa/Cairo', church: { name: 'St Mark Church' } });
    // servant is assigned to group g1
    prisma.user.findUnique.mockImplementation(async (a: any) =>
      a.select?.firstName ? { firstName: 'Mariam', lastName: 'Samir' } : { metadata: { groupId: 'g1' } });
  });

  afterEach(() => jest.useRealTimers());

  function classOf(students: any[]) {
    prisma.student.findMany.mockImplementation(async (a: any) =>
      a.select?.dateOfBirth ? students : students.map((s) => ({ id: s.id })));
  }

  describe('getBirthdays', () => {
    it('returns the sign-off and only birthdays within a week either side, nearest first (upcoming wins a tie)', async () => {
      classOf([mk('a', '2016-11-03'), mk('b', '2016-11-01'), mk('c', '2016-10-30'), mk('far', '2016-12-25'), mk('old', '2016-10-20')]);
      const res = await service.getBirthdays(user, schoolId);
      expect(res.signoff).toEqual({ servantName: 'Mariam Samir', school: 'NiAngelos School', church: 'St Mark Church' });
      expect(res.birthdays.map((b: any) => [b.studentId, b.daysAway])).toEqual([['b', 0], ['a', 2], ['c', -2]]);
      expect(res.birthdays[0].turningAge).toBe(10);
    });

    it('uses the student number first, then the parent number, then none', async () => {
      classOf([
        mk('own', '2016-11-01', { studentPhone: '+201000000001', parentPhone: '+201000000002' }),
        mk('par', '2016-11-01', { parentPhone: '+201000000002' }),
        mk('legacy', '2016-11-01', { phone: '+201000000003' }),
        mk('none', '2016-11-01', {}),
      ]);
      const by = Object.fromEntries((await service.getBirthdays(user, schoolId)).birthdays.map((b: any) => [b.studentId, b]));
      expect(by.own).toMatchObject({ recipientPhone: '+201000000001', recipientKind: 'student' });
      expect(by.par).toMatchObject({ recipientPhone: '+201000000002', recipientKind: 'parent' });
      expect(by.legacy).toMatchObject({ recipientPhone: '+201000000003', recipientKind: 'parent' });
      expect(by.none).toMatchObject({ recipientPhone: null, recipientKind: null });
    });

    it('flags 3 straight absences, and reports greeted state for this birthday year only', async () => {
      classOf([mk('a', '2016-11-01'), mk('b', '2016-10-30')]);
      prisma.attendanceRecord.findMany.mockImplementation(async (a: any) =>
        a.where.studentId === 'a' ? [{ status: 'absent' }, { status: 'absent' }, { status: 'absent' }] : [{ status: 'present' }]);
      prisma.studentBirthdayGreeting.findMany.mockResolvedValue([
        { studentId: 'b', year: 2026, note: 'Called', greetedAt: new Date() },
        { studentId: 'a', year: 2025, note: 'last year', greetedAt: new Date() },
      ]);
      const by = Object.fromEntries((await service.getBirthdays(user, schoolId)).birthdays.map((b: any) => [b.studentId, b]));
      expect(by.a.missedThreeWeeks).toBe(true);
      expect(by.a.greeted).toBeNull();
      expect(by.b.missedThreeWeeks).toBe(false);
      expect(by.b.greeted).toMatchObject({ note: 'Called' });
    });

    it('uses the school timezone for today (UTC evening is already tomorrow in Cairo)', async () => {
      jest.setSystemTime(new Date('2026-10-31T23:30:00Z'));
      classOf([mk('a', '2016-11-01')]);
      const res = await service.getBirthdays(user, schoolId);
      expect(res.today).toBe('2026-11-01');
      expect(res.birthdays[0].daysAway).toBe(0);
    });

    it('returns an empty list when the servant has no class', async () => {
      classOf([]);
      expect((await service.getBirthdays(user, schoolId)).birthdays).toEqual([]);
    });
  });

  describe('setBirthdayGreeted', () => {
    it('rejects a student outside the class', async () => {
      classOf([mk('a', '2016-11-01')]);
      await expect(service.setBirthdayGreeted(user, schoolId, 'x', { done: true })).rejects.toThrow('not found');
    });

    it('rejects a student with no birthday this week', async () => {
      classOf([mk('a', '2016-12-25')]);
      prisma.student.findUnique.mockResolvedValue({ dateOfBirth: new Date('2016-12-25T00:00:00Z') });
      await expect(service.setBirthdayGreeted(user, schoolId, 'a', { done: true })).rejects.toThrow('no birthday this week');
    });

    it('records the greeting against the birthday year with a trimmed note', async () => {
      classOf([mk('a', '2016-11-01')]);
      prisma.student.findUnique.mockResolvedValue({ dateOfBirth: new Date('2016-11-01T00:00:00Z') });
      prisma.studentBirthdayGreeting.upsert.mockImplementation(async ({ create }: any) => ({ ...create, greetedAt: new Date() }));
      const res = await service.setBirthdayGreeted(user, schoolId, 'a', { done: true, note: '  sent on WhatsApp ' });
      expect(prisma.studentBirthdayGreeting.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { studentId_year: { studentId: 'a', year: 2026 } },
        create: expect.objectContaining({ servantId: 'servant-1', year: 2026, note: 'sent on WhatsApp' }),
      }));
      expect(res.greeted?.note).toBe('sent on WhatsApp');
    });

    it('undoes a greeting', async () => {
      classOf([mk('a', '2016-11-01')]);
      prisma.student.findUnique.mockResolvedValue({ dateOfBirth: new Date('2016-11-01T00:00:00Z') });
      expect(await service.setBirthdayGreeted(user, schoolId, 'a', { done: false })).toEqual({ greeted: null });
      expect(prisma.studentBirthdayGreeting.deleteMany).toHaveBeenCalledWith({ where: { studentId: 'a', year: 2026 } });
    });
  });
});

describe('BirthdayNotifier', () => {
  let notifier: BirthdayNotifier;
  let prisma: any;
  let notifications: { createNotification: jest.Mock };

  const student = (id: string, dob: string, over: any = {}) => ({
    id, firstName: `S${id}`, lastName: 'L', groupId: 'g1', levelId: 'l1', gender: 'male', dateOfBirth: new Date(`${dob}T00:00:00Z`), ...over,
  });

  beforeEach(async () => {
    prisma = {
      school: { findMany: jest.fn().mockResolvedValue([{ id: 'school-1', timezone: 'Africa/Cairo' }]) },
      student: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    notifications = { createNotification: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        BirthdayNotifier,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    notifier = module.get(BirthdayNotifier);
  });

  it('does nothing outside 07:00 school time', async () => {
    const res = await notifier.run(new Date('2026-11-01T09:00:00Z')); // 11:00 Cairo
    expect(res).toEqual({ sent: 0 });
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  it("notifies only servants whose class has a birthday today, once", async () => {
    prisma.student.findMany.mockResolvedValue([student('a', '2016-11-01'), student('b', '2016-05-05')]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'mine', metadata: { groupId: 'g1' } },
      { id: 'other-group', metadata: { groupId: 'g2' } },
      { id: 'no-class', metadata: {} },
    ]);
    const res = await notifier.run(NOW);
    expect(res).toEqual({ sent: 1 });
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'mine', type: 'birthday', referenceId: '2026-11-01', linkPath: '/dashboard/briefing',
      title: 'Birthday today: Sa 🎂', body: expect.stringContaining('Sa (10)'),
    }));
  });

  it('is idempotent: skips a servant already notified today', async () => {
    prisma.student.findMany.mockResolvedValue([student('a', '2016-11-01')]);
    prisma.user.findMany.mockResolvedValue([{ id: 'mine', metadata: { groupId: 'g1' } }]);
    prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
    expect(await notifier.run(NOW)).toEqual({ sent: 0 });
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('respects a servant who only teaches one gender', async () => {
    prisma.student.findMany.mockResolvedValue([student('a', '2016-11-01', { gender: 'male' })]);
    prisma.user.findMany.mockResolvedValue([{ id: 'girls-only', metadata: { groupId: 'g1', teachingGender: 'female' } }]);
    expect(await notifier.run(NOW)).toEqual({ sent: 0 });
  });

  it('summarises several birthdays in one notification', async () => {
    prisma.student.findMany.mockResolvedValue([student('a', '2016-11-01'), student('b', '2015-11-01')]);
    prisma.user.findMany.mockResolvedValue([{ id: 'mine', metadata: { groupId: 'g1' } }]);
    await notifier.run(NOW);
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({ title: '2 birthdays today 🎂' }));
  });
});
