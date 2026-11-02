import { computeHealthScore } from './health-score';

describe('computeHealthScore', () => {
  it('gives 100 for a healthy week', () => {
    const r = computeHealthScore({ attendanceRate: 100, pendingGrading: 0, studentsAtRisk: 0, familiesPracticedThisWeek: 3 });
    expect(r.score).toBe(100);
  });

  it('keeps the original weights when attendance is known (50/20/20/10)', () => {
    // 82% -> 41, 3 waiting -> 14, 2 at risk -> 12, practice -> 10 = 77
    const r = computeHealthScore({ attendanceRate: 82, pendingGrading: 3, studentsAtRisk: 2, familiesPracticedThisWeek: 1 });
    expect(r.score).toBe(77);
    expect(r.components.map((c) => [c.key, c.points, c.max])).toEqual([
      ['attendance', 41, 50],
      ['grading', 14, 20],
      ['atRisk', 12, 20],
      ['homePractice', 10, 10],
    ]);
  });

  it('every point is accounted for: the components add up to the score', () => {
    const r = computeHealthScore({ attendanceRate: 64, pendingGrading: 4, studentsAtRisk: 1, familiesPracticedThisWeek: 0 });
    expect(r.components.reduce((a, c) => a + c.points, 0)).toBe(r.score);
  });

  it('does not punish a week with no class: attendance is left out and the rest scaled to 100', () => {
    const r = computeHealthScore({ attendanceRate: null, pendingGrading: 0, studentsAtRisk: 0, familiesPracticedThisWeek: 1 });
    expect(r.score).toBe(100);
    const att = r.components.find((c) => c.key === 'attendance')!;
    expect(att.counted).toBe(false);
    expect(att.detailEn).toMatch(/not counted/i);
  });

  it('a genuine 0% attendance is counted (that is not the same as no class)', () => {
    const r = computeHealthScore({ attendanceRate: 0, pendingGrading: 0, studentsAtRisk: 0, familiesPracticedThisWeek: 1 });
    expect(r.components.find((c) => c.key === 'attendance')!.counted).toBe(true);
    expect(r.score).toBe(50);
  });

  it('never goes below zero or above 100', () => {
    const bad = computeHealthScore({ attendanceRate: 0, pendingGrading: 99, studentsAtRisk: 99, familiesPracticedThisWeek: 0 });
    expect(bad.score).toBe(0);
    expect(bad.components.every((c) => c.points >= 0)).toBe(true);
  });

  it('describes each component in both languages', () => {
    const r = computeHealthScore({ attendanceRate: 90, pendingGrading: 1, studentsAtRisk: 1, familiesPracticedThisWeek: 2 });
    for (const c of r.components) {
      expect(c.labelEn).toBeTruthy();
      expect(c.labelAr).toBeTruthy();
      expect(c.detailEn).toBeTruthy();
      expect(c.detailAr).toBeTruthy();
    }
  });
});
