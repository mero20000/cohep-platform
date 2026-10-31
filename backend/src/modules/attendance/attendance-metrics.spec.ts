import { attendanceRate, rateFromCounts, preciseRateFromCounts, rateOrNull, weeklyRateTrend } from './attendance-metrics';

describe('attendance-metrics', () => {
  it('counts present+late over present+late+absent', () => {
    expect(attendanceRate([
      { status: 'present' }, { status: 'late' }, { status: 'absent' }, { status: 'present' },
    ])).toBe(75);
  });

  it('ignores excused and unmarked rows', () => {
    expect(attendanceRate([
      { status: 'present' }, { status: 'absent' }, { status: 'excused' }, { status: 'unmarked' }, { status: 'unmarked' },
    ])).toBe(50);
  });

  it('returns 0 when nothing was decided', () => {
    expect(attendanceRate([])).toBe(0);
    expect(attendanceRate([{ status: 'unmarked' }, { status: 'excused' }])).toBe(0);
    expect(rateFromCounts({})).toBe(0);
  });

  it('precise rate keeps two decimals', () => {
    expect(preciseRateFromCounts({ present: 2, absent: 1 })).toBe(66.67);
    expect(rateFromCounts({ present: 2, absent: 1 })).toBe(67);
  });
});

describe('rateOrNull', () => {
  it('is null when nothing was decided, so "no class" is not shown as 0%', () => {
    expect(rateOrNull({})).toBeNull();
    expect(rateOrNull({ present: 0, late: 0, absent: 0 })).toBeNull();
  });

  it('is a real 0 when everyone marked was absent', () => {
    expect(rateOrNull({ absent: 3 })).toBe(0);
  });

  it('matches rateFromCounts when there is data', () => {
    expect(rateOrNull({ present: 6, late: 2, absent: 2 })).toBe(80);
  });
});

describe('weeklyRateTrend', () => {
  // A Saturday, so "today" is day 0 of the newest window.
  const NOW = new Date(2026, 9, 31, 15, 0, 0);
  const daysAgo = (n: number) => new Date(2026, 9, 31 - n, 10, 0, 0);

  it('returns the requested number of windows, oldest first', () => {
    const out = weeklyRateTrend([], NOW, 8);
    expect(out).toHaveLength(8);
    expect(out[7].weekStart).toBe('2026-10-25'); // the 7 days ending today: Oct 25..31
    expect(out[6].weekStart).toBe('2026-10-18');
    expect(out[0].weekStart).toBe('2026-09-06');
  });

  it('buckets records into rolling 7-day windows and ignores neutral statuses', () => {
    const out = weeklyRateTrend([
      { status: 'present', date: daysAgo(0) },
      { status: 'late', date: daysAgo(6) },
      { status: 'absent', date: daysAgo(6) },
      { status: 'excused', date: daysAgo(3) }, // neutral
      { status: 'unmarked', date: daysAgo(3) }, // neutral
      { status: 'present', date: daysAgo(7) }, // previous window
      { status: 'absent', date: daysAgo(13) },
    ], NOW, 8);
    expect(out[7]).toMatchObject({ rate: 67, decided: 3 }); // 2 of 3
    expect(out[6]).toMatchObject({ rate: 50, decided: 2 });
  });

  it('marks windows with no decided records as null, not 0', () => {
    const out = weeklyRateTrend([{ status: 'present', date: daysAgo(0) }], NOW, 3);
    expect(out[2].rate).toBe(100);
    expect(out[1].rate).toBeNull();
    expect(out[0].rate).toBeNull();
  });

  it('ignores future and out-of-range records', () => {
    const out = weeklyRateTrend([
      { status: 'absent', date: new Date(2026, 10, 3) }, // future
      { status: 'absent', date: daysAgo(70) }, // older than 8 weeks
    ], NOW, 8);
    expect(out.every((p) => p.decided === 0)).toBe(true);
  });
});
