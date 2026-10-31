import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../../database/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  /** Where a tap on the notification should go (same-origin path). */
  url?: string;
  /** Unread total, so the service worker can set the app-icon badge. */
  unread?: number;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
}

/**
 * The server POSTs to whatever endpoint a client registers, so an arbitrary URL would let a logged-in
 * user aim the server at internal addresses. Only the push services browsers actually use are accepted.
 */
const PUSH_HOST_SUFFIXES = [
  '.googleapis.com', // Chrome / Android (FCM)
  '.push.services.mozilla.com', // Firefox
  '.notify.windows.com', // Edge / Windows
  '.push.apple.com', // Safari / iOS
];

const MAX_SUBSCRIPTIONS_PER_USER = 10;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Push is optional: without VAPID keys the feature is off, in-app notifications keep working and
   * nothing throws. Generate keys with `npx web-push generate-vapid-keys`.
   */
  onModuleInit() {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      this.logger.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set: web push is disabled');
      return;
    }
    const subject = process.env.VAPID_SUBJECT || process.env.APP_URL || 'mailto:admin@example.org';
    try {
      webpush.setVapidDetails(subject, pub, priv);
      this.publicKey = pub;
    } catch (e: any) {
      this.logger.error(`Invalid VAPID configuration, web push disabled: ${e?.message}`);
    }
  }

  get enabled(): boolean {
    return this.publicKey !== null;
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  async subscribe(
    user: { id: string; schoolId: string },
    dto: { endpoint: string; p256dh: string; auth: string },
    userAgent?: string,
  ) {
    if (!this.enabled) throw new BadRequestException('Push notifications are not enabled');
    if (!isAllowedPushEndpoint(dto.endpoint)) throw new BadRequestException('Unsupported push endpoint');

    const data = {
      schoolId: user.schoolId,
      p256dh: dto.p256dh,
      auth: dto.auth,
      userAgent: userAgent?.slice(0, 255),
    };
    await this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId: user.id, endpoint: dto.endpoint } },
      create: { userId: user.id, endpoint: dto.endpoint, ...data },
      update: data,
    });

    // Keep the newest few: people reinstall and switch phones, and stale rows only cost failed sends.
    const all = await this.prisma.pushSubscription.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (all.length > MAX_SUBSCRIPTIONS_PER_USER) {
      await this.prisma.pushSubscription.deleteMany({
        where: { id: { in: all.slice(MAX_SUBSCRIPTIONS_PER_USER).map((s) => s.id) } },
      });
    }
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { subscribed: false };
  }

  /** Best effort and never throws: a failed push must not fail whatever created the notification. */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    try {
      const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
      if (subs.length === 0) return;
      const body = JSON.stringify(payload);
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              body,
              { TTL: 60 * 60 * 24 },
            );
          } catch (e: any) {
            // 404/410: the browser dropped the subscription. Anything else is transient.
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              await this.prisma.pushSubscription.deleteMany({ where: { id: s.id } }).catch(() => undefined);
            } else {
              this.logger.warn(`Push to ${new URL(s.endpoint).hostname} failed: ${e?.statusCode ?? e?.message}`);
            }
          }
        }),
      );
    } catch (e: any) {
      this.logger.warn(`Push send failed: ${e?.message}`);
    }
  }
}
