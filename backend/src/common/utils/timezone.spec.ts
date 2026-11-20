import { zonedTimeToUtc } from './timezone';

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('zonedTimeToUtc', () => {
  it('maps local midnight in Cairo (UTC+2 in November) to 22:00Z the day before', () => {
    expect(zonedTimeToUtc(day(2026, 11, 20), 0, 'Africa/Cairo').toISOString()).toBe('2026-11-19T22:00:00.000Z');
  });

  it('maps local noon in Los Angeles (UTC-8 in November) to 20:00Z', () => {
    expect(zonedTimeToUtc(day(2026, 11, 20), 12, 'America/Los_Angeles').toISOString()).toBe('2026-11-20T20:00:00.000Z');
  });

  it('handles the daylight-saving switch: New York midnight is 05:00Z before it and 04:00Z after it', () => {
    expect(zonedTimeToUtc(day(2026, 3, 8), 0, 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(zonedTimeToUtc(day(2026, 3, 9), 0, 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('treats an unknown timezone as UTC', () => {
    expect(zonedTimeToUtc(day(2026, 11, 20), 12, 'Not/AZone').toISOString()).toBe('2026-11-20T12:00:00.000Z');
  });
});
