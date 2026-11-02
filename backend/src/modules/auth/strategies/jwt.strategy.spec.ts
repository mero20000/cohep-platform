import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../auth.service';

const bearerGet = { method: 'GET', headers: { authorization: 'Bearer abc' } };

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let validateUserSpy: jest.Mock;

  beforeEach(async () => {
    validateUserSpy = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      roles: ['admin'],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        {
          provide: AuthService,
          useValue: { validateUser: validateUserSpy },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('validates a real user via AuthService', async () => {
    const user = await (strategy as any).validate(bearerGet, { sub: 'user-1', email: 'user@example.com', typ: 'access', iat: 1_752_000_000 });
    expect(validateUserSpy).toHaveBeenCalledWith('user-1', 1_752_000_000);
    expect(user.id).toBe('user-1');
  });

  it('returns synthetic demo user without DB for demo_viewer token', async () => {
    const user = await (strategy as any).validate(bearerGet, { sub: 'demo-guest', role: 'demo_viewer', demo: true, schoolId: 'demo-school-id' });
    expect(user.roles).toEqual(['demo_viewer']);
    expect(user.isDemo).toBe(true);
    expect(validateUserSpy).not.toHaveBeenCalled();
  });

  it('returns synthetic demo user with correct shape', async () => {
    const user = await (strategy as any).validate(bearerGet, { sub: 'demo-guest', role: 'demo_viewer', demo: true, schoolId: 'demo-school-id' });
    expect(user).toEqual(
      expect.objectContaining({
        id: 'demo-guest',
        email: 'guest@demo',
        schoolId: 'demo-school-id',
        roles: ['demo_viewer'],
        isDemo: true,
        isActive: true,
      }),
    );
  });

  it('falls through to DB when demo flag is false', async () => {
    await (strategy as any).validate(bearerGet, { sub: 'user-1', role: 'demo_viewer', demo: false, schoolId: 'demo-school-id', typ: 'access', iat: 5 });
    expect(validateUserSpy).toHaveBeenCalledWith('user-1', 5);
  });

  it('falls through to DB when role is not demo_viewer', async () => {
    await (strategy as any).validate(bearerGet, { sub: 'user-1', role: 'admin', demo: true, schoolId: 'demo-school-id', typ: 'access', iat: 5 });
    expect(validateUserSpy).toHaveBeenCalledWith('user-1', 5);
  });

  it.each([
    ['a refresh token', { sub: 'user-1', typ: 'refresh' }],
    ['a reset token', { sub: 'user-1', typ: 'reset', purpose: 'password-reset' }],
    ['a token with no type (issued before types existed)', { sub: 'user-1' }],
  ])('refuses %s as a Bearer token without touching the database', async (_label, payload) => {
    await expect((strategy as any).validate(bearerGet, payload)).rejects.toThrow('Invalid token');
    expect(validateUserSpy).not.toHaveBeenCalled();
  });

  describe('cookie CSRF origin check', () => {
    const ORIGINAL = { ...process.env };
    const access = { sub: 'user-1', typ: 'access', iat: 5 };
    const cookieReq = (method: string, origin?: string) => ({
      method,
      headers: { cookie: 'token=abc', ...(origin ? { origin } : {}) },
    });

    beforeEach(() => {
      process.env.FRONTEND_URL = 'https://app.example.com/';
      process.env.FRONTEND_URL_2 = '';
    });
    afterAll(() => {
      process.env = ORIGINAL;
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks a cookie-only %s with no Origin', async (method) => {
      await expect((strategy as any).validate(cookieReq(method), access)).rejects.toThrow('Cross-site request blocked');
      expect(validateUserSpy).not.toHaveBeenCalled();
    });

    it('blocks a cookie-only POST from a foreign Origin', async () => {
      await expect((strategy as any).validate(cookieReq('POST', 'https://evil.example'), access)).rejects.toThrow(
        'Cross-site request blocked',
      );
    });

    it('blocks a cookie-only POST with the null Origin', async () => {
      await expect((strategy as any).validate(cookieReq('POST', 'null'), access)).rejects.toThrow('Cross-site request blocked');
    });

    it('blocks a foreign Origin that only starts like an allowed one', async () => {
      await expect(
        (strategy as any).validate(cookieReq('POST', 'https://app.example.com.evil.example'), access),
      ).rejects.toThrow('Cross-site request blocked');
    });

    it('allows a cookie-only POST from the configured frontend (trailing slash in env ignored)', async () => {
      await expect((strategy as any).validate(cookieReq('POST', 'https://app.example.com'), access)).resolves.toBeDefined();
    });

    it('allows a cookie-only POST from the local dev frontend', async () => {
      await expect((strategy as any).validate(cookieReq('PATCH', 'http://localhost:3000'), access)).resolves.toBeDefined();
    });

    it.each(['GET', 'HEAD', 'OPTIONS'])('allows a cookie-only %s with no Origin', async (method) => {
      await expect((strategy as any).validate(cookieReq(method), access)).resolves.toBeDefined();
    });

    it('allows a Bearer POST whatever the Origin', async () => {
      const req = { method: 'POST', headers: { authorization: 'Bearer abc', origin: 'https://evil.example' } };
      await expect((strategy as any).validate(req, access)).resolves.toBeDefined();
    });

    it('does not let an empty Bearer header bypass the check', async () => {
      const req = { method: 'POST', headers: { authorization: 'Bearer ', cookie: 'token=abc' } };
      await expect((strategy as any).validate(req, access)).rejects.toThrow('Cross-site request blocked');
    });

    it('checks the origin before any database lookup, for demo tokens too', async () => {
      const demo = { sub: 'demo-guest', role: 'demo_viewer', demo: true, schoolId: 's1' };
      await expect((strategy as any).validate(cookieReq('POST', 'https://evil.example'), demo)).rejects.toThrow(
        'Cross-site request blocked',
      );
    });
  });
});
