/** Today's calendar date in an IANA timezone, as a UTC-midnight Date (so day maths is DST-free). */
export function localToday(now: Date, timeZone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

/** Hour (0-23) in an IANA timezone. */
export function localHour(now: Date, timeZone: string): number {
  try {
    const h = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).formatToParts(now).find((p) => p.type === 'hour')!.value;
    return Number(h) % 24;
  } catch {
    return now.getUTCHours();
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Feb 29 birthday is celebrated on Feb 28 in non-leap years. */
function occurrence(dob: Date, year: number): Date {
  const month = dob.getUTCMonth();
  let day = dob.getUTCDate();
  if (month === 1 && day === 29) {
    const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
    if (!leap) day = 28;
  }
  return new Date(Date.UTC(year, month, day));
}

export interface BirthdayInfo {
  /** The birthday occurrence closest to today (this year's, or the neighbouring year's near new year). */
  date: Date;
  /** Year of that occurrence; identifies the greeting. */
  year: number;
  /** Days from today: 0 = today, negative = already passed. */
  daysAway: number;
  turningAge: number;
}

/** The birthday occurrence nearest to `today`, so a window around new year works both ways. */
export function nearestBirthday(dob: Date, today: Date): BirthdayInfo {
  const y = today.getUTCFullYear();
  const candidates = [y - 1, y, y + 1].map((year) => occurrence(dob, year));
  let best = candidates[1];
  for (const c of candidates) {
    if (Math.abs(c.getTime() - today.getTime()) < Math.abs(best.getTime() - today.getTime())) best = c;
  }
  const year = best.getUTCFullYear();
  return {
    date: best,
    year,
    daysAway: Math.round((best.getTime() - today.getTime()) / DAY_MS) || 0, // `|| 0` turns -0 into 0
    turningAge: year - dob.getUTCFullYear(),
  };
}

/** Students are children and youth; this keeps a bogus date of birth (an import default, a typo) from being celebrated. */
const MIN_BIRTHDAY_AGE = 2;
const MAX_BIRTHDAY_AGE = 30;

/** The nearest birthday, or null when the implied age is implausible. */
export function studentBirthdayWindow(dob: Date, today: Date): BirthdayInfo | null {
  const info = nearestBirthday(dob, today);
  return info.turningAge >= MIN_BIRTHDAY_AGE && info.turningAge <= MAX_BIRTHDAY_AGE ? info : null;
}
