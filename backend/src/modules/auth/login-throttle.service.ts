import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface AccountState {
  attempts: number;
  lockedUntil: number;
}

/**
 * Per-account login throttling with exponential backoff.
 *
 * Guards the login endpoint against targeted brute-force on a specific
 * account (the per-IP throttle covers distributed attacks). State is held
 * in memory per process — acceptable for a single-instance deploy; swap for
 * Redis if the backend is scaled horizontally.
 */
@Injectable()
export class LoginThrottleService {
  private readonly state = new Map<string, AccountState>();

  private static readonly MAX_ATTEMPTS = 5;
  private static readonly BASE_LOCK_MS = 60_000; // 1 minute
  private static readonly MAX_LOCK_MS = 30 * 60_000; // 30 minutes
  private static readonly SWEEP_INTERVAL_MS = 5 * 60_000;

  private lastSweep = Date.now();

  /**
   * Throws 429 if `identifier` is currently locked out. Otherwise no-op.
   */
  assertNotLocked(identifier: string): void {
    this.sweep();
    const key = identifier.trim().toLowerCase();
    const account = this.state.get(key);
    if (!account) return;

    const remainingMs = account.lockedUntil - Date.now();
    if (remainingMs > 0) {
      const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
      throw new HttpException(
        `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Lock expired — reset the counter so the user starts fresh.
    this.state.delete(key);
  }

  /**
   * Registers a failed login and extends the lockout window.
   */
  recordFailure(identifier: string): void {
    const key = identifier.trim().toLowerCase();
    const account = this.state.get(key) ?? { attempts: 0, lockedUntil: 0 };
    account.attempts += 1;
    account.lockedUntil = Date.now() + this.backoffFor(account.attempts);
    this.state.set(key, account);
  }

  /**
   * Clears the throttle state after a successful login.
   */
  clear(identifier: string): void {
    this.state.delete(identifier.trim().toLowerCase());
  }

  private backoffFor(attempts: number): number {
    if (attempts <= LoginThrottleService.MAX_ATTEMPTS) return 0;
    const extra = attempts - LoginThrottleService.MAX_ATTEMPTS;
    const lock = LoginThrottleService.BASE_LOCK_MS * 2 ** (extra - 1);
    return Math.min(lock, LoginThrottleService.MAX_LOCK_MS);
  }

  private sweep(): void {
    if (Date.now() - this.lastSweep < LoginThrottleService.SWEEP_INTERVAL_MS) return;
    this.lastSweep = Date.now();
    const now = Date.now();
    for (const [key, account] of this.state) {
      if (account.lockedUntil < now) this.state.delete(key);
    }
  }
}
