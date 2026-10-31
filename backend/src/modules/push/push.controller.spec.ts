import { NotFoundException } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';

describe('PushController', () => {
  const make = (publicKey: string | null) => {
    const service = {
      getPublicKey: jest.fn().mockReturnValue(publicKey),
      subscribe: jest.fn().mockResolvedValue({ subscribed: true }),
      unsubscribe: jest.fn().mockResolvedValue({ subscribed: false }),
    } as unknown as PushService;
    return { controller: new PushController(service), service };
  };

  it('returns the public key in the shape the browser client reads', () => {
    expect(make('PUB').controller.getPublicKey()).toEqual({ key: 'PUB' });
  });

  it('answers 404 when push is not configured, so clients can tell it is unavailable', () => {
    expect(() => make(null).controller.getPublicKey()).toThrow(NotFoundException);
  });

  it('passes the caller, the subscription and the user agent to the service', async () => {
    const { controller, service } = make('PUB');
    const user = { id: 'u1', schoolId: 's1' };
    const dto = { endpoint: 'https://fcm.googleapis.com/x', p256dh: 'k', auth: 'a' };
    await controller.subscribe(user, dto, 'UA');
    expect(service.subscribe).toHaveBeenCalledWith(user, dto, 'UA');
  });

  it('only ever unsubscribes the caller\'s own device', async () => {
    const { controller, service } = make('PUB');
    await controller.unsubscribe({ id: 'u1' }, { endpoint: 'https://fcm.googleapis.com/x' });
    expect(service.unsubscribe).toHaveBeenCalledWith('u1', 'https://fcm.googleapis.com/x');
  });
});
