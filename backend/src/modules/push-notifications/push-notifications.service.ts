import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private webpush: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.webpush = await import('web-push');

    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@cohep.app';

    if (publicKey && privateKey) {
      this.webpush.setVapidDetails(subject, publicKey, privateKey);
    }
  }

  async subscribe(userId: string, subscription: { endpoint: string; p256dh: string; auth: string }, userAgent?: string) {
    return this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint: subscription.endpoint } },
      create: { userId, ...subscription, userAgent },
      update: { p256dh: subscription.p256dh, auth: subscription.auth, userAgent, updatedAt: new Date() },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async sendToUser(userId: string, title: string, body: string, url?: string) {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;

    const payload = JSON.stringify({ title, body, url });

    for (const sub of subs) {
      try {
        await this.webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
  }
}
