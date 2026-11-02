import { localToday, localHour, nearestBirthday, studentBirthdayWindow } from './birthday';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('birthday utils', () => {
  it('localToday follows the timezone, not UTC', () => {
    const instant = new Date('2026-11-01T23:30:00Z');
    expect(localToday(instant, 'UTC').toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(localToday(instant, 'Africa/Cairo').toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('falls back to UTC for an invalid timezone', () => {
    expect(localToday(new Date('2026-11-01T10:00:00Z'), 'Not/AZone').toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(localHour(new Date('2026-11-01T10:00:00Z'), 'Not/AZone')).toBe(10);
  });

  it('localHour reads the local hour', () => {
    expect(localHour(new Date('2026-11-01T05:00:00Z'), 'Africa/Cairo')).toBe(7);
  });

  it('today, upcoming and passed birthdays', () => {
    const today = d('2026-11-01');
    expect(nearestBirthday(d('2016-11-01'), today)).toMatchObject({ daysAway: 0, turningAge: 10, year: 2026 });
    expect(nearestBirthday(d('2016-11-04'), today)).toMatchObject({ daysAway: 3, turningAge: 10 });
    expect(nearestBirthday(d('2016-10-28'), today)).toMatchObject({ daysAway: -4, turningAge: 10 });
  });

  it('works across new year in both directions', () => {
    expect(nearestBirthday(d('2016-01-02'), d('2026-12-30'))).toMatchObject({ daysAway: 3, year: 2027, turningAge: 11 });
    expect(nearestBirthday(d('2016-12-29'), d('2027-01-02'))).toMatchObject({ daysAway: -4, year: 2026, turningAge: 10 });
  });

  it('celebrates a Feb 29 birthday on Feb 28 in a non-leap year and Feb 29 in a leap year', () => {
    expect(nearestBirthday(d('2016-02-29'), d('2027-02-28'))).toMatchObject({ daysAway: 0, turningAge: 11 });
    expect(nearestBirthday(d('2016-02-29'), d('2028-02-29'))).toMatchObject({ daysAway: 0, turningAge: 12 });
  });

  it('studentBirthdayWindow drops implausible ages (e.g. an import-default date of birth)', () => {
    expect(studentBirthdayWindow(d('2016-11-01'), d('2026-11-01'))?.turningAge).toBe(10);
    expect(studentBirthdayWindow(d('2026-11-01'), d('2026-11-01'))).toBeNull(); // age 0
    expect(studentBirthdayWindow(d('2025-11-01'), d('2026-11-01'))).toBeNull(); // age 1
    expect(studentBirthdayWindow(d('1980-11-01'), d('2026-11-01'))).toBeNull(); // age 46
  });
});
