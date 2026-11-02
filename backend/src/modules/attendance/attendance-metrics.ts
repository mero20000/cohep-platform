/**
 * Single source of truth for attendance numbers shown across the platform
 * (Insights, dashboards, reports, parent portal).
 *
 * Rate = (present + late) / (present + late + absent).
 * `excused` and `unmarked` are neutral: an excused absence is not a miss, and an
 * unmarked row means the roll has not been taken yet — neither belongs in the
 * denominator.
 */

type StatusCarrier = { status: string };

export interface StatusCounts {
  present?: number;
  late?: number;
  absent?: number;
}

/** Percentage 0–100 (rounded) from raw counts; 0 when nothing was decided. */
export function rateFromCounts({ present = 0, late = 0, absent = 0 }: StatusCounts): number {
  const decided = present + late + absent;
  return decided > 0 ? Math.round(((present + late) / decided) * 100) : 0;
}

/** Same as rateFromCounts but with 2-decimal precision (used by Insights cards). */
export function preciseRateFromCounts({ present = 0, late = 0, absent = 0 }: StatusCounts): number {
  const decided = present + late + absent;
  return decided > 0 ? Math.round(((present + late) / decided) * 10000) / 100 : 0;
}

export function attendanceRate(records: StatusCarrier[]): number {
  let present = 0, late = 0, absent = 0;
  for (const r of records) {
    if (r.status === 'present') present++;
    else if (r.status === 'late') late++;
    else if (r.status === 'absent') absent++;
  }
  return rateFromCounts({ present, late, absent });
}

/**
 * Prisma `where` fragment for regular class sessions: liturgy sessions are
 * tracked separately and must not dilute class attendance rates.
 */
export const CLASS_SESSION_FILTER = {
  type: 'class',
  // Legacy guard: liturgy sessions were once identified only by their notes.
  OR: [{ notes: null }, { notes: { not: 'liturgy' } }],
};

/**
 * Like rateFromCounts, but null when no roll was decided at all. A rate of 0% means "everyone who was marked
 * was absent"; null means "nothing to measure" (no class this period). Dashboards must show them differently.
 */
export function rateOrNull({ present = 0, late = 0, absent = 0 }: StatusCounts): number | null {
  const decided = present + late + absent;
  return decided > 0 ? Math.round(((present + late) / decided) * 100) : null;
}

export interface TrendRecord {
  status: string;
  date: Date | string;
}

export interface TrendPoint {
  /** First day of the 7-day window, YYYY-MM-DD (server-local calendar day). */
  weekStart: string;
  rate: number | null;
  decided: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Attendance rate per rolling 7-day window, oldest first. Window 0 is the 7 days ending today (inclusive),
 * window 1 the 7 days before that, and so on. Rolling windows (rather than calendar weeks) mean the newest
 * point always matches the dashboard's "last 7 days" headline. Records outside the range or in the future
 * are ignored.
 */
export function weeklyRateTrend(records: TrendRecord[], now: Date = new Date(), weeks = 8): TrendPoint[] {
  const today = startOfDay(now);
  const buckets = Array.from({ length: weeks }, () => ({ present: 0, late: 0, absent: 0 }));

  for (const r of records) {
    const daysAgo = Math.round((today.getTime() - startOfDay(new Date(r.date)).getTime()) / DAY_MS);
    if (daysAgo < 0) continue;
    const k = Math.floor(daysAgo / 7);
    if (k >= weeks) continue;
    if (r.status === 'present') buckets[k].present++;
    else if (r.status === 'late') buckets[k].late++;
    else if (r.status === 'absent') buckets[k].absent++;
  }

  return buckets
    .map((counts, k) => {
      const start = new Date(today.getTime() - (k * 7 + 6) * DAY_MS);
      return { weekStart: isoDay(start), rate: rateOrNull(counts), decided: counts.present + counts.late + counts.absent };
    })
    .reverse();
}
