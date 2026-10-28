import { pickLive, liveByKey, isEligible, ineligibleReason, scoreOf, compareLive, assessmentGender } from './assessment-lifecycle';

const row = (over: any = {}) => ({
  id: 'r', status: 'assigned', attemptNumber: 1, createdAt: new Date('2026-01-01'), ...over,
});

describe('assessment lifecycle rules', () => {
  describe('pickLive', () => {
    it('prefers a completed record over a newer pending duplicate (the "done and pending" case)', () => {
      const done = row({ id: 'done', status: 'completed', createdAt: new Date('2026-01-01') });
      const pending = row({ id: 'pending', status: 'assigned', createdAt: new Date('2026-02-01') });

      expect(pickLive([pending, done])?.id).toBe('done');
      expect(pickLive([done, pending])?.id).toBe('done');
    });

    it('ranks submitted above assigned, and the newest wins between equals', () => {
      expect(pickLive([row({ id: 'a' }), row({ id: 'b', status: 'submitted' })])?.id).toBe('b');
      expect(
        pickLive([row({ id: 'old', createdAt: new Date('2026-01-01') }), row({ id: 'new', createdAt: new Date('2026-03-01') })])?.id,
      ).toBe('new');
    });

    it('lets a later attempt beat an earlier completed one', () => {
      const attempt2 = row({ id: 'retake', attemptNumber: 2 });
      const attempt1 = row({ id: 'first', attemptNumber: 1, status: 'completed' });
      expect(pickLive([attempt1, attempt2])?.id).toBe('retake');
    });

    it('returns undefined for no rows and ignores unknown statuses by ranking them lowest', () => {
      expect(pickLive([])).toBeUndefined();
      expect(compareLive(row({ status: 'weird' }), row({ status: 'assigned' }))).toBeLessThan(0);
    });
  });

  it('liveByKey keeps one live record per key', () => {
    const out = liveByKey(
      [
        { ...row({ id: 'a1', status: 'completed' }), k: 'A' },
        { ...row({ id: 'a2' }), k: 'A' },
        { ...row({ id: 'b1' }), k: 'B' },
      ],
      (r) => r.k,
    );
    expect(out.size).toBe(2);
    expect(out.get('A')?.id).toBe('a1');
    expect(out.get('B')?.id).toBe('b1');
  });

  describe('eligibility', () => {
    const student = { levelId: 'l1', groupId: 'g1' };

    it('requires the same level, and the same group when the assessment has one', () => {
      expect(isEligible(student, { levelId: 'l1', groupId: null })).toBe(true);
      expect(isEligible(student, { levelId: 'l1', groupId: 'g1' })).toBe(true);
      expect(isEligible(student, { levelId: 'l2', groupId: null })).toBe(false);
      expect(isEligible(student, { levelId: 'l1', groupId: 'g2' })).toBe(false);
    });

    it('says why a student is not eligible', () => {
      expect(ineligibleReason(student, { levelId: 'l2', groupId: null })).toBe('level');
      expect(ineligibleReason(student, { levelId: 'l1', groupId: 'g2' })).toBe('group');
      expect(ineligibleReason(student, { levelId: 'l1', groupId: 'g1' })).toBeNull();
    });
  });

  describe('gender audience', () => {
    it('reads the audience from metadata and treats anything else as everyone', () => {
      expect(assessmentGender({ gender: 'female' })).toBe('female');
      expect(assessmentGender({ gender: 'male' })).toBe('male');
      expect(assessmentGender({ gender: 'all' })).toBe('all');
      for (const m of [null, undefined, {}, { gender: 'boys' }, { gender: 3 }, 'x']) {
        expect(assessmentGender(m)).toBe('all');
      }
    });

    it('limits a boys-only or girls-only assessment to that gender, on top of level and group', () => {
      const girl = { levelId: 'l1', groupId: 'g1', gender: 'female' };
      const boy = { levelId: 'l1', groupId: 'g1', gender: 'male' };

      expect(isEligible(girl, { levelId: 'l1', groupId: 'g1', gender: 'female' })).toBe(true);
      expect(isEligible(boy, { levelId: 'l1', groupId: 'g1', gender: 'female' })).toBe(false);
      expect(ineligibleReason(boy, { levelId: 'l1', groupId: 'g1', gender: 'female' })).toBe('gender');
      expect(isEligible(boy, { levelId: 'l1', groupId: 'g1', gender: 'all' })).toBe(true);
      expect(isEligible(boy, { levelId: 'l1', groupId: 'g1' })).toBe(true);
    });

    it('reports level and group before gender, and refuses a student with no gender recorded', () => {
      const boy = { levelId: 'l1', groupId: 'g1', gender: 'male' };
      expect(ineligibleReason(boy, { levelId: 'l2', groupId: null, gender: 'female' })).toBe('level');
      expect(ineligibleReason(boy, { levelId: 'l1', groupId: 'g2', gender: 'female' })).toBe('group');
      expect(isEligible({ levelId: 'l1', groupId: 'g1', gender: null }, { levelId: 'l1', groupId: null, gender: 'male' })).toBe(false);
    });
  });

  describe('scoreOf', () => {
    it('uses the overall grade rather than adding it to the per-question grades', () => {
      expect(
        scoreOf([
          { questionId: 'q1', score: 4, maxScore: 5 },
          { questionId: 'q2', score: 3, maxScore: 5 },
          { questionId: null, score: 7, maxScore: 10 },
        ]),
      ).toEqual({ score: 7, maxScore: 10 });
    });

    it('sums per-question grades when no overall grade exists, and is null with no grades', () => {
      expect(scoreOf([{ questionId: 'q1', score: 4, maxScore: 5 }, { questionId: 'q2', score: 3, maxScore: 5 }]))
        .toEqual({ score: 7, maxScore: 10 });
      expect(scoreOf([])).toBeNull();
    });
  });
});
