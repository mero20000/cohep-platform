import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolResolver: SchoolResolver,
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
    data?: any;
    channels?: string[];
  }) {
    const channels = data.channels || ['in_app'];
    const notification = await this.prisma.notification.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        titleAr: data.titleAr,
        body: data.body,
        bodyAr: data.bodyAr,
        data: data.data || {},
        channels,
        status: 'delivered',
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    });

    return notification;
  }
}
