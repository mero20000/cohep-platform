/**
 * Session types and audience ("target") helpers.
 *
 * A session is for one or more audience targets. Classes have exactly one
 * (mirroring the session's own group/level/grade columns, which stay the source
 * of truth for classes); liturgy and event sessions can have several, or cover
 * every group in the school. The roster is the union of the targets.
 */

export const SESSION_TYPES = ['class', 'liturgy', 'event'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export function isSessionType(value: unknown): value is SessionType {
  return typeof value === 'string' && (SESSION_TYPES as readonly string[]).includes(value);
}

export interface TargetInput {
  groupId: string;
  levelId?: string | null;
  gradeId?: string | null;
  gender?: string | null;
}

/** 'both' (and blank) mean "no gender restriction". */
export function normalizeGender(gender?: string | null): string | null {
  return gender && gender !== 'both' ? gender : null;
}

/** The single audience row that mirrors a class session's own columns. */
export function classTargetFor(
  session: { groupId?: string | null; levelId?: string | null; gradeId?: string | null },
  gender?: string | null,
): TargetInput | null {
  if (!session.groupId) return null;
  return {
    groupId: session.groupId,
    levelId: session.levelId ?? null,
    gradeId: session.gradeId ?? null,
    gender: normalizeGender(gender),
  };
}

/**
 * Prisma `student` where-fragments (to be OR-ed) selecting the roster of a
 * session. Classes, and any session without audience rows, use the session's
 * own group/level/grade columns exactly as before; sessions with audience rows
 * use the union of those rows; `allGroups` sessions cover the whole school.
 */
export function rosterFragments(
  session: { type?: string | null; groupId?: string | null; levelId?: string | null; gradeId?: string | null; allGroups?: boolean | null },
  targets: TargetInput[],
): Array<Record<string, any>> {
  if (session.allGroups) return [{}];
  if (session.type && session.type !== 'class' && targets.length > 0) {
    return targets.map(t => {
      const f: Record<string, any> = { groupId: t.groupId };
      if (t.levelId) f.levelId = t.levelId;
      if (t.gradeId) f.gradeId = t.gradeId;
      const g = normalizeGender(t.gender);
      if (g) f.gender = g;
      return f;
    });
  }
  const f: Record<string, any> = { groupId: session.groupId };
  if (session.levelId) f.levelId = session.levelId;
  if (session.gradeId) f.gradeId = session.gradeId;
  return [f];
}
