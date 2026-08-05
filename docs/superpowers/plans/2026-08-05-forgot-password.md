# Forgot Password with Secure Reset Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users recover their own password via an emailed one-time reset link, replacing the "contact your school administrator" tooltip on the admin and parent-portal login pages.

**Architecture:** Stateless reset token = signed JWT (reuses `JWT_SECRET`, `purpose: 'password-reset'`, 1h expiry). Single-use enforcement via a new `passwordChangedAt` column on the User row: any token issued before the user's last password change is rejected. Backend exposes `POST /auth/forgot-password`, `GET /auth/reset-password/verify`, and `POST /auth/reset-password`; the frontend gains a new `/reset-password` page plus an inline forgot-password panel on `/auth/login` and `/portal/login`. Email delivery reuses the existing Gmail SMTP `MailService`.

**Tech Stack:** NestJS 10, Prisma (PostgreSQL), `@nestjs/jwt`, `bcrypt` (cost 12), class-validator DTOs (whitelist + forbidNonWhitelisted), nodemailer, Next.js App Router (client components), Tailwind, Vitest + Testing Library.

## Global Constraints

- DTOs use class-validator + `ApiProperty`/`ApiPropertyOptional` (Swagger), validated by the global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`).
- New passwords hashed with `bcrypt.hash(password, 12)` — matches `changePassword`/`register` in `auth.service.ts`.
- Reset tokens signed via `jwtService.signAsync(payload, { secret: config.get('JWT_SECRET'), expiresIn: '1h' })` and verified with `verifyAsync(token, { secret: config.get('JWT_SECRET') })`.
- Forgot-password responses never distinguish "no such account" from success (no account enumeration). Always `200` with `{ message: "If an account exists, a reset link was sent." }`.
- Email send failures are swallowed in `forgotPassword` (logging already happens inside `MailService.sendMail`).
- Reset link base URL: request `Origin` header when present, else `FRONTEND_URL` env, else `https://cohep-platform.vercel.app`; strip trailing `/`.
- Rate limit: `PasswordResetThrottleService` — max 3 requests/email/15min, max 10/IP/15min, in-memory (matches `LoginThrottleService` single-instance note). `@Throttle({ default: { limit: 5, ttl: 60000 } })` on the forgot-password route as a coarse layer.
- The student portal login is code-based (no password) — **out of scope**, no changes there.
- Backend verification: `npx jest` (unit), `npx tsc --noEmit`. Frontend verification: `npm run test`, `npm run type-check`, `npm run lint`.
- Every task commits independently with a conventional-style message (e.g. `feat(auth): ...`).
- Bilingual (EN/AR) copy matches the tone of `frontend/src/app/auth/login/page.tsx`; the parent-portal page stays English-only (it has no language switcher).

---

### Task 1: Add `passwordChangedAt` to User + Prisma migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (User model, after `lastLoginAt` at line 150)
- Create: `backend/prisma/migrations/20260805000000_add_password_changed_at/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `User.passwordChangedAt DateTime? @map("password_changed_at")` — used by Tasks 4, 5, 6 for single-use enforcement.

- [ ] **Step 1: Add the field to the schema**

Edit `backend/prisma/schema.prisma` User model:

```prisma
  lastLoginAt     DateTime? @map("last_login_at")
  passwordChangedAt DateTime? @map("password_changed_at")
  metadata        Json?
```

- [ ] **Step 2: Create the migration**

Create `backend/prisma/migrations/20260805000000_add_password_changed_at/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
```

- [ ] **Step 3: Regenerate the Prisma client and typecheck**

```bash
cd backend && npx prisma generate
npx tsc --noEmit
```

Expected: no errors; `prisma generate` completes.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260805000000_add_password_changed_at/migration.sql
git commit -m "feat(auth): add password_changed_at for one-time reset links"
```

---

### Task 2: `PasswordResetThrottleService` (rate limiter) with unit tests

**Files:**
- Create: `backend/src/modules/auth/password-reset-throttle.service.ts`
- Test: `backend/src/modules/auth/password-reset-throttle.service.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class PasswordResetThrottleService` with `assertAllowed(email: string, ip?: string): void` — throws `HttpException('Too many password reset requests. Please try again later.', 429)`. Consumed by Task 5 (`AuthService.forgotPassword`) and registered in `AuthModule` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/auth/password-reset-throttle.service.spec.ts`:

```ts
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
    for (let i = 0; i < 10; i++) service.assertAllowed('a@b.com', `10.0.0.${i}`);
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/modules/auth/password-reset-throttle.service.spec.ts
```

Expected: FAIL — `Cannot find module './password-reset-throttle.service'`.

- [ ] **Step 3: Implement the service**

Create `backend/src/modules/auth/password-reset-throttle.service.ts`:

```ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

/**
 * Per-email + per-IP throttling for the forgot-password endpoint.
 *
 * Prevents an attacker from flooding a victim's inbox with reset links or
 * hammering the endpoint from a single address. In-memory state per process —
 * consistent with the single-instance assumption of LoginThrottleService.
 */
@Injectable()
export class PasswordResetThrottleService {
  private readonly emailState = new Map<string, number[]>();
  private readonly ipState = new Map<string, number[]>();

  private static readonly EMAIL_LIMIT = 3;
  private static readonly IP_LIMIT = 10;
  private static readonly WINDOW_MS = 15 * 60_000;

  assertAllowed(email: string, ip?: string): void {
    this.hit(this.emailState, email.trim().toLowerCase(), PasswordResetThrottleService.EMAIL_LIMIT);
    if (ip) this.hit(this.ipState, ip, PasswordResetThrottleService.IP_LIMIT);
  }

  private hit(state: Map<string, number[]>, key: string, limit: number): void {
    const now = Date.now();
    const windowStart = now - PasswordResetThrottleService.WINDOW_MS;
    const recent = (state.get(key) ?? []).filter((t) => t > windowStart);
    if (recent.length >= limit) {
      throw new HttpException(
        'Too many password reset requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    state.set(key, recent);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/modules/auth/password-reset-throttle.service.spec.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/auth/password-reset-throttle.service.ts backend/src/modules/auth/password-reset-throttle.service.spec.ts
git commit -m "feat(auth): rate-limit forgot-password by email and IP"
```

---

### Task 3: `MailService.sendPasswordReset`

**Files:**
- Modify: `backend/src/modules/mail/mail.service.ts`
- Test: `backend/src/modules/mail/mail.service.spec.ts` (new)

**Interfaces:**
- Consumes: existing `emailTemplate`, `emailParagraph` from `./email-template`; existing `sendMail`.
- Produces: `async sendPasswordReset(to: string, resetUrl: string): Promise<void>` — sends a "Reset your COHEP password" email whose CTA button links to `resetUrl`. Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/mail/mail.service.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const createTransportMock = nodemailer.createTransport as jest.Mock;

describe('MailService', () => {
  let service: MailService;
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ accepted: ['to@example.com'] });
    createTransportMock.mockImplementation(() => ({ sendMail: sendMailMock }));
    service = new MailService({
      get: jest.fn((key: string, def?: any) => {
        if (key === 'MAIL_USER') return 'sender@gmail.com';
        if (key === 'MAIL_PASS') return 'app-password';
        return def;
      }),
    } as unknown as ConfigService);
  });

  it('sends a password reset email with an absolute CTA link', async () => {
    await service.sendPasswordReset(
      'user@example.com',
      'https://cohep-platform.vercel.app/reset-password?token=abc123',
    );

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@niangelos.app',
        to: 'user@example.com',
        subject: 'Reset your COHEP password',
      }),
    );
    const sent = sendMailMock.mock.calls[0][0] as { html: string };
    expect(sent.html).toContain('https://cohep-platform.vercel.app/reset-password?token=abc123');
    expect(sent.html).toContain('Reset Your Password');
    expect(sent.html).toContain('expires in 1 hour');
  });

  it('uses MAIL_FROM when configured', async () => {
    service = new MailService({
      get: jest.fn((key: string, def?: any) => {
        if (key === 'MAIL_FROM') return 'custom@example.com';
        return def;
      }),
    } as unknown as ConfigService);

    await service.sendPasswordReset('user@example.com', 'https://x.example/reset?token=1');
    expect(sendMailMock.mock.calls[0][0].from).toBe('custom@example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/modules/mail/mail.service.spec.ts
```

Expected: FAIL — `sendPasswordReset is not a function`.

- [ ] **Step 3: Implement `sendPasswordReset`**

Add to `backend/src/modules/mail/mail.service.ts` (after `sendAttendanceAlert`, end of class):

```ts
  async sendPasswordReset(to: string, resetUrl: string) {
    const html = emailTemplate({
      title: 'Reset Your Password',
      content: `
        ${emailParagraph('We received a request to reset your password. Click the button below to choose a new one.')}
        ${emailParagraph("If you didn't request this, you can safely ignore this email — your password will stay the same.")}
        ${emailParagraph('This link expires in 1 hour.')}
      `,
      cta: { text: 'Reset Password', url: resetUrl },
    });
    await this.sendMail(to, 'Reset your COHEP password', html);
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/modules/mail/mail.service.spec.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/mail/mail.service.ts backend/src/modules/mail/mail.service.spec.ts
git commit -m "feat(mail): add sendPasswordReset with reset-link CTA"
```

---

### Task 4: DTOs for forgot/reset

**Files:**
- Create: `backend/src/modules/auth/dto/forgot-password.dto.ts`
- Create: `backend/src/modules/auth/dto/reset-password.dto.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ForgotPasswordDto { email: string; schoolIdentifier?: string }` and `ResetPasswordDto { token: string; newPassword: string }`. Consumed by Task 5 (service) and Task 6 (controller).

- [ ] **Step 1: Create `forgot-password.dto.ts`**

```ts
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'niangelos-main' })
  @IsOptional()
  @IsString()
  schoolIdentifier?: string;
}
```

- [ ] **Step 2: Create `reset-password.dto.ts`**

```ts
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Signed one-time reset token from the emailed link' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/auth/dto/forgot-password.dto.ts backend/src/modules/auth/dto/reset-password.dto.ts
git commit -m "feat(auth): DTOs for forgot/reset password"
```

---

### Task 5: `AuthService` forgot / verify / reset logic with unit tests

**Files:**
- Modify: `backend/src/modules/auth/auth.service.ts`
- Test: `backend/src/modules/auth/auth.service.spec.ts` (new)

**Interfaces:**
- Consumes: `PasswordResetThrottleService` (Task 2), `MailService.sendPasswordReset` (Task 3), `ForgotPasswordDto`/`ResetPasswordDto` (Task 4).
- Produces (public methods):
  - `async forgotPassword(dto: { email: string; schoolIdentifier?: string }, origin?: string, ip?: string)` → `Promise<{ message: string }>` — always the generic message.
  - `async verifyResetToken(token: string)` → `Promise<{ email: string }>` (masked) — throws `BadRequestException` for invalid/expired/used links.
  - `async resetPassword(token: string, newPassword: string)` → `Promise<{ message: string }>` — throws `BadRequestException` for invalid/used links.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/auth/auth.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/modules/auth/auth.service.spec.ts
```

Expected: FAIL — `forgotPassword is not a function`.

- [ ] **Step 3: Implement the service methods**

Add to `backend/src/modules/auth/auth.service.ts`:

1. Add `PasswordResetThrottleService` to the imports:

```ts
import { PasswordResetThrottleService } from './password-reset-throttle.service';
```

2. Add the constructor dependency (after `loginThrottle`):

```ts
    private readonly passwordResetThrottle: PasswordResetThrottleService,
```

3. Add the private helpers and public methods (insert after `changePassword`, before `resolveSchool`):

```ts
  private static readonly RESET_TOKEN_TTL = '1h';

  async forgotPassword(
    dto: { email: string; schoolIdentifier?: string },
    origin?: string,
    ip?: string,
  ) {
    const email = dto.email.trim().toLowerCase();
    this.passwordResetThrottle.assertAllowed(email, ip);

    let user: { id: string; email: string; schoolId: string; isActive: boolean } | null = null;

    if (dto.schoolIdentifier) {
      const schoolId = await this.resolveSchool(dto.schoolIdentifier);
      user = await this.prisma.user.findFirst({
        where: { email, schoolId, deletedAt: null },
        select: { id: true, email: true, schoolId: true, isActive: true },
      });
    } else {
      user = await this.prisma.user.findFirst({
        where: { email, deletedAt: null, userRoles: { some: { role: { name: 'super_admin' } } } },
        select: { id: true, email: true, schoolId: true, isActive: true },
      });
      if (!user) {
        user = await this.prisma.user.findFirst({
          where: { email, deletedAt: null },
          select: { id: true, email: true, schoolId: true, isActive: true },
        });
      }
    }

    if (user && user.isActive) {
      const payload = { sub: user.id, email: user.email, purpose: 'password-reset' };
      const token = await this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: AuthService.RESET_TOKEN_TTL,
      });
      const base = (origin || this.configService.get('FRONTEND_URL') || 'https://cohep-platform.vercel.app').replace(/\/$/, '');
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await this.mailService.sendPasswordReset(user.email, resetUrl);
      } catch {
        // Email delivery is best-effort; never reveal send failures to the requester.
      }
    }

    return { message: 'If an account exists, a reset link was sent.' };
  }

  async verifyResetToken(token: string) {
    const payload = await this.decodeResetToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { email: true, passwordChangedAt: true },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset link');
    if (user.passwordChangedAt && user.passwordChangedAt > new Date(payload.iat * 1000)) {
      throw new BadRequestException('This reset link has already been used');
    }
    return { email: this.maskEmail(user.email) };
  }

  async resetPassword(token: string, newPassword: string) {
    const payload = await this.decodeResetToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, passwordChangedAt: true },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset link');
    if (user.passwordChangedAt && user.passwordChangedAt > new Date(payload.iat * 1000)) {
      throw new BadRequestException('This reset link has already been used');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    return { message: 'Password reset successfully. You can now sign in with your new password.' };
  }

  private async decodeResetToken(token: string): Promise<{ sub: string; iat: number }> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset link');
    }
    if (payload.purpose !== 'password-reset' || !payload.sub) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    return { sub: payload.sub, iat: payload.iat ?? 0 };
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    const head = name.slice(0, 2);
    const dots = '•'.repeat(Math.max(0, Math.min(3, name.length - 2)));
    return `${head}${dots}@${domain}`;
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/modules/auth/auth.service.spec.ts src/modules/auth/password-reset-throttle.service.spec.ts
```

Expected: PASS (8 + 7 = 15 tests).

- [ ] **Step 5: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/auth/auth.service.ts backend/src/modules/auth/auth.service.spec.ts
git commit -m "feat(auth): forgot/verify/reset password with one-time email links"
```

---

### Task 6: Wire up `AuthController` + `AuthModule`

**Files:**
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `AuthService.forgotPassword/verifyResetToken/resetPassword` (Task 5), `ForgotPasswordDto`/`ResetPasswordDto` (Task 4), `@Public()` decorator, `@Throttle`.
- Produces: `POST /api/auth/forgot-password`, `GET /api/auth/reset-password/verify`, `POST /api/auth/reset-password` — public, hit from the frontend in Tasks 8–10.

- [ ] **Step 1: Add the routes to the controller**

Modify `backend/src/modules/auth/auth.controller.ts`:

1. Extend the imports:

```ts
import { Controller, Post, Get, Patch, Body, UseGuards, Request, HttpCode, HttpStatus, Res, Query } from '@nestjs/common';
```

2. Add DTO imports:

```ts
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
```

3. Add the three endpoints inside the class (after the `changePassword` route):

```ts
  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 200, description: 'Reset link sent if the account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Request() req) {
    return this.authService.forgotPassword(dto, req.get('origin') || undefined, req.ip);
  }

  @Get('reset-password/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a reset token and return the masked email' })
  @ApiResponse({ status: 200, description: 'Masked email for the token owner' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or used token' })
  async verifyResetToken(@Query('token') token: string) {
    return this.authService.verifyResetToken(token);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiResponse({ status: 200, description: 'Password reset' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or used token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
```

- [ ] **Step 2: Register the throttle service in the module**

Modify `backend/src/modules/auth/auth.module.ts`:

```ts
import { PasswordResetThrottleService } from './password-reset-throttle.service';
```

And in `providers`:

```ts
  providers: [AuthService, LoginThrottleService, PasswordResetThrottleService, JwtStrategy, LocalStrategy],
```

- [ ] **Step 3: Verify**

```bash
cd backend && npx tsc --noEmit && npx jest
```

Expected: tsc clean; all unit tests pass (including the existing `students.service.spec.ts`, `analytics.service.spec.ts`, `html-parser.spec.ts`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/auth/auth.controller.ts backend/src/modules/auth/auth.module.ts
git commit -m "feat(auth): expose forgot/verify/reset password endpoints"
```

---

### Task 7: Shared `ForgotPasswordPanel` component with tests

**Files:**
- Create: `frontend/src/components/auth/forgot-password-panel.tsx`
- Test: `frontend/src/components/auth/forgot-password-panel.test.tsx` (new)

**Interfaces:**
- Consumes: `POST {API}/auth/forgot-password` (Task 6). `API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'`.
- Produces: `ForgotPasswordPanel({ defaultEmail?, defaultSchoolId?, bilingual? })` — renders an inline email+school form with idle/loading/success/error states. Consumed by Tasks 8 and 9.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/auth/forgot-password-panel.test.tsx`:

```tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ForgotPasswordPanel from './forgot-password-panel'

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  for (const name of ['Loader2', 'AlertCircle', 'CheckCircle2', 'KeyRound']) {
    icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return icons
})

const API = 'http://localhost:3001/api'

function createFetchMock(ok = true) {
  return vi.fn((url: string | URL | RequestInfo, options?: any) => {
    if (url.toString() === `${API}/auth/forgot-password` && options?.method === 'POST') {
      if (!ok) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Too many requests' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'If an account exists, a reset link was sent.' }),
      } as Response)
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`))
  })
}

describe('ForgotPasswordPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = createFetchMock()
  })

  it('submits email and shows the generic success message', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPanel />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API}/auth/forgot-password`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"email":"user@example.com"'),
        }),
      )
    })
    expect(await screen.findByText(/If an account exists, a reset link was sent/i)).toBeInTheDocument()
  })

  it('includes schoolIdentifier when provided', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPanel defaultSchoolId="niangelos-main" />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API}/auth/forgot-password`,
        expect.objectContaining({ body: expect.stringContaining('"schoolIdentifier":"niangelos-main"') }),
      )
    })
  })

  it('shows the server error message on failure', async () => {
    globalThis.fetch = createFetchMock(false)
    const user = userEvent.setup()
    render(<ForgotPasswordPanel />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Too many requests')).toBeInTheDocument()
  })

  it('does not submit an empty email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPanel />)

    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('prefills the default email', () => {
    render(<ForgotPasswordPanel defaultEmail="mina@example.com" />)
    expect(screen.getByLabelText(/email/i)).toHaveValue('mina@example.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run test -- src/components/auth/forgot-password-panel.test.tsx
```

Expected: FAIL — `Cannot find module './forgot-password-panel'`.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/auth/forgot-password-panel.tsx`:

```tsx
'use client'

import { useState, FormEvent } from 'react'
import { Loader2, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface ForgotPasswordPanelProps {
  defaultEmail?: string
  defaultSchoolId?: string
  bilingual?: boolean
}

export default function ForgotPasswordPanel({
  defaultEmail = '',
  defaultSchoolId = '',
  bilingual = true,
}: ForgotPasswordPanelProps) {
  const lang = useLanguage()
  const isAr = bilingual && lang === 'ar'

  const [email, setEmail] = useState(defaultEmail)
  const [schoolId, setSchoolId] = useState(defaultSchoolId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const t = {
    email: isAr ? 'البريد الإلكتروني' : 'Email address',
    school: isAr ? 'معرّف المدرسة' : 'School ID',
    schoolOptional: isAr ? 'اختياري' : 'optional',
    send: isAr ? 'إرسال رابط الاستعادة' : 'Send reset link',
    sending: isAr ? 'جارٍ الإرسال...' : 'Sending...',
    success: isAr
      ? 'إذا كان الحساب موجودًا، تم إرسال رابط إعادة التعيين.'
      : 'If an account exists, a reset link was sent.',
    emailRequired: isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address',
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setDone(false)
    if (!validEmail.test(email)) {
      setError(t.emailRequired)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), schoolIdentifier: schoolId.trim() || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '' }))
        throw new Error(err.message || (isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.'))
      }
      setDone(true)
    } catch (err: any) {
      setError(err.message || (isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.'))
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <KeyRound className="h-4 w-4 text-gold-600" />
        {isAr ? 'استعادة كلمة المرور' : 'Reset your password'}
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {done && (
        <div role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 flex items-start gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{t.success}</span>
        </div>
      )}

      <div>
        <label htmlFor="forgot-email" className="block text-xs font-medium text-gray-700 mb-1">
          {t.email}
        </label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="forgot-school" className="block text-xs font-medium text-gray-700 mb-1">
          {t.school} <span className="text-gray-500 font-normal">({t.schoolOptional})</span>
        </label>
        <input
          id="forgot-school"
          type="text"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          autoComplete="off"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
          placeholder="e.g. niangelos-main"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? t.sending : t.send}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm run test -- src/components/auth/forgot-password-panel.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/forgot-password-panel.tsx frontend/src/components/auth/forgot-password-panel.test.tsx
git commit -m "feat(auth): add reusable forgot-password panel"
```

---

### Task 8: Wire the panel into `/auth/login`

**Files:**
- Modify: `frontend/src/app/auth/login/page.tsx`

**Interfaces:**
- Consumes: `ForgotPasswordPanel` (Task 7).
- Produces: the existing "Forgot password?" button toggles the panel (prefilled with the login email/school) instead of the tooltip. Verification: `tsc`, `lint`, and a Playwright DOM probe.

- [ ] **Step 1: Replace the tooltip with the panel**

In `frontend/src/app/auth/login/page.tsx`:

1. Add the import:

```tsx
import ForgotPasswordPanel from '@/components/auth/forgot-password-panel'
```

2. Replace the `forgotHint` state with `showForgot`:

```tsx
  const [showForgot, setShowForgot] = useState(false)
```

3. Replace the tooltip markup (the `relative` div with the button + tooltip, currently lines ~343-359) with:

```tsx
                <button
                  type="button"
                  onClick={() => setShowForgot(!showForgot)}
                  aria-expanded={showForgot}
                  className="text-sm font-semibold text-gold-700 hover:text-gold-500 transition-colors py-2 min-h-[44px]"
                >
                  {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
```

4. Insert the panel immediately after the remember-me/forgot row (i.e. after the closing `</div>` of the `flex items-center justify-between min-h-[44px]` block, before the submit `<Button>`):

```tsx
              {showForgot && (
                <ForgotPasswordPanel defaultEmail={email} defaultSchoolId={schoolId} />
              )}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run type-check && npm run lint
```

Expected: no errors (pre-existing lint warnings allowed).

- [ ] **Step 3: DOM probe against a local dev server**

Run a Playwright probe against the local dev server (which serves the new code without waiting for a deploy):

Create `/tmp/forgot-login-probe.cjs`:

```js
const { chromium } = require('/Users/amir.adly/cohep-platform/frontend/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /forgot password/i }).click();
  const panel = await page.getByLabel('Email address');
  console.log('panel visible:', await panel.isVisible());
  console.log('placeholder:', await panel.getAttribute('placeholder'));
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
```

Run:

```bash
cd frontend && (npm run dev > /tmp/next-dev.log 2>&1 &) && sleep 8 && NODE_PATH=$(pwd)/node_modules node /tmp/forgot-login-probe.cjs; kill %1 2>/dev/null
```

Expected: `panel visible: true` and placeholder `you@example.com`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/auth/login/page.tsx
git commit -m "feat(auth): add forgot-password panel to admin login"
```

---

### Task 9: Wire the panel into `/portal/login`

**Files:**
- Modify: `frontend/src/app/portal/login/page.tsx`

**Interfaces:**
- Consumes: `ForgotPasswordPanel` (Task 7), `getBaseSchoolId()` from `@/lib/school` (already imported).
- Produces: a "Forgot password?" toggle below the form (English-only page, so `bilingual={false}`). Verification: `tsc`, `lint`, and a DOM probe.

- [ ] **Step 1: Add the panel**

In `frontend/src/app/portal/login/page.tsx`:

1. Add the import:

```tsx
import ForgotPasswordPanel from '@/components/auth/forgot-password-panel'
```

2. Add state:

```tsx
  const [showForgot, setShowForgot] = useState(false)
```

3. Insert after the closing `</form>` tag:

```tsx
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowForgot(!showForgot)}
                aria-expanded={showForgot}
                className="text-sm font-semibold text-gold-700 hover:text-gold-500 transition-colors py-2 min-h-[44px]"
              >
                Forgot password?
              </button>
            </div>

            {showForgot && (
              <div className="mt-4">
                <ForgotPasswordPanel defaultEmail={email} defaultSchoolId={getBaseSchoolId()} bilingual={false} />
              </div>
            )}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 3: DOM probe against a local dev server**

Create `/tmp/forgot-portal-probe.cjs`:

```js
const { chromium } = require('/Users/amir.adly/cohep-platform/frontend/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/portal/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /forgot password/i }).click();
  const panel = await page.getByLabel('Email address');
  console.log('panel visible:', await panel.isVisible());
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
```

Run:

```bash
cd frontend && (npm run dev > /tmp/next-dev.log 2>&1 &) && sleep 8 && NODE_PATH=$(pwd)/node_modules node /tmp/forgot-portal-probe.cjs; kill %1 2>/dev/null
```

Expected: `panel visible: true`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/portal/login/page.tsx
git commit -m "feat(auth): add forgot-password panel to parent portal login"
```

---

### Task 10: New `/reset-password` page with tests

**Files:**
- Create: `frontend/src/app/reset-password/page.tsx`
- Test: `frontend/src/app/reset-password/reset-password.test.tsx` (new)

**Interfaces:**
- Consumes: `GET {API}/auth/reset-password/verify?token=...` and `POST {API}/auth/reset-password` (Task 6).
- Produces: a bilingual client page that verifies the `token` from the query string, shows the masked email, collects a new password + confirm, and shows a success state with a link back to `/auth/login`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/reset-password/reset-password.test.tsx`:

```tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResetPasswordPage from './page'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=valid-token'),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  for (const name of ['Cross', 'Loader2', 'AlertCircle', 'CheckCircle2', 'Eye', 'EyeOff']) {
    icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return icons
})

const API = 'http://localhost:3001/api'

function createFetchMock(verifyOk = true) {
  return vi.fn((url: string | URL | RequestInfo, options?: any) => {
    const u = url.toString()
    if (u === `${API}/auth/reset-password/verify?token=valid-token`) {
      if (!verifyOk) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Invalid or expired reset link' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ email: 'us••@example.com' }),
      } as Response)
    }
    if (u === `${API}/auth/reset-password` && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Password reset successfully. You can now sign in with your new password.' }),
      } as Response)
    }
    return Promise.reject(new Error(`Unhandled fetch: ${u}`))
  })
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = createFetchMock()
  })

  it('shows the masked email after verifying the token', async () => {
    render(<ResetPasswordPage />)
    expect(await screen.findByText(/us••@example\.com/i)).toBeInTheDocument()
  })

  it('shows an invalid-link message when verify fails', async () => {
    globalThis.fetch = createFetchMock(false)
    render(<ResetPasswordPage />)
    expect(await screen.findByText(/invalid or expired/i)).toBeInTheDocument()
  })

  it('does not submit when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText(/new password/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm/i), 'Different123!')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // only the verify call
  })

  it('submits the new password and shows success', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText(/new password/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm/i), 'NewPassword123!')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API}/auth/reset-password`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"newPassword":"NewPassword123!"'),
        }),
      )
    })
    expect(await screen.findByText(/password reset successfully/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run test -- src/app/reset-password/reset-password.test.tsx
```

Expected: FAIL — module not found for the page.

- [ ] **Step 3: Implement the page**

Create `frontend/src/app/reset-password/page.tsx`:

```tsx
'use client'

import { Suspense, useEffect, useState, FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Cross, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const lang = useLanguage()
  const isAr = lang === 'ar'

  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'success'>('loading')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    const controller = new AbortController()
    fetch(`${API}/auth/reset-password/verify?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('invalid'))))
      .then((data: { email: string }) => {
        setMaskedEmail(data.email)
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('invalid')
      })
    return () => controller.abort()
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(isAr ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '' }))
        throw new Error(err.message || (isAr ? 'فشل إعادة تعيين كلمة المرور' : 'Password reset failed'))
      }
      setStatus('success')
    } catch (err: any) {
      setError(err.message || (isAr ? 'فشل إعادة تعيين كلمة المرور' : 'Password reset failed'))
    }
    setSubmitting(false)
  }

  const container = (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 text-white">
            <Cross className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password'}</h2>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isAr ? 'جارٍ التحقق من الرابط...' : 'Checking your link...'}
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-4 text-sm text-gray-700">
                {isAr ? 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية.' : 'This reset link is invalid or has expired.'}
              </p>
              <Button asChild variant="gold" className="mt-6 w-full">
                <Link href="/auth/login">{isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</Link>
              </Button>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <p className="mt-4 text-sm text-gray-700">
                {isAr
                  ? 'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
                  : 'Password reset successfully. You can now sign in with your new password.'}
              </p>
              <Button asChild variant="gold" className="mt-6 w-full">
                <Link href="/auth/login">{isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</Link>
              </Button>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
                {isAr
                  ? `إعادة تعيين كلمة المرور لـ ${maskedEmail}`
                  : `Reset password for ${maskedEmail}`}
              </p>

              {error && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr ? 'كلمة المرور الجديدة' : 'New password'}
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm pr-10 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                    placeholder={isAr ? '8 أحرف على الأقل' : 'At least 8 characters'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                />
              </div>

              <Button type="submit" variant="gold" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )

  return container
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
```

> Note: `Button asChild` — confirm `frontend/src/components/ui/button.tsx` already forwards props to a Radix `Slot`; if it does not support `asChild`, replace the two `<Button asChild>` blocks with plain `<Link>` styled identically (rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 text-white px-4 py-2.5 text-center text-sm font-semibold).

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm run test -- src/app/reset-password/reset-password.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Verify**

```bash
cd frontend && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/reset-password/page.tsx frontend/src/app/reset-password/reset-password.test.tsx
git commit -m "feat(auth): add password reset page"
```

---

### Task 11: Full verification

**Files:** none (verification + optional live probe only).

- [ ] **Step 1: Backend**

```bash
cd backend && npx tsc --noEmit && npx jest
```

Expected: tsc clean; all unit tests pass.

- [ ] **Step 2: Frontend**

```bash
cd frontend && npm run type-check && npm run lint && npm run test
```

Expected: no type errors; lint clean (pre-existing warnings allowed); all Vitest suites pass (63 existing + 5 panel + 4 reset page = 72).

- [ ] **Step 3: Optional live smoke test**

If the user has configured `MAIL_*` on Render and pushed, verify end-to-end with a real inbox:
1. Go to `https://cohep-platform.vercel.app/auth/login`, click "Forgot password?", submit the test account email + school.
2. Open the reset email, click the link, set a new password, then sign in with it.
3. Confirm the old password no longer works and the link is rejected on second use.

- [ ] **Step 4: Commit anything remaining and report**

Push decisions are made with the user (per repo convention, pushing to `main` auto-deploys).

---

## Self-Review Notes

- Spec coverage: every section of `docs/superpowers/specs/2026-08-05-forgot-password-design.md` maps to a task — migration (1), throttling (2), mail (3), DTOs (4), service logic (5), endpoints/module (6), admin login UI (7+8), portal UI (9), reset page (10), verification (11). Student portal exclusion is a stated global constraint.
- The `verify` endpoint the user requested is Task 6 + Task 10.
- Placeholder scan: all steps carry real code/tests/commands; the one conditional (`Button asChild`) has an explicit fallback.
- Type consistency: `forgotPassword(dto, origin?, ip?)`, `verifyResetToken(token)`, `resetPassword(token, newPassword)`, `sendPasswordReset(to, resetUrl)`, `assertAllowed(email, ip?)`, and `User.passwordChangedAt` are referenced identically across tasks.
