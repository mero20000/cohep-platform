/**
 * One definition of "a student's record for an assessment", shared by every read and write.
 *
 * A student has exactly one LIVE record per assessment. Rows are not live when they are:
 *  - archived ('superseded'): prior re-take attempts, merged duplicates, admin-discarded work
 *  - side records ('parent_report'): a parent's home-practice score; evidence, not the assignment
 *
 * Reads used to disagree on which row to show (newest wins here, oldest wins there), which is how
 * one assessment appeared both "done" and "pending". Everything now goes through pickLive.
 */

/** Prisma where-fragment selecting only rows that take part in the assessment lifecycle. */
export const LIFECYCLE_WHERE = {
  status: { not: 'superseded' },
  submissionType: { not: 'parent_report' },
} as const;

const STATUS_RANK: Record<string, number> = { completed: 4, submitted: 3, assigned: 2 };

export interface LiveCandidate {
  id: string;
  status: string;
  attemptNumber: number;
  createdAt: Date | string;
}

/** Positive when `a` should be preferred over `b` as the live record. */
export function compareLive(a: LiveCandidate, b: LiveCandidate): number {
  if (a.attemptNumber !== b.attemptNumber) return a.attemptNumber - b.attemptNumber;
  const ra = STATUS_RANK[a.status] ?? 0;
  const rb = STATUS_RANK[b.status] ?? 0;
  if (ra !== rb) return ra - rb;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/** The record that stands for the student on this assessment: latest attempt, then furthest along, then newest. */
export function pickLive<T extends LiveCandidate>(rows: T[]): T | undefined {
  let best: T | undefined;
  for (const r of rows) {
    if (!best || compareLive(r, best) > 0) best = r;
  }
  return best;
}

/** Group rows by a key and keep the live record of each group. */
export function liveByKey<T extends LiveCandidate>(rows: T[], keyOf: (r: T) => string): Map<string, T> {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  const out = new Map<string, T>();
  groups.forEach((g, k) => out.set(k, pickLive(g)!));
  return out;
}

export type AssessmentGender = 'all' | 'male' | 'female';

/** Who an assessment is for. Stored in metadata like grade and term; absent means everyone. */
export function assessmentGender(metadata: unknown): AssessmentGender {
  const g = ((metadata as { gender?: unknown } | null) || {}).gender;
  return g === 'male' || g === 'female' ? g : 'all';
}

type StudentFacts = { levelId: string | null; groupId: string | null; gender?: string | null };
type AssessmentFacts = { levelId: string; groupId: string | null; gender?: AssessmentGender | null };

/**
 * Why a student is not meant for this assessment, or null when they are. It must be in the
 * student's level, in their group when the assessment is group-specific, and for their gender
 * when the assessment is limited to boys or girls. Used to refuse stray assignments and to find
 * stale ones left behind by old test data, a change of group or an edited audience.
 */
export function ineligibleReason(student: StudentFacts, assessment: AssessmentFacts): 'level' | 'group' | 'gender' | null {
  if (student.levelId !== assessment.levelId) return 'level';
  if (assessment.groupId && student.groupId !== assessment.groupId) return 'group';
  if (assessment.gender && assessment.gender !== 'all' && student.gender !== assessment.gender) return 'gender';
  return null;
}

export function isEligible(student: StudentFacts, assessment: AssessmentFacts): boolean {
  return ineligibleReason(student, assessment) === null;
}

/**
 * The mark of a record. The overall grade (no question) wins when a marker has set one;
 * otherwise it is the sum of the per-question grades. Summing both double-counts, since a
 * marked submission carries per-question grades AND an overall grade.
 */
export function scoreOf(
  grades: { questionId?: string | null; score: unknown; maxScore: unknown }[],
): { score: number; maxScore: number } | null {
  if (!grades.length) return null;
  const num = (v: unknown) => (v == null ? 0 : typeof v === 'number' ? v : Number((v as { toString(): string }).toString()));
  const overall = grades.find((g) => g.questionId == null);
  if (overall) return { score: num(overall.score), maxScore: num(overall.maxScore) };
  return {
    score: grades.reduce((n, g) => n + num(g.score), 0),
    maxScore: grades.reduce((n, g) => n + num(g.maxScore), 0),
  };
}
