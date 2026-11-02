import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

/**
 * These use a real JwtService and an in-memory refresh-token table, so they prove what actually
 * happens to real tokens: which type is accepted where, what rotation does, what a stolen token can do.
 */
describe('AuthService tokens (real JWTs)', () => {
  const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
  const jwt = new JwtService({ secret: 'test-secret' });
  const config = { get: jest.fn((k: string, d?: any) => (k === 'JWT_SECRET' ? 'test-secret' : d)) };

  let users: Record<string, any>;
  let rows: any[];
  let service: AuthService;

  const matches = (row: any, where: any) =>
    Object.entries(where).every(([k, v]) => (v === null ? row[k] == null : row[k] === v));

  const prisma = {
    user: { findUnique: jest.fn(async ({ where }: any) => users[where.id] ?? null) },
    refreshToken: {
      create: jest.fn(async ({ data }: any) => { rows.push({ id: `rt-${rows.length + 1}`, revokedAt: null, createdAt: new Date(), ...data }); }),
      findFirst: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
  };

  const activeUser = () => ({
    id: 'user-1', email: 'a@x.org', firstName: 'A', lastName: 'B', avatarUrl: null, schoolId: 'school-1',
    isActive: true, deletedAt: null, passwordChangedAt: null, metadata: null,
    userRoles: [{ role: { name: 'servant' } }],
  });

  const issue = async (userId = 'user-1') => {
    const tokens = await (service as any).generateTokens(userId, 'a@x.org', 'school-1');
    await (service as any).storeRefreshToken(userId, tokens.refreshToken);
    return tokens as { accessToken: string; refreshToken: string };
  };

  beforeEach(() => {
    users = { 'user-1': activeUser() };
    rows = [];
    service = new AuthService(prisma as any, jwt, config as any, {} as any, {} as any, {} as any);
  });

  describe('what gets issued', () => {
    it('labels each token with its type and stores a SHA-256 of the refresh token', async () => {
      const { accessToken, refreshToken } = await issue();

      expect(jwt.decode(accessToken)).toMatchObject({ sub: 'user-1', typ: 'access' });
      expect(jwt.decode(refreshToken)).toMatchObject({ sub: 'user-1', typ: 'refresh', jti: expect.any(String) });
      expect(rows[0].tokenHash).toBe(sha256(refreshToken));
    });

    it('gives two refresh tokens issued in the same second different hashes', async () => {
      const a = await issue();
      const b = await issue();

      expect(a.refreshToken).not.toBe(b.refreshToken);
      expect(rows[0].tokenHash).not.toBe(rows[1].tokenHash);
    });
  });

  describe('refresh', () => {
    it('rotates: the new pair works, the old refresh token is revoked', async () => {
      const first = await issue();

      const second = await service.refreshToken(first.refreshToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(rows.find((r) => r.tokenHash === sha256(first.refreshToken)).revokedAt).toBeInstanceOf(Date);
      await expect(service.refreshToken(second.refreshToken)).resolves.toBeDefined();
    });

    it('refuses an ACCESS token, which used to be accepted because bcrypt only compares 72 bytes', async () => {
      const { accessToken } = await issue();

      await expect(service.refreshToken(accessToken)).rejects.toThrow(UnauthorizedException);
      expect(rows).toHaveLength(1);
      expect(rows[0].revokedAt).toBeNull();
    });

    it('refuses a reset token and a token with no type', async () => {
      await issue();
      const reset = jwt.sign({ sub: 'user-1', purpose: 'password-reset', typ: 'reset' }, { expiresIn: '1h' });
      const untyped = jwt.sign({ sub: 'user-1', email: 'a@x.org', schoolId: 'school-1' }, { expiresIn: '7d' });
      rows[0].tokenHash = sha256(untyped);

      await expect(service.refreshToken(reset)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(untyped)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a refresh token that was never stored', async () => {
      await issue();
      const stray = jwt.sign({ sub: 'user-1', typ: 'refresh' }, { expiresIn: '7d' });

      await expect(service.refreshToken(stray)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a stored token that has expired', async () => {
      const { refreshToken } = await issue();
      rows[0].expiresAt = new Date(Date.now() - 1000);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('two tabs racing: the loser is refused but the winner\'s session survives', async () => {
      const first = await issue();
      const winner = await service.refreshToken(first.refreshToken);

      await expect(service.refreshToken(first.refreshToken)).rejects.toThrow(/revoked/);

      await expect(service.refreshToken(winner.refreshToken)).resolves.toBeDefined();
    });

    it('a token reused long after rotation is treated as stolen: every session ends', async () => {
      const stolen = await issue();
      const current = await service.refreshToken(stolen.refreshToken);
      rows.find((r) => r.tokenHash === sha256(stolen.refreshToken)).revokedAt = new Date(Date.now() - 60_000);

      await expect(service.refreshToken(stolen.refreshToken)).rejects.toThrow(UnauthorizedException);

      await expect(service.refreshToken(current.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a refresh for a soft-deleted user', async () => {
      const { refreshToken } = await issue();
      users['user-1'].deletedAt = new Date();

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a refresh for a deactivated user', async () => {
      const { refreshToken } = await issue();
      users['user-1'].isActive = false;

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a refresh token issued before the last password change', async () => {
      const { refreshToken } = await issue();
      users['user-1'].passwordChangedAt = new Date(Date.now() + 5_000);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('refuses a soft-deleted user (deleteUser only sets deletedAt)', async () => {
      users['user-1'].deletedAt = new Date();

      await expect(service.validateUser('user-1')).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a token issued before the password was changed', async () => {
      const changedAt = new Date('2026-10-30T12:00:00Z');
      users['user-1'].passwordChangedAt = changedAt;
      const changedSec = Math.floor(changedAt.getTime() / 1000);

      await expect(service.validateUser('user-1', changedSec - 1)).rejects.toThrow(/sign in again/);
    });

    it('accepts a token issued in the same second as, or after, the change', async () => {
      const changedAt = new Date('2026-10-30T12:00:00.400Z');
      users['user-1'].passwordChangedAt = changedAt;
      const changedSec = Math.floor(changedAt.getTime() / 1000);

      await expect(service.validateUser('user-1', changedSec)).resolves.toMatchObject({ id: 'user-1', roles: ['servant'] });
      await expect(service.validateUser('user-1', changedSec + 60)).resolves.toBeDefined();
    });

    it('does not expose deletedAt or passwordChangedAt to the request user', async () => {
      const user: any = await service.validateUser('user-1', 1);

      expect(user).not.toHaveProperty('deletedAt');
      expect(user).not.toHaveProperty('passwordChangedAt');
    });
  });

  describe('logout by refresh token', () => {
    it('ends the sessions when given a refresh token, and ignores an access token', async () => {
      const { accessToken, refreshToken } = await issue();

      await service.logoutByRefreshToken(accessToken);
      expect(rows[0].revokedAt).toBeNull();

      await service.logoutByRefreshToken(refreshToken);
      expect(rows[0].revokedAt).toBeInstanceOf(Date);
    });
  });
});
