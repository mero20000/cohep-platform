import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  const schoolId = 'school-1';
  const userId = 'user-1';

  const prismaMock = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('findUserNotifications', () => {
    it('returns paginated data with correct skip/take for page 1', async () => {
      const notifications = [
        { id: 'n-1', schoolId, userId, title: 'First', isRead: false, createdAt: new Date() },
        { id: 'n-2', schoolId, userId, title: 'Second', isRead: true, createdAt: new Date() },
      ];
      prisma.notification.findMany.mockResolvedValue(notifications);
      prisma.notification.count.mockResolvedValue(2);

      const result = await service.findUserNotifications(schoolId, userId);

      expect(result.data).toEqual(notifications);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { schoolId, userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { schoolId, userId },
      });
    });

    it('computes skip correctly for subsequent pages', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(50);

      const result = await service.findUserNotifications(schoolId, userId, 3, 10);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('calculates totalPages correctly', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(45);

      const result = await service.findUserNotifications(schoolId, userId, 1, 20);

      expect(result.totalPages).toBe(3);
    });

    it('returns totalPages of 1 when total equals limit', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(20);

      const result = await service.findUserNotifications(schoolId, userId, 1, 20);

      expect(result.totalPages).toBe(1);
    });

    it('returns totalPages of 0 when there are no notifications', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.findUserNotifications(schoolId, userId, 1, 20);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('returns the count of unread notifications', async () => {
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(schoolId, userId);

      expect(result).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { schoolId, userId, isRead: false },
      });
    });

    it('returns zero when all notifications are read', async () => {
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(schoolId, userId);

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('updates the notification with isRead true and a readAt timestamp', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsRead(schoolId, 'notif-1');

      const call = prisma.notification.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'notif-1', schoolId });
      expect(call.data.isRead).toBe(true);
      expect(call.data.readAt).toBeInstanceOf(Date);
    });

    it('scopes the update by userId when provided', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsRead(schoolId, 'notif-1', userId);

      const call = prisma.notification.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'notif-1', schoolId, userId });
    });

    it('omits userId from the where clause when not provided', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsRead(schoolId, 'notif-1');

      const where = prisma.notification.updateMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('userId');
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read for the user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead(schoolId, userId);

      const call = prisma.notification.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ schoolId, userId, isRead: false });
      expect(call.data.isRead).toBe(true);
      expect(call.data.readAt).toBeInstanceOf(Date);
      expect(result.count).toBe(3);
    });

    it('returns count 0 when there are no unread notifications', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead(schoolId, userId);

      expect(result.count).toBe(0);
    });
  });

  describe('createNotification', () => {
    it('creates a notification with all provided fields', async () => {
      const input = {
        schoolId,
        userId,
        type: 'announcement',
        title: 'New Update',
        titleAr: 'تحديث جديد',
        body: 'Check it out',
        bodyAr: 'تحقق منه',
        channel: 'push',
      };
      prisma.notification.create.mockResolvedValue({ id: 'n-1', ...input });

      const result = await service.createNotification(input);

      const data = prisma.notification.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        schoolId,
        userId,
        type: 'announcement',
        title: 'New Update',
        titleAr: 'تحديث جديد',
        body: 'Check it out',
        bodyAr: 'تحقق منه',
        channel: 'push',
      });
      expect(data.sentAt).toBeInstanceOf(Date);
      expect(data.deliveredAt).toBeInstanceOf(Date);
      expect(result.id).toBe('n-1');
    });

    it('defaults channel to in_app when not provided', async () => {
      const input = {
        schoolId,
        userId,
        type: 'reminder',
        title: 'Reminder',
        body: 'Do not forget',
      };
      prisma.notification.create.mockResolvedValue({ id: 'n-2', ...input, channel: 'in_app' });

      await service.createNotification(input);

      const data = prisma.notification.create.mock.calls[0][0].data;
      expect(data.channel).toBe('in_app');
    });

    it('returns the created notification', async () => {
      const created = { id: 'n-3', schoolId, userId, type: 'alert', title: 'Alert', body: 'Urgent' };
      prisma.notification.create.mockResolvedValue(created);

      const result = await service.createNotification({
        schoolId,
        userId,
        type: 'alert',
        title: 'Alert',
        body: 'Urgent',
      });

      expect(result).toEqual(created);
    });
  });
});
