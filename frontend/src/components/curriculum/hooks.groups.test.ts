import { describe, it, expect } from 'vitest'
import { flattenGroups } from './hooks'
import type { Group } from './types'

describe('flattenGroups', () => {
  it('drops levels that omit or null their groups field (backend returns sparse groups)', () => {
    const data = [
      { levelId: 'a', groups: [{ name: 'Group 1A' }] },
      { levelId: 'b' },
      { levelId: 'c', groups: null },
      { levelId: 'd' },
    ]
    const groups = flattenGroups(data)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Group 1A')
    expect(groups.every((g) => g != null)).toBe(true)
  })

  it('flattens groups from levels that do have the field', () => {
    const data = [
      { levelId: 'a', groups: [{ name: 'Group 1A' }, { name: 'Group 2A' }] },
      { levelId: 'b', groups: [] },
    ]
    const groups: Group[] = flattenGroups(data)
    expect(groups.map((g) => g.name)).toEqual(['Group 1A', 'Group 2A'])
  })
})