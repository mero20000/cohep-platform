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
