// Pure attempt/score/pass helpers (no Prisma, no Nest). Callers convert Decimal
// columns to numbers before passing them in.

export const DEFAULT_MAX_ATTEMPTS = 3;

export interface RetryPolicy {
  allowRetry: boolean;
  maxAttempts: number | null;
  passingScore: number;
  dueDate: Date | null;
  allowLateSubmission: boolean;
}

export interface LiveAttempt {
  status: string;
  attemptNumber: number;
  earned: number | null;
}

/** 1 when retry is off, otherwise the configured limit (default 3). */
export function effectiveMaxAttempts(p: Pick<RetryPolicy, 'allowRetry' | 'maxAttempts'>): number {
  return p.allowRetry ? (p.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) : 1;
}

/**
 * The overall grade row (questionId null) is authoritative when present;
 * otherwise sum the per-question grades against the assessment's total points.
 */
export function submissionScore(
  grades: Array<{ questionId: string | null; score: unknown; maxScore: unknown }>,
  totalPoints: number,
): { earned: number; max: number } {
  const overall = grades.find((g) => g.questionId === null);
  if (overall) {
    return { earned: Number(overall.score), max: Number(overall.maxScore) };
  }
  const earned = grades.reduce((sum, g) => sum + Number(g.score), 0);
  return { earned, max: totalPoints };
}

export function attemptState(policy: RetryPolicy, live: LiveAttempt, now: Date = new Date()) {
  const max = effectiveMaxAttempts(policy);
  const { attemptNumber } = live;

  const passed =
    live.status === 'completed' && live.earned !== null ? live.earned >= policy.passingScore : null;

  const dueOpen = !(policy.dueDate && now > policy.dueDate && !policy.allowLateSubmission);
  const moreAttemptsPossible =
    policy.allowRetry && passed !== true && attemptNumber < max && dueOpen;
  const canRetry = moreAttemptsPossible && passed === false;
  const answerKeyOpen = !policy.allowRetry || passed === true || !moreAttemptsPossible;

  return {
    attemptNumber,
    max,
    remaining: Math.max(0, max - attemptNumber),
    passed,
    moreAttemptsPossible,
    canRetry,
    answerKeyOpen,
  };
}
