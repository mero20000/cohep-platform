import { CLASS_SESSION_FILTER } from './attendance-metrics';

/**
 * The one definition of "at risk" used across the platform (Priest Pulse, dashboard, servant digest and the
 * students-list filter): an ACTIVE student whose most recent decided class records are all absences, for at
 * least AT_RISK_STREAK sessions in a row.
 *
 * Why it is this strict:
 * - class sessions only: liturgy and events are tracked separately and must not count toward class risk
 * - decided statuses only (present / late / absent): excused is not a miss and unmarked means the roll has not
 *   been taken, so neither extends nor breaks a streak
 * - ordered by the session's own date, not by when the record row happened to be created
 *
 * It matches the rule that triggers the absence alert to servants, so the number leadership sees and the alerts
 * servants receive agree.
 */
export const AT_RISK_STREAK = 3;

/** How far back to look. A streak is the newest run of absences, so older history cannot change it. */
export const RISK_LOOKBACK_DAYS = 12 * 7;

export interface DecidedRecord {
  studentId: string;
  status: string;
  sessionDate: Date | string;
}

/**
 * Pure: from decided class records (any order, any students) returns, for every student whose newest records
 * are an unbroken run of at least `minStreak` absences, the length of that run.
 */
export function trailingAbsenceStreaks(records: DecidedRecord[], minStreak = AT_RISK_STREAK): Map<string, number> {
  const byStudent = new Map<string, DecidedRecord[]>();
  for (const r of records) {
    if (r.status !== 'present' && r.status !== 'late' && r.status !== 'absent') continue;
    const list = byStudent.get(r.studentId);
    if (list) list.push(r);
    else byStudent.set(r.studentId, [r]);
  }

  const result = new Map<string, number>();
  for (const [studentId, list] of byStudent) {
    list.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
    let streak = 0;
    for (const r of list) {
      if (r.status !== 'absent') break;
      streak++;
    }
    if (streak >= minStreak) result.set(studentId, streak);
  }
  return result;
}

/** Minimal slice of PrismaService this needs, so tests can stub it. */
export interface RiskPrisma {
  attendanceRecord: { findMany: (args: any) => Promise<any[]> };
}

/**
 * One bounded query for the whole school (no per-student loop): decided class records for active students in
 * the lookback window. Returns studentId -> current absence streak for students at risk.
 */
export async function findAtRiskStudents(
  prisma: RiskPrisma,
  schoolId: string,
  opts: { now?: Date; minStreak?: number } = {},
): Promise<Map<string, number>> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - RISK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const rows = await prisma.attendanceRecord.findMany({
    where: {
      status: { in: ['present', 'late', 'absent'] },
      student: { schoolId, deletedAt: null, status: 'active' },
      attendanceSession: { schoolId, deletedAt: null, scheduledDate: { gte: since, lte: now }, AND: [CLASS_SESSION_FILTER] },
    },
    select: { studentId: true, status: true, attendanceSession: { select: { scheduledDate: true } } },
  });

  return trailingAbsenceStreaks(
    rows.map((r) => ({ studentId: r.studentId, status: r.status, sessionDate: r.attendanceSession.scheduledDate })),
    opts.minStreak ?? AT_RISK_STREAK,
  );
}
