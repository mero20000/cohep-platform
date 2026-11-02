import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt = require('jsonwebtoken');
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';

/**
 * The guard and the real JwtStrategy together, with real token verification: what the public
 * analytics collector depends on to learn who is calling without ever rejecting anyone.
 */
describe('OptionalJwtAuthGuard with JwtStrategy', () => {
  const SECRET = 'test-secret';
  const validateUser = jest.fn();
  const guard = new OptionalJwtAuthGuard();

  beforeAll(() => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    // Constructing the strategy registers it with passport under the name 'jwt'.
    new JwtStrategy({ get: () => SECRET } as unknown as ConfigService, { validateUser } as any);
  });
  beforeEach(() => {
    validateUser.mockReset().mockResolvedValue({ id: 'user-1', schoolId: 'school-1', roles: ['servant'] });
  });

  const run = async (req: any) => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
    const allowed = await guard.canActivate(ctx);
    return { allowed, user: req.user };
  };
  const token = (claims: object) => jwt.sign({ sub: 'user-1', ...claims }, SECRET, { expiresIn: 600 });

  it('identifies a caller with a valid access token', async () => {
    const { allowed, user } = await run({ method: 'POST', headers: { authorization: `Bearer ${token({ typ: 'access' })}` } });
    expect(allowed).toBe(true);
    expect(user).toEqual(expect.objectContaining({ id: 'user-1', schoolId: 'school-1' }));
  });

  it.each([
    ['no credentials', { method: 'POST', headers: {} }],
    ['a garbage Bearer token', { method: 'POST', headers: { authorization: 'Bearer nonsense' } }],
    ['a token signed with another secret', { method: 'POST', headers: { authorization: `Bearer ${jwt.sign({ sub: 'u', typ: 'access' }, 'other')}` } }],
    ['a refresh token', { method: 'POST', headers: { authorization: `Bearer ${token({ typ: 'refresh' })}` } }],
    ['a cookie-only POST with no Origin', { method: 'POST', headers: { cookie: `token=${token({ typ: 'access' })}` } }],
  ])('lets %s through as anonymous', async (_label, req) => {
    const { allowed, user } = await run(req);
    expect(allowed).toBe(true);
    expect(user).toBeNull();
  });

  it('still identifies a cookie caller whose Origin is allowed', async () => {
    const { user } = await run({
      method: 'POST',
      headers: { cookie: `token=${token({ typ: 'access' })}`, origin: 'https://app.example.com' },
    });
    expect(user).toEqual(expect.objectContaining({ id: 'user-1' }));
  });
});
