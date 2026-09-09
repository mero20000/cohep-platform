import { describe, it, expect } from 'vitest'
import { buildMarkRedirect } from '../page'

describe('attendance redirect', () => {
  it('preserves sessionId query', () => {
    expect(buildMarkRedirect({ sessionId: 'sess-1', prefill: 'present' })).toBe(
      '/dashboard/attendance/mark?sessionId=sess-1&prefill=present',
    )
  })

  it('preserves sessionId, prefill and subjectItemId deep-link query', () => {
    expect(
      buildMarkRedirect({ sessionId: 'sess-1', prefill: 'present', subjectItemId: 'item-9' }),
    ).toBe(
      '/dashboard/attendance/mark?sessionId=sess-1&prefill=present&subjectItemId=item-9',
    )
  })

  it('redirects without query when no params', () => {
    expect(buildMarkRedirect({})).toBe('/dashboard/attendance/mark')
    expect(buildMarkRedirect()).toBe('/dashboard/attendance/mark')
  })
})
