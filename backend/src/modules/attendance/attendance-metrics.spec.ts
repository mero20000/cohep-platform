import { attendanceRate, rateFromCounts, preciseRateFromCounts } from './attendance-metrics';

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
