import { Test, TestingModule } from '@nestjs/testing';
import { StudentNotificationsService } from './student-notifications.service';
import { PrismaService } from '../../database/prisma.service';

describe('StudentNotificationsService', () => {
  let svc: StudentNotificationsService;
  let prisma: any;

  const prismaMock = {
    studentNotification: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentNotificationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    svc = module.get(StudentNotificationsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    prisma.studentNotification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'n1', ...data }),
    );
  });

  const base = { studentId: 'stu-1', type: 'badge_awarded' as const, title: 'T' };

  describe('link safety', () => {
    // These are rendered as navigation targets in the portal, so an absolute URL here
    // would be a writer choosing where a student's browser goes.
    it.each([
      ['an http url', 'https://evil.example.com'],
      ['a protocol-relative url', '//evil.example.com'],
      ['a javascript url', 'javascript:alert(1)'],
      ['a data url', 'data:text/html,<script>'],
      ['a backslash trick', '\\\\evil.example.com'],
    ])('strips %s', async (_label, linkPath) => {
      await svc.notify({ ...base, linkPath });
      expect(prisma.studentNotification.create.mock.calls[0][0].data.linkPath).toBeNull();
    });

    it('keeps a portal-relative link', async () => {
      await svc.notify({ ...base, linkPath: '?tab=hymns' });
      expect(prisma.studentNotification.create.mock.calls[0][0].data.linkPath).toBe('?tab=hymns');
    });

    it('treats a blank link as absent', async () => {
      await svc.notify({ ...base, linkPath: '   ' });
      expect(prisma.studentNotification.create.mock.calls[0][0].data.linkPath).toBeNull();
    });
  });

  describe('emitting never breaks the caller', () => {
    // A notification must never be the reason a grade or a review fails to save.
    it('swallows a duplicate (P2002) and returns null', async () => {
      prisma.studentNotification.create.mockRejectedValue({ code: 'P2002' });
      await expect(svc.notify(base)).resolves.toBeNull();
    });

    it('swallows an unexpected database error and returns null', async () => {
      prisma.studentNotification.create.mockRejectedValue(new Error('connection lost'));
      await expect(svc.notify(base)).resolves.toBeNull();
    });

    it('swallows errors from notifyOrRefresh too', async () => {
      prisma.studentNotification.upsert.mockRejectedValue(new Error('boom'));
      await expect(svc.notifyOrRefresh({ ...base, referenceId: 'r1' })).resolves.toBeNull();
    });
  });

  it('truncates an overlong body rather than failing the insert', async () => {
    await svc.notify({ ...base, body: 'x'.repeat(900) });
    expect(prisma.studentNotification.create.mock.calls[0][0].data.body).toHaveLength(500);
  });

  it('falls back to a plain create when there is no referenceId to key on', async () => {
    await svc.notifyOrRefresh({ ...base, referenceId: null });
    expect(prisma.studentNotification.create).toHaveBeenCalled();
    expect(prisma.studentNotification.upsert).not.toHaveBeenCalled();
  });

  it('marks a refreshed notification unread again so a correction is seen', async () => {
    prisma.studentNotification.upsert.mockResolvedValue({ id: 'n1' });
    await svc.notifyOrRefresh({ ...base, referenceId: 'r1', title: 'Re-graded' });
    expect(prisma.studentNotification.upsert.mock.calls[0][0].update.readAt).toBeNull();
  });

  describe('reads are scoped to the student', () => {
    it('cannot mark another student\'s notification read', async () => {
      prisma.studentNotification.updateMany.mockResolvedValue({ count: 0 });
      const res = await svc.markRead('stu-1', 'n-belonging-to-someone-else');
      const where = prisma.studentNotification.updateMany.mock.calls[0][0].where;
      expect(where.studentId).toBe('stu-1');
      expect(res.updated).toBe(0);
    });

    it('counts only unread for this student', async () => {
      prisma.studentNotification.count.mockResolvedValue(3);
      const res = await svc.unreadCount('stu-1');
      expect(prisma.studentNotification.count.mock.calls[0][0].where).toEqual({
        studentId: 'stu-1',
        readAt: null,
      });
      expect(res.unread).toBe(3);
    });
  });

  describe('list', () => {
    beforeEach(() => prisma.studentNotification.findMany.mockResolvedValue([]));

    it('clamps an absurd limit', async () => {
      await svc.list('stu-1', { limit: 5000 });
      expect(prisma.studentNotification.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('clamps a nonsensical limit upward to at least one', async () => {
      await svc.list('stu-1', { limit: -3 });
      expect(prisma.studentNotification.findMany.mock.calls[0][0].take).toBe(1);
    });

    it('filters to unread when asked', async () => {
      await svc.list('stu-1', { unreadOnly: true });
      expect(prisma.studentNotification.findMany.mock.calls[0][0].where.readAt).toBeNull();
    });

    it('reports read state as a boolean rather than leaking the timestamp', async () => {
      prisma.studentNotification.findMany.mockResolvedValue([
        { id: 'n1', type: 'badge_awarded', title: 'T', titleAr: null, body: null, bodyAr: null, linkPath: null, readAt: new Date(), createdAt: new Date() },
        { id: 'n2', type: 'badge_awarded', title: 'T', titleAr: null, body: null, bodyAr: null, linkPath: null, readAt: null, createdAt: new Date() },
      ]);
      const res = await svc.list('stu-1');
      expect(res[0].read).toBe(true);
      expect(res[1].read).toBe(false);
    });
  });
});
