import { CLASS_SESSION_FILTER, TrendPoint, weeklyRateTrend } from './attendance-metrics';

/** Minimal slice of PrismaService this needs, so tests can stub it. */
export interface TrendPrisma {
  attendanceRecord: { findMany: (args: any) => Promise<any[]> };
}

/**
 * The school's attendance rate per rolling 7-day window (oldest first, newest = the last 7 days), from ONE
 * query. The dashboard headline and the Priest Pulse both read from here, so the two screens can never
 * disagree about "this week".
 */
export async function loadAttendanceTrend(
  prisma: TrendPrisma,
  schoolId: string,
  weeks = 8,
  now: Date = new Date(),
): Promise<TrendPoint[]> {
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (weeks * 7 - 1));

  const rows = await prisma.attendanceRecord.findMany({
    where: {
      status: { in: ['present', 'late', 'absent'] },
      student: { deletedAt: null },
      attendanceSession: { schoolId, deletedAt: null, scheduledDate: { gte: since }, AND: [CLASS_SESSION_FILTER] },
    },
    select: { status: true, attendanceSession: { select: { scheduledDate: true } } },
  });

  return weeklyRateTrend(
    rows.map((r) => ({ status: r.status, date: r.attendanceSession.scheduledDate })),
    now,
    weeks,
  );
}
