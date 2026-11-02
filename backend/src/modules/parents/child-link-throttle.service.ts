import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * Limits guessing of student code + date of birth when a parent links a child.
 *
 * - 5 attempts an hour per parent account (every attempt counts, so a script cannot rotate codes).
 * - 20 wrong guesses a day per school (only failures count, so a busy enrolment day cannot lock
 *   out parents who are entering correct details).
 *
 * In-memory per process, consistent with the single-instance assumption of the other throttles.
 */
@Injectable()
export class ChildLinkThrottleService {
  private readonly perParent = new Map<string, number[]>();
  private readonly schoolFailures = new Map<string, number[]>();

  static readonly PARENT_LIMIT = 5;
  static readonly PARENT_WINDOW_MS = 60 * 60_000;
  static readonly SCHOOL_FAILURE_LIMIT = 20;
  static readonly SCHOOL_WINDOW_MS = 24 * 60 * 60_000;

  /** Counts this attempt; throws 429 on the sixth within the hour. */
  recordAttempt(parentId: string): void {
    const recent = this.recent(this.perParent, parentId, ChildLinkThrottleService.PARENT_WINDOW_MS);
    if (recent.length >= ChildLinkThrottleService.PARENT_LIMIT) this.tooMany();
    recent.push(Date.now());
    this.perParent.set(parentId, recent);
  }

  assertSchoolNotLocked(schoolId: string): void {
    const recent = this.recent(this.schoolFailures, schoolId, ChildLinkThrottleService.SCHOOL_WINDOW_MS);
    if (recent.length >= ChildLinkThrottleService.SCHOOL_FAILURE_LIMIT) this.tooMany();
  }

  recordSchoolFailure(schoolId: string): void {
    const recent = this.recent(this.schoolFailures, schoolId, ChildLinkThrottleService.SCHOOL_WINDOW_MS);
    recent.push(Date.now());
    this.schoolFailures.set(schoolId, recent);
  }

  private recent(state: Map<string, number[]>, key: string, windowMs: number): number[] {
    const since = Date.now() - windowMs;
    const kept = (state.get(key) ?? []).filter((t) => t > since);
    if (kept.length === 0) state.delete(key);
    return kept;
  }

  private tooMany(): never {
    throw new HttpException('Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
