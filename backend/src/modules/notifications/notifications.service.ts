import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { PushService } from '../push/push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolResolver: SchoolResolver,
    private readonly push: PushService,
  ) {}

  async findUserNotifications(schoolIdentifier: string, userId: string, page = 1, limit = 20) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { schoolId, userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { schoolId, userId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUnreadCount(schoolIdentifier: string, userId: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.notification.count({ where: { schoolId, userId, isRead: false } });
  }

  async markAsRead(schoolIdentifier: string, notificationId: string, userId?: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        schoolId,
        ...(userId ? { userId } : {}),
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(schoolIdentifier: string, userId: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.notification.updateMany({
      where: { schoolId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async createNotification(data: {
    schoolId: string;
    userId: string;
    type: string;
    title: string;
    titleAr?: string;
    body: string;
    bodyAr?: string;
    channel?: string;
    linkPath?: string;
    referenceType?: string;
    referenceId?: string;
  }) {
    const channel = data.channel || 'in_app';
    const notification = await this.prisma.notification.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        titleAr: data.titleAr,
        body: data.body,
        bodyAr: data.bodyAr,
        channel,
        linkPath: data.linkPath,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    });

    // In-app notifications are also pushed to the user's devices. Not awaited: delivery is best effort.
    if (channel === 'in_app') this.pushToDevices(data.userId, data).catch(() => undefined);

    return notification;
  }

  private async pushToDevices(
    userId: string,
    n: { schoolId: string; title: string; body: string; linkPath?: string; type: string },
  ) {
    const unread = await this.prisma.notification
      .count({ where: { schoolId: n.schoolId, userId, isRead: false } })
      .catch(() => undefined);
    await this.push.sendToUser(userId, {
      title: n.title,
      body: n.body,
      url: n.linkPath,
      unread,
      tag: n.type,
    });
  }
}
