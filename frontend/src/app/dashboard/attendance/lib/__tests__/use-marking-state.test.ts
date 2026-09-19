import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarkingState } from '../use-marking-state'

const records = [
  { student: { id: 's1' }, status: 'present', behavior: 3, participation: 4, attendedLiturgy: true, note: 'hi' },
  { student: { id: 's2' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' },
] as any

describe('useMarkingState', () => {
  it('inits from records and builds save payload skipping unmarked', () => {
    const { result } = renderHook(() => useMarkingState(records))
    expect(result.current.marks['s1']).toBe('present')
    expect(result.current.dirty).toBe(false)
    act(() => result.current.setStatus('s2', 'late'))
    expect(result.current.dirty).toBe(true)
    const payload = result.current.buildSavePayload('u1')
    expect(payload).toEqual([
      { studentId: 's1', status: 'present', behavior: 3, participation: 4, attendedLiturgy: true, note: 'hi' },
      { studentId: 's2', status: 'late', behavior: 0, participation: 0, attendedLiturgy: false, note: undefined },
    ])
  })
})
