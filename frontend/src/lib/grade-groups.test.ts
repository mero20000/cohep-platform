import { describe, it, expect } from 'vitest'
import {
  type GradeGroupCombo,
  type GroupLike,
  activeCombosForLevel,
  gradeOptionsForLevel,
  resolveGroupId,
  findGroupToReuse,
  upsertCombo,
  removeCombo,
  validateCombo,
} from './grade-groups'

const combo = (id: string, levelId: string, gradeName: string, groupName: string, status: 'active' | 'inactive' = 'active'): GradeGroupCombo =>
  ({ id, levelId, gradeName, groupId: `grp-${id}`, groupName, status })

const group = (id: string, name: string, levelId: string): GroupLike =>
  ({ id, name, levelId })

const L1 = 'level-1'
const L2 = 'level-2'

const baseCombos: GradeGroupCombo[] = [
  combo('c1', L1, 'Grade 4', 'Group 1'),
  combo('c2', L1, 'Grade 5', 'Group 1'),
  combo('c3', L2, 'Grade 6', 'Group 2'),
  combo('c4', L2, 'Grade 7', 'Group 2', 'inactive'),
]

describe('activeCombosForLevel', () => {
  it('returns only active combos for the given level', () => {
    expect(activeCombosForLevel(baseCombos, L1).map(c => c.gradeName)).toEqual(['Grade 4', 'Grade 5'])
  })

  it('excludes inactive combos', () => {
    expect(activeCombosForLevel(baseCombos, L2).map(c => c.gradeName)).toEqual(['Grade 6'])
  })

  it('returns empty array for level with no combos', () => {
    expect(activeCombosForLevel(baseCombos, 'level-99')).toEqual([])
  })
})

describe('gradeOptionsForLevel', () => {
  it('returns grade names of active combos for the level', () => {
    expect(gradeOptionsForLevel(baseCombos, L1)).toEqual(['Grade 4', 'Grade 5'])
  })
})

describe('resolveGroupId', () => {
  it('returns groupId of active combo matching level + grade', () => {
    expect(resolveGroupId(baseCombos, L1, 'Grade 4')).toBe('grp-c1')
  })

  it('returns undefined for inactive combo', () => {
    expect(resolveGroupId(baseCombos, L2, 'Grade 7')).toBeUndefined()
  })

  it('returns undefined when grade not mapped for level', () => {
    expect(resolveGroupId(baseCombos, L1, 'Grade 10')).toBeUndefined()
  })

  it('matches grade names case-insensitively', () => {
    expect(resolveGroupId(baseCombos, L1, 'grade 4')).toBe('grp-c1')
  })
})

describe('findGroupToReuse', () => {
  const groups = [group('g1', 'Group 1', L1), group('g2', 'Group 2', L1), group('g3', 'Group 1', L2)]

  it('reuses group with same name under same level (case-insensitive)', () => {
    expect(findGroupToReuse(groups, L1, 'group 1')).toBe('g1')
  })

  it('ignores same name in a different level', () => {
    expect(findGroupToReuse(groups, L1, 'Group 1')).toBe('g1')
    expect(findGroupToReuse(groups, L2, 'Group 1')).toBe('g3')
  })

  it('returns undefined when no group matches', () => {
    expect(findGroupToReuse(groups, L1, 'Group 99')).toBeUndefined()
  })

  it('returns undefined for empty groups', () => {
    expect(findGroupToReuse([], L1, 'Group 1')).toBeUndefined()
  })
})

describe('upsertCombo', () => {
  it('adds a new combo when (levelId, gradeName) does not exist', () => {
    const next = upsertCombo([], combo('x', L1, 'Grade 8', 'Group 3'))
    expect(next).toHaveLength(1)
    expect(next[0].gradeName).toBe('Grade 8')
  })

  it('replaces existing combo with same (levelId, gradeName)', () => {
    const updated = { ...combo('c1', L1, 'Grade 4', 'Group 9'), id: 'c1', groupId: 'grp-new' }
    const next = upsertCombo(baseCombos, updated)
    expect(next).toHaveLength(4)
    const found = next.find(c => c.id === 'c1')
    expect(found?.groupName).toBe('Group 9')
    expect(found?.groupId).toBe('grp-new')
  })

  it('does not mutate the input array', () => {
    const before = baseCombos.length
    upsertCombo(baseCombos, combo('x', L1, 'Grade 8', 'Group 3'))
    expect(baseCombos).toHaveLength(before)
  })
})

describe('removeCombo', () => {
  it('removes the combo with the given id', () => {
    const next = removeCombo(baseCombos, 'c2')
    expect(next.map(c => c.id)).toEqual(['c1', 'c3', 'c4'])
  })

  it('returns same array length when id not found', () => {
    const next = removeCombo(baseCombos, 'missing')
    expect(next).toHaveLength(4)
  })
})

describe('validateCombo', () => {
  it('accepts a combo with unique grade and group in level', () => {
    expect(validateCombo(baseCombos, combo('x', L1, 'Grade 8', 'Group 3')).ok).toBe(true)
  })

  it('rejects duplicate gradeName within the same level', () => {
    const res = validateCombo(baseCombos, combo('x', L1, 'Grade 4', 'Group 9'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/grade/i)
  })

  it('rejects duplicate groupName within the same level', () => {
    const res = validateCombo(baseCombos, combo('x', L2, 'Grade 9', 'Group 2'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/group/i)
  })

  it('allows same grade name in different levels', () => {
    expect(validateCombo(baseCombos, combo('x', L2, 'Grade 4', 'Group 9')).ok).toBe(true)
  })
})
