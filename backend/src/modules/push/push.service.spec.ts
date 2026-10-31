import { BadRequestException } from '@nestjs/common';
import * as webpush from 'web-push';
import { PushService, isAllowedPushEndpoint } from './push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const FCM = 'https://fcm.googleapis.com/fcm/send/abc';

describe('isAllowedPushEndpoint', () => {
  it.each([
    FCM,
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/abc',
  ])('accepts real push services: %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc', // not https
    'https://localhost/x',
    'https://169.254.169.254/latest/meta-data', // cloud metadata
    'https://internal.example.com/hook',
    'https://evilgoogleapis.com/x', // suffix must start at a dot
    'https://fcm.googleapis.com:8443/x', // unexpected port
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});

describe('PushService', () => {
  const OLD_ENV = process.env;
  let prisma: any;
  let service: PushService;

  const makeService = (withKeys: boolean) => {
    process.env = { ...OLD_ENV };
    if (withKeys) {
      process.env.VAPID_PUBLIC_KEY = 'pub';
      process.env.VAPID_PRIVATE_KEY = 'priv';
    } else {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
    }
    const s = new PushService(prisma);
    s.onModuleInit();
    return s;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      pushSubscription: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
  });
  afterAll(() => { process.env = OLD_ENV; });

  describe('without VAPID keys', () => {
    beforeEach(() => { service = makeService(false); });

    it('is disabled and exposes no key', () => {
      expect(service.enabled).toBe(false);
      expect(service.getPublicKey()).toBeNull();
    });

    it('refuses subscriptions', async () => {
      await expect(service.subscribe({ id: 'u1', schoolId: 's1' }, { endpoint: FCM, p256dh: 'k', auth: 'a' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('send is a silent no-op', async () => {
      await service.sendToUser('u1', { title: 't', body: 'b' });
      expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    });
  });

  describe('with VAPID keys', () => {
    beforeEach(() => { service = makeService(true); });

    it('configures web-push and exposes the public key', () => {
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(expect.any(String), 'pub', 'priv');
      expect(service.getPublicKey()).toBe('pub');
    });

    it('upserts a subscription for the caller and school', async () => {
      await service.subscribe({ id: 'u1', schoolId: 's1' }, { endpoint: FCM, p256dh: 'k', auth: 'a' }, 'UA');
      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId_endpoint: { userId: 'u1', endpoint: FCM } },
        create: expect.objectContaining({ userId: 'u1', schoolId: 's1', endpoint: FCM, p256dh: 'k', auth: 'a' }),
      }));
    });

    it('rejects an endpoint that is not a known push service', async () => {
      await expect(service.subscribe({ id: 'u1', schoolId: 's1' }, { endpoint: 'https://169.254.169.254/x', p256dh: 'k', auth: 'a' }))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it('keeps only the 10 newest subscriptions per user', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: `s${i}` })));
      await service.subscribe({ id: 'u1', schoolId: 's1' }, { endpoint: FCM, p256dh: 'k', auth: 'a' });
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s10', 's11'] } } });
    });

    it('unsubscribes only the caller\'s own endpoint', async () => {
      await service.unsubscribe('u1', FCM);
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', endpoint: FCM } });
    });

    it('sends the payload to every device of the user', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'a', endpoint: FCM, p256dh: 'k1', auth: 'a1' },
        { id: 'b', endpoint: 'https://web.push.apple.com/x', p256dh: 'k2', auth: 'a2' },
      ]);
      await service.sendToUser('u1', { title: 'Hello', body: 'World', url: '/dashboard', unread: 3 });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
      const [sub, body] = (webpush.sendNotification as jest.Mock).mock.calls[0];
      expect(sub).toEqual({ endpoint: FCM, keys: { p256dh: 'k1', auth: 'a1' } });
      expect(JSON.parse(body)).toEqual({ title: 'Hello', body: 'World', url: '/dashboard', unread: 3 });
    });

    it('drops a subscription the browser reports as gone (410) but keeps others on transient errors', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'gone', endpoint: FCM, p256dh: 'k', auth: 'a' },
        { id: 'flaky', endpoint: 'https://web.push.apple.com/x', p256dh: 'k', auth: 'a' },
      ]);
      (webpush.sendNotification as jest.Mock)
        .mockRejectedValueOnce({ statusCode: 410 })
        .mockRejectedValueOnce({ statusCode: 503 });
      await service.sendToUser('u1', { title: 't', body: 'b' });
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: 'gone' } });
    });

    it('never throws, even if the database does', async () => {
      prisma.pushSubscription.findMany.mockRejectedValue(new Error('db down'));
      await expect(service.sendToUser('u1', { title: 't', body: 'b' })).resolves.toBeUndefined();
    });
  });
});
