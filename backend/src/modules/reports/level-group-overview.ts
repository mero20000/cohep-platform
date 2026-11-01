import { rateOrNull } from '../attendance/attendance-metrics';

/** One row per level or group in the school-wide comparison. Rates are null (not 0) when nothing was recorded. */
export interface UnitRow {
  id: string;
  name: string;
  nameAr: string | null;
  students: number;
  /** Attendance over the window, class sessions only. */
  attendanceRate: number | null;
  /** The window just before, so leadership can see which way a class is moving. */
  prevAttendanceRate: number | null;
  atRisk: number;
  /** Share of graded assessments passed in the window. */
  passRate: number | null;
  gradedCount: number;
}

export interface OverviewInput {
  levels: { id: string; name: string; nameAr: string | null; orderIndex?: number }[];
  groups: { id: string; name: string; nameAr: string | null; orderIndex?: number }[];
  /** Active students only. */
  students: { id: string; levelId: string; groupId: string }[];
  /** Decided class attendance records from the last 2 windows. `current` = in the latest window. */
  records: { studentId: string; status: string; current: boolean }[];
  atRisk: Set<string>;
  /** Graded assessment results in the latest window. */
  grades: { studentId: string; passed: boolean }[];
}

type Counts = { present: number; late: number; absent: number };
const empty = (): Counts => ({ present: 0, late: 0, absent: 0 });

/** Pure: groups the school's students, attendance, risk and grades by level and by group. */
export function buildLevelGroupOverview(input: OverviewInput): { levels: UnitRow[]; groups: UnitRow[] } {
  const studentById = new Map(input.students.map((s) => [s.id, s]));

  const build = (units: OverviewInput['levels'], key: 'levelId' | 'groupId'): UnitRow[] => {
    const cur = new Map<string, Counts>();
    const prev = new Map<string, Counts>();
    const students = new Map<string, number>();
    const risk = new Map<string, number>();
    const graded = new Map<string, { n: number; passed: number }>();

    for (const s of input.students) {
      students.set(s[key], (students.get(s[key]) ?? 0) + 1);
      if (input.atRisk.has(s.id)) risk.set(s[key], (risk.get(s[key]) ?? 0) + 1);
    }
    for (const r of input.records) {
      const s = studentById.get(r.studentId);
      if (!s) continue;
      if (r.status !== 'present' && r.status !== 'late' && r.status !== 'absent') continue;
      const bucket = r.current ? cur : prev;
      const c = bucket.get(s[key]) ?? empty();
      c[r.status]++;
      bucket.set(s[key], c);
    }
    for (const g of input.grades) {
      const s = studentById.get(g.studentId);
      if (!s) continue;
      const e = graded.get(s[key]) ?? { n: 0, passed: 0 };
      e.n++;
      if (g.passed) e.passed++;
      graded.set(s[key], e);
    }

    return [...units]
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((u) => {
        const g = graded.get(u.id);
        return {
          id: u.id,
          name: u.name,
          nameAr: u.nameAr,
          students: students.get(u.id) ?? 0,
          attendanceRate: rateOrNull(cur.get(u.id) ?? empty()),
          prevAttendanceRate: rateOrNull(prev.get(u.id) ?? empty()),
          atRisk: risk.get(u.id) ?? 0,
          passRate: g && g.n > 0 ? Math.round((g.passed / g.n) * 100) : null,
          gradedCount: g?.n ?? 0,
        };
      });
  };

  return { levels: build(input.levels, 'levelId'), groups: build(input.groups, 'groupId') };
}
