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
  OR: [{ notes: null }, { notes: { not: 'liturgy' } }],
};
