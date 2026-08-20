import { describe, it, expect } from 'vitest'
import { buildGroupOptions } from './group-options'
import type { Group, Allocation } from './types'

const activeGroup = (id: string, name: string, orderIndex: number, nameAr?: string): Group =>
  ({ id, name, nameAr, status: 'active', orderIndex } as Group)

describe('buildGroupOptions', () => {
  it('lists every active group without deduplication (A and B groups both appear)', () => {
    const groups: Group[] = [
      activeGroup('1a', 'Group 1A', 5),
      activeGroup('2a', 'Group 2A', 6),
      activeGroup('1b', 'Group 1B', 17),
      activeGroup('2b', 'Group 2B', 18),
    ]
    const opts = buildGroupOptions(groups, [])
    expect(opts.map(o => o.label)).toEqual(['Group 1A', 'Group 2A', 'Group 1B', 'Group 2B'])
    // Both A and B map to the same groupNumber but remain separate options.
    expect(opts.filter(o => o.groupNumber === 1)).toHaveLength(2)
    expect(opts.map(o => o.id)).toEqual(['1a', '2a', '1b', '2b'])
  })

  it('excludes inactive groups and groups without a numeric name prefix', () => {
    const groups: Group[] = [
      activeGroup('g1', 'Group 1A', 5),
      { id: 'g2', name: 'Group 2A', status: 'inactive', orderIndex: 6 } as Group,
      { id: 'g3', name: 'QA Team', status: 'active', orderIndex: 7 } as Group,
    ]
    const opts = buildGroupOptions(groups, [])
    expect(opts.map(o => o.label)).toEqual(['Group 1A'])
  })

  it('falls back to allocation groupNumbers when no active group carries a number', () => {
    const groups: Group[] = [{ id: 'g1', name: 'Sunday Group', status: 'active', orderIndex: 1 } as Group]
    const allocations = [{ groupNumber: 1 }, { groupNumber: 3 }] as Allocation[]
    const opts = buildGroupOptions(groups, allocations)
    expect(opts.map(o => o.groupNumber)).toEqual([1, 3])
  })
})