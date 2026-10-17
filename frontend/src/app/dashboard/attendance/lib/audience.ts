export interface AudienceValue {
  allGroups: boolean
  groupIds: string[]
  levelId: string
  gradeId: string
  gender: string
}

export const EMPTY_AUDIENCE: AudienceValue = { allGroups: false, groupIds: [], levelId: '', gradeId: '', gender: '' }

/**
 * API payload for a liturgy/event audience. Level and gender narrow every selected
 * group; a grade belongs to one group, so it only applies when exactly one group is chosen.
 */
export function buildAudiencePayload(a: AudienceValue) {
  if (a.allGroups) {
    return { allGroups: true as const, targets: undefined }
  }
  const oneGroup = a.groupIds.length === 1
  return {
    allGroups: false as const,
    targets: a.groupIds.map(groupId => ({
      groupId,
      ...(a.levelId ? { levelId: a.levelId } : {}),
      ...(oneGroup && a.gradeId ? { gradeId: a.gradeId } : {}),
      ...(a.gender ? { gender: a.gender } : {}),
    })),
  }
}

/** Audience as the edit dialog should show it, from a session returned by the API. */
export function audienceFromSession(s: {
  allGroups?: boolean | null
  group?: { id: string } | null
  level?: { id: string } | null
  grade?: { id: string } | null
  targets?: Array<{ groupId: string; levelId?: string | null; gradeId?: string | null; gender?: string | null }> | null
}): AudienceValue {
  if (s.allGroups) return { ...EMPTY_AUDIENCE, allGroups: true }
  const targets = s.targets ?? []
  if (targets.length === 0) {
    return { ...EMPTY_AUDIENCE, groupIds: s.group?.id ? [s.group.id] : [], levelId: s.level?.id ?? '', gradeId: s.grade?.id ?? '' }
  }
  const first = targets[0]
  return {
    allGroups: false,
    groupIds: [...new Set(targets.map(t => t.groupId))],
    levelId: first.levelId ?? '',
    gradeId: targets.length === 1 ? first.gradeId ?? '' : '',
    gender: first.gender ?? '',
  }
}
