import {
  DEFAULT_MAX_ATTEMPTS,
  RetryPolicy,
  LiveAttempt,
  attemptState,
  effectiveMaxAttempts,
  scoreOnTotalScale,
  submissionScore,
} from './assessment-attempts';

describe('assessment-attempts', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  const past = new Date('2026-11-01T12:00:00Z');

  const policy = (over: Partial<RetryPolicy> = {}): RetryPolicy => ({
    allowRetry: true,
    maxAttempts: 3,
    passingScore: 60,
    dueDate: null,
    allowLateSubmission: false,
    ...over,
  });

  const live = (over: Partial<LiveAttempt> = {}): LiveAttempt => ({
    status: 'completed',
    attemptNumber: 1,
    earned: 40,
    ...over,
  });

  describe('effectiveMaxAttempts', () => {
    it('is 1 when retry is off', () => {
      expect(effectiveMaxAttempts({ allowRetry: false, maxAttempts: 5 })).toBe(1);
    });

    it('uses maxAttempts when retry is on', () => {
      expect(effectiveMaxAttempts({ allowRetry: true, maxAttempts: 2 })).toBe(2);
    });

    it('defaults to 3 when retry is on and maxAttempts is null', () => {
      expect(DEFAULT_MAX_ATTEMPTS).toBe(3);
      expect(effectiveMaxAttempts({ allowRetry: true, maxAttempts: null })).toBe(3);
    });
  });

  describe('submissionScore', () => {
    it('uses the overall grade row when present, ignoring per-question rows', () => {
      const result = submissionScore(
        [
          { questionId: 'q1', score: 2, maxScore: 5 },
          { questionId: null, score: 7, maxScore: 10 },
          { questionId: 'q2', score: 4, maxScore: 5 },
        ],
        10,
      );
      expect(result).toEqual({ earned: 7, max: 10 });
    });

    it('sums per-question rows with max = totalPoints when there is no overall row', () => {
      const result = submissionScore(
        [
          { questionId: 'q1', score: 2, maxScore: 5 },
          { questionId: 'q2', score: '4', maxScore: 5 },
        ],
        20,
      );
      expect(result).toEqual({ earned: 6, max: 20 });
    });
  });

  describe('scoreOnTotalScale', () => {
    it('scales a mark recorded against a smaller max up to the total', () => {
      expect(scoreOnTotalScale(8, 10, 100)).toBe(80);
    });

    it('is the identity when max equals the total', () => {
      expect(scoreOnTotalScale(6, 6, 6)).toBe(6);
    });

    it('returns 0 when max is 0', () => {
      expect(scoreOnTotalScale(0, 0, 100)).toBe(0);
    });
  });

  describe('attemptState', () => {
    it('retry off: max 1, no retry, answer key open', () => {
      const s = attemptState(policy({ allowRetry: false }), live(), now);
      expect(s.max).toBe(1);
      expect(s.canRetry).toBe(false);
      expect(s.answerKeyOpen).toBe(true);
    });

    it('failed completed attempt 1 of 3: can retry, key closed, 2 remaining', () => {
      const s = attemptState(policy(), live(), now);
      expect(s.passed).toBe(false);
      expect(s.canRetry).toBe(true);
      expect(s.answerKeyOpen).toBe(false);
      expect(s.remaining).toBe(2);
    });

    it('passed: no retry, answer key open', () => {
      const s = attemptState(policy(), live({ earned: 60 }), now);
      expect(s.passed).toBe(true);
      expect(s.canRetry).toBe(false);
      expect(s.answerKeyOpen).toBe(true);
    });

    it('failed on the last attempt: no retry, key open, 0 remaining', () => {
      const s = attemptState(policy(), live({ attemptNumber: 3 }), now);
      expect(s.canRetry).toBe(false);
      expect(s.answerKeyOpen).toBe(true);
      expect(s.remaining).toBe(0);
    });

    it('failed, due date past, late not allowed: no retry, key open', () => {
      const s = attemptState(policy({ dueDate: past }), live(), now);
      expect(s.canRetry).toBe(false);
      expect(s.answerKeyOpen).toBe(true);
    });

    it('failed, due date past, late allowed: can retry', () => {
      const s = attemptState(policy({ dueDate: past, allowLateSubmission: true }), live(), now);
      expect(s.canRetry).toBe(true);
    });

    it('submitted (awaiting marking) with attempts left: pending, no retry, key closed', () => {
      const s = attemptState(policy(), live({ status: 'submitted', earned: null }), now);
      expect(s.passed).toBeNull();
      expect(s.moreAttemptsPossible).toBe(true);
      expect(s.canRetry).toBe(false);
      expect(s.answerKeyOpen).toBe(false);
    });
  });
});
