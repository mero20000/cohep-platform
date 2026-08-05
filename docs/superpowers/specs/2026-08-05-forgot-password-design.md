# Forgot Password with Secure Reset Link — Design

Date: 2026-08-05
Status: Approved

## Problem

The "Forgot password?" link on the login pages only shows a tooltip telling
users to contact their school administrator. There is no self-service password
recovery. The backend has only a super-admin manual reset
(`POST /admin/reset-password`). We want an automated, email-based recovery flow
that depends on the mail configuration (`MAIL_*` env vars) already set up on
the deployed backend.

## Scope

- Self-service forgot-password on the **admin dashboard login** (`/auth/login`)
  and the **parent portal login** (`/portal/login`).
- **Excluded:** the student portal login is code-based (student code, no
  password), so there is nothing to reset there. Students authenticate via
  their code/QR. Confirmed with user.
- The existing super-admin `POST /admin/reset-password` manual tool stays
  unchanged.

## Approach

- **Two public auth endpoints** + a **verify endpoint** on `AuthController`.
- **Stateless reset token**: a signed JWT reusing `JWT_SECRET`, with payload
  `{ sub: userId, email, purpose: 'password-reset', iat, exp }` and a 1-hour
  expiry.
- **Single-use semantics** without a token table: add one nullable column
  `passwordChangedAt` to the User model. On submit, reject the token if
  `user.passwordChangedAt > token.iat` (link already used or superseded).

## Backend

### Data model

Prisma migration adds:

```prisma
model User {
  ...
  passwordChangedAt DateTime?
  ...
}
```

Set `passwordChangedAt = new Date()` whenever a password is reset via the
forgot-password flow.

### Endpoints (all under `AuthController`, public)

1. `POST /auth/forgot-password`
   - Body: `{ email: string, schoolIdentifier?: string }`.
   - No authentication.
   - Resolve target account:
     - If `schoolIdentifier` provided → the active user for that email in that
       school.
     - Else → prefer the `super_admin` row for the email (mirrors the school-less
       login fix); otherwise the first active user.
   - If no matching user, do NOT reveal it: still sign nothing and return the
     generic success message.
   - Signs the reset token, emails a reset link via `MailService.sendPasswordReset`.
   - Always returns `200 { message }` with a generic "If an account exists, a
     reset link was sent." message (prevents account enumeration).
   - Rate limiting (in-memory, mirrors `LoginThrottleService`): max
     3 requests per email per 15 min, max 10 per IP per 15 min.

2. `GET /auth/reset-password/verify?token=...`
   - Returns `{ email }` (masked) for the account the token belongs to, or a
     `400` if invalid/expired/used. Enables the "Reset password for s•••@…"
     UX on the reset page.

3. `POST /auth/reset-password`
   - Body: `{ token: string, newPassword: string }`.
   - Verify signature, `purpose`, `exp`, and single-use:
     - reject if `user.passwordChangedAt > new Date(token.iat * 1000)`.
   - Set new bcrypt hash (cost 12, consistent with the rest of the codebase)
     and `passwordChangedAt = now`.

### Mail

`MailService.sendPasswordReset(to: string, resetUrl: string)` using the
existing `emailTemplate` with a "Reset Password" CTA button.

Reset link base URL: use the request `Origin` header when present (the frontend
calling the API), falling back to `FRONTEND_URL` env. Note
`backend/render.yaml` currently declares `FRONTEND_URL: https://cohe-eight.vercel.app`,
which looks stale versus the real frontend
(`https://cohep-platform.vercel.app`); the Origin-first strategy avoids relying
on it. Link format: `<base>/reset-password?token=<jwt>`.

## Frontend

1. **`/auth/login`**: replace the "Forgot password?" tooltip with an inline
   toggle form (email + optional school field). On submit → `POST
   /auth/forgot-password`, then show the generic success message. Bilingual
   (EN/AR), matching existing page conventions.

2. **`/portal/login`**: same inline toggle form, same behavior.

3. **New page `/reset-password`**: client page that reads `token` from the
   query string; on mount calls `GET /auth/reset-password/verify` to show
   "Reset password for s•••@…"; a new-password + confirm form; submits `POST
   /auth/reset-password`; success screen with a link back to the appropriate
   login. Bilingual (EN/AR).

## Error handling

- Invalid/expired/used token → clear error message on the reset page, no
  partial state.
- Forgot-password always succeeds visually (no enumeration).
- Rate-limit exceeded → generic "Too many requests, try again later" response;
  frontend shows the server message.

## Testing

- Backend unit tests for `AuthService`:
  - token sign + verify round-trip
  - expired token rejected
  - wrong `purpose` rejected
  - used token rejected (via `passwordChangedAt`)
  - account resolution (school provided, super_admin preference, none found)
  - rate limiter (email + IP caps)
  - no-enumeration response for unknown email

## Out of scope

- Student portal password reset (code-based; see Scope).
- Email-based login for students.
- Distributed/Redis rate limiting (single-instance assumption, consistent with
  existing `LoginThrottleService` note).
