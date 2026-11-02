/**
 * The Priest Pulse "school health score", with its working shown.
 *
 * It used to be a single opaque number. Now every point is accounted for, so leadership can see WHY the
 * score is what it is. Weights are unchanged (they add up to 100):
 *   attendance 50 · grading backlog 20 · students at risk 20 · home practice 10
 *
 * A week with no class has no attendance rate. Rather than score that as a 0 (which would punish a school for
 * a holiday), attendance is left out and the other components are scaled to 100.
 */
export interface HealthInput {
  /** Last-7-days attendance %, or null when no roll was taken. */
  attendanceRate: number | null;
  pendingGrading: number;
  studentsAtRisk: number;
  familiesPracticedThisWeek: number;
}

export interface HealthComponent {
  key: 'attendance' | 'grading' | 'atRisk' | 'homePractice';
  labelEn: string;
  labelAr: string;
  points: number;
  max: number;
  /** False when there was nothing to measure (and the component is excluded from the score). */
  counted: boolean;
  detailEn: string;
  detailAr: string;
}

export interface HealthResult {
  score: number;
  components: HealthComponent[];
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function computeHealthScore(input: HealthInput): HealthResult {
  const { attendanceRate, pendingGrading, studentsAtRisk, familiesPracticedThisWeek } = input;

  const attendance: HealthComponent = {
    key: 'attendance',
    labelEn: 'Attendance',
    labelAr: 'الحضور',
    points: attendanceRate === null ? 0 : Math.round(attendanceRate * 0.5),
    max: 50,
    counted: attendanceRate !== null,
    detailEn: attendanceRate === null ? 'No class in the last 7 days, so not counted' : `${attendanceRate}% in the last 7 days`,
    detailAr: attendanceRate === null ? 'لا حصص في آخر 7 أيام، فلا تُحتسب' : `${attendanceRate}٪ في آخر 7 أيام`,
  };

  const grading: HealthComponent = {
    key: 'grading',
    labelEn: 'Grading backlog',
    labelAr: 'تقييمات معلقة',
    points: pendingGrading === 0 ? 20 : Math.max(0, 20 - pendingGrading * 2),
    max: 20,
    counted: true,
    detailEn: pendingGrading === 0 ? 'Nothing waiting' : `${pendingGrading} waiting (−2 each)`,
    detailAr: pendingGrading === 0 ? 'لا شيء ينتظر' : `${pendingGrading} بانتظار التصحيح (−2 لكل واحد)`,
  };

  const atRisk: HealthComponent = {
    key: 'atRisk',
    labelEn: 'Students at risk',
    labelAr: 'طلاب في خطر',
    points: studentsAtRisk === 0 ? 20 : Math.max(0, 20 - studentsAtRisk * 4),
    max: 20,
    counted: true,
    detailEn: studentsAtRisk === 0 ? 'No one has missed 3 sessions in a row' : `${studentsAtRisk} ${plural(studentsAtRisk, 'student', 'students')} (−4 each)`,
    detailAr: studentsAtRisk === 0 ? 'لا أحد غاب 3 جلسات متتالية' : `${studentsAtRisk} من الطلاب (−4 لكل طالب)`,
  };

  const homePractice: HealthComponent = {
    key: 'homePractice',
    labelEn: 'Home practice',
    labelAr: 'الممارسة المنزلية',
    points: familiesPracticedThisWeek > 0 ? 10 : 0,
    max: 10,
    counted: true,
    detailEn: familiesPracticedThisWeek > 0 ? `${familiesPracticedThisWeek} ${plural(familiesPracticedThisWeek, 'family', 'families')} practised (full marks if any)` : 'No family practised this week',
    detailAr: familiesPracticedThisWeek > 0 ? `${familiesPracticedThisWeek} عائلة مارست (الدرجة كاملة إن مارست أي عائلة)` : 'لم تمارس أي عائلة هذا الأسبوع',
  };

  const components = [attendance, grading, atRisk, homePractice];
  const earned = components.filter((c) => c.counted).reduce((a, c) => a + c.points, 0);
  const possible = components.filter((c) => c.counted).reduce((a, c) => a + c.max, 0);
  const score = possible > 0 ? Math.min(100, Math.round((earned / possible) * 100)) : 0;
  return { score, components };
}
