import { HttpException, HttpStatus } from '@nestjs/common';
import { PasswordResetThrottleService } from './password-reset-throttle.service';

describe('PasswordResetThrottleService', () => {
  let service: PasswordResetThrottleService;

  beforeEach(() => {
    service = new PasswordResetThrottleService();
  });

  it('allows up to the email limit', () => {
    expect(() => {
      for (let i = 0; i < 3; i++) service.assertAllowed('a@b.com');
    }).not.toThrow();
  });

  it('blocks the 4th request for the same email', () => {
    for (let i = 0; i < 3; i++) service.assertAllowed('a@b.com');
    expect(() => service.assertAllowed('a@b.com')).toThrow(HttpException);
    expect(() => service.assertAllowed('a@b.com')).toThrow(
      expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS }),
    );
  });

  it('tracks emails independently', () => {
    for (let i = 0; i < 3; i++) service.assertAllowed('a@b.com');
    expect(() => service.assertAllowed('c@d.com')).not.toThrow();
  });

  it('is case-insensitive for email keys', () => {
    for (let i = 0; i < 3; i++) service.assertAllowed('A@B.com');
    expect(() => service.assertAllowed('a@b.com')).toThrow(HttpException);
  });

  it('applies the IP limit across different emails', () => {
    for (let i = 0; i < 10; i++) service.assertAllowed(`u${i}@b.com`, '1.2.3.4');
    expect(() => service.assertAllowed('another@b.com', '1.2.3.4')).toThrow(HttpException);
  });

  it('does not count requests from different IPs against each other', () => {
    for (let i = 0; i < 10; i++) service.assertAllowed(`u${i}@b.com`, `10.0.0.${i}`);
    expect(() => service.assertAllowed('a@b.com', '10.0.0.99')).not.toThrow();
  });

  it('expires entries after the window', () => {
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 3; i++) service.assertAllowed('a@b.com');
      jest.advanceTimersByTime(15 * 60_000 + 1);
      expect(() => service.assertAllowed('a@b.com')).not.toThrow();
    } finally {
      jest.useRealTimers();
    }
  });
});
