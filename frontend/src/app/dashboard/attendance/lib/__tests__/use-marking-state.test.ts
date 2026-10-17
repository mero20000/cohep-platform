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
      { studentId: 's1', status: 'present', behavior: 3, participation: 4, note: 'hi' },
      { studentId: 's2', status: 'late', behavior: 0, participation: 0, note: null },
    ])
  })

  it('sends an explicit unmarked (and null note) when a saved mark is undone', () => {
    const { result } = renderHook(() => useMarkingState(records))
    act(() => result.current.initFromRecords(records))
    act(() => { result.current.setStatus('s1', 'present'); result.current.setNote('s1', '') })
    const payload = result.current.buildSavePayload('u1')
    expect(payload).toEqual([
      { studentId: 's1', status: 'unmarked', behavior: 3, participation: 4, note: null },
    ])
  })

  it('does not send never-marked students that stay unmarked', () => {
    const { result } = renderHook(() => useMarkingState(records))
    act(() => result.current.initFromRecords(records))
    expect(result.current.buildSavePayload('u1').map(r => r.studentId)).toEqual(['s1'])
  })
  it('never sends attendedLiturgy, so saving a class cannot overwrite historic liturgy flags', () => {
    const { result } = renderHook(() => useMarkingState(records))
    act(() => result.current.setStatus('s2', 'present'))
    expect(result.current.buildSavePayload('u1').every(r => !('attendedLiturgy' in r))).toBe(true)
  })

  it('markAll on a subset keeps the other students\' marks', () => {
    const { result } = renderHook(() => useMarkingState(records))
    act(() => result.current.markAll('absent', ['s2']))
    expect(result.current.marks).toEqual({ s1: 'present', s2: 'absent' })
  })
})
