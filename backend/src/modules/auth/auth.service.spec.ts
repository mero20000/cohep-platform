import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordResetThrottleService } from './password-reset-throttle.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let config: any;
  let mail: any;
  let resetThrottle: any;

  const IAT_SEC = 1_752_000_000;
  const baseUser = {
    id: 'user-1',
    email: 'user@example.com',
    schoolId: 'school-1',
    isActive: true,
    passwordChangedAt: null,
  };

  const prismaMock = {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    school: { findFirst: jest.fn() },
    refreshToken: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('reset-token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'FRONTEND_URL') return 'https://front.example.com';
              return def;
            }),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordReset: jest.fn().mockResolvedValue(undefined),
            sendRegistrationNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LoginThrottleService,
          useValue: { assertNotLocked: jest.fn(), recordFailure: jest.fn(), clear: jest.fn() },
        },
        {
          provide: PasswordResetThrottleService,
          useValue: { assertAllowed: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
    config = module.get(ConfigService);
    mail = module.get(MailService);
    resetThrottle = module.get(PasswordResetThrottleService);

    jest.clearAllMocks();
    jwt.verifyAsync.mockReset();
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      purpose: 'password-reset',
      iat: IAT_SEC,
    });
  });

  describe('forgotPassword', () => {
    it('prefers a super_admin account when no school is given', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);

      const result = await service.forgotPassword(
        { email: 'user@example.com' },
        'https://cohep-platform.vercel.app',
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email: 'user@example.com', userRoles: { some: { role: { name: 'super_admin' } } } }),
        }),
      );
      expect(mail.sendPasswordReset).toHaveBeenCalledWith(
        'user@example.com',
        'https://cohep-platform.vercel.app/reset-password?token=reset-token',
      );
      expect(result.message).toContain('If an account exists');
    });

    it('falls back to a generic lookup when no super_admin exists', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseUser);

      await service.forgotPassword({ email: 'user@example.com' });

      expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
      expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
    });

    it('resolves via school when schoolIdentifier is provided', async () => {
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1' });
      prisma.user.findFirst.mockResolvedValue(baseUser);

      await service.forgotPassword({ email: 'user@example.com', schoolIdentifier: 'niangelos-main' });

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ schoolId: 'school-1' }) }),
      );
      expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
    });

    it('returns the generic message without sending mail for an unknown email', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'ghost@example.com' });

      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
      expect(result.message).toContain('If an account exists');
    });

    it('does not send mail for a deactivated account', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, isActive: false });

      await service.forgotPassword({ email: 'user@example.com' });

      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('uses FRONTEND_URL env as the link base when no origin is present', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);

      await service.forgotPassword({ email: 'user@example.com' });

      expect(mail.sendPasswordReset).toHaveBeenCalledWith(
        'user@example.com',
        'https://front.example.com/reset-password?token=reset-token',
      );
    });

    it('propagates rate-limit rejection', async () => {
      resetThrottle.assertAllowed.mockImplementation(() => {
        throw new HttpException('Too many password reset requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      });

      await expect(service.forgotPassword({ email: 'user@example.com' }, undefined, '1.2.3.4')).rejects.toThrow(HttpException);
    });

    it('swallows mail failures and still returns the generic message', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      mail.sendPasswordReset.mockRejectedValue(new Error('smtp down'));

      const result = await service.forgotPassword({ email: 'user@example.com' });

      expect(result.message).toContain('If an account exists');
    });
  });

  describe('verifyResetToken', () => {
    it('returns the masked email for a valid token', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.verifyResetToken('valid-token');

      expect(result.email).toBe('us••@example.com');
    });

    it('rejects a token whose user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyResetToken('valid-token')).rejects.toThrow(BadRequestException);
    });

    it('rejects an already-used token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordChangedAt: new Date((IAT_SEC + 5) * 1000),
      });

      await expect(service.verifyResetToken('valid-token')).rejects.toThrow(BadRequestException);
    });

    it('rejects an invalid signature', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.verifyResetToken('bad-token')).rejects.toThrow(BadRequestException);
    });

    it('rejects a token with the wrong purpose', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'access', iat: IAT_SEC });
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.verifyResetToken('access-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('sets a new password and passwordChangedAt', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.resetPassword('valid-token', 'NewPassword123!');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            passwordHash: 'hashed-password',
            passwordChangedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.message).toContain('Password reset successfully');
    });

    it('rejects an already-used token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordChangedAt: new Date((IAT_SEC + 5) * 1000),
      });

      await expect(service.resetPassword('valid-token', 'NewPassword123!')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.resetPassword('bad-token', 'NewPassword123!')).rejects.toThrow(BadRequestException);
    });
  });
});
