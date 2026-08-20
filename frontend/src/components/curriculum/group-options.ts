import type { Group, Allocation } from './types'

export interface GroupOption {
  id: string
  groupNumber: number
  label: string
  labelAr: string
}

// Builds the group dropdown options for the curriculum module from the school's
// active groups (Settings → Groups). Each active group is listed (no dedup), mapped
// to a CurriculumAllocation groupNumber via the leading integer in its name (e.g.
// "Group 1A" and "Group 1B" both map to 1 but both remain visible). Sorted by orderIndex.
export function buildGroupOptions(groups: Group[], allocations: Allocation[]): GroupOption[] {
  const active = groups
    .filter(g => g.status === 'active')
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))

  const opts: GroupOption[] = []
  for (const g of active) {
    const m = /^Group\s*(\d+)/i.exec(g.name) || /^(\d+)/.exec(g.name)
    if (!m) continue
    opts.push({ id: g.id, groupNumber: parseInt(m[1], 10), label: g.name, labelAr: g.nameAr || g.name })
  }

  // Fallback: if no active group name carries a leading number, show the distinct
  // group numbers actually present in the current allocations.
  if (opts.length === 0) {
    const nums = [...new Set(allocations.map(a => a.groupNumber).filter((n): n is number => typeof n === 'number'))].sort((a, b) => a - b)
    return nums.map(n => ({ id: `g${n}`, groupNumber: n, label: `Group ${n}`, labelAr: `المجموعة ${n}` }))
  }

  return opts
}