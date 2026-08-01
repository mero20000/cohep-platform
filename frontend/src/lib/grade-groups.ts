export interface GradeGroupCombo {
  id: string
  levelId: string
  gradeName: string
  groupId: string
  groupName: string
  status: 'active' | 'inactive'
}

export interface GroupLike {
  id: string
  name: string
  levelId: string
  status?: string
}

export const GRADE_GROUPS_KEY = 'gradeGroups'

export function activeCombosForLevel(combos: GradeGroupCombo[], levelId: string): GradeGroupCombo[] {
  return combos.filter(c => c.levelId === levelId && c.status === 'active')
}

export function gradeOptionsForLevel(combos: GradeGroupCombo[], levelId: string): string[] {
  return activeCombosForLevel(combos, levelId).map(c => c.gradeName)
}

export function resolveGroupId(combos: GradeGroupCombo[], levelId: string, gradeName: string): string | undefined {
  const name = gradeName.trim().toLowerCase()
  const match = activeCombosForLevel(combos, levelId).find(c => c.gradeName.trim().toLowerCase() === name)
  return match?.groupId
}

export function findGroupToReuse(groups: GroupLike[], levelId: string, groupName: string): string | undefined {
  const name = groupName.trim().toLowerCase()
  return groups.find(g => g.levelId === levelId && g.name.trim().toLowerCase() === name)?.id
}

export function upsertCombo(combos: GradeGroupCombo[], combo: GradeGroupCombo): GradeGroupCombo[] {
  const idx = combos.findIndex(c => c.levelId === combo.levelId && c.gradeName.trim().toLowerCase() === combo.gradeName.trim().toLowerCase())
  if (idx === -1) return [...combos, combo]
  const next = [...combos]
  next[idx] = combo
  return next
}

export function removeCombo(combos: GradeGroupCombo[], comboId: string): GradeGroupCombo[] {
  return combos.filter(c => c.id !== comboId)
}

export function validateCombo(combos: GradeGroupCombo[], combo: GradeGroupCombo): { ok: true } | { ok: false; error: string } {
  const sameLevel = combos.filter(c => c.levelId === combo.levelId && c.id !== combo.id)
  if (sameLevel.some(c => c.gradeName.trim().toLowerCase() === combo.gradeName.trim().toLowerCase())) {
    return { ok: false, error: 'A grade with this name already exists in this level' }
  }
  if (sameLevel.some(c => c.groupName.trim().toLowerCase() === combo.groupName.trim().toLowerCase())) {
    return { ok: false, error: 'A group with this name already exists in this level' }
  }
  return { ok: true }
}
