import { describe, it, expect } from 'vitest'
import { waitingDays, formatHours } from './types'

describe('waitingDays', () => {
  const now = new Date('2026-03-10T12:00:00Z').getTime()

  it('counts whole days since submission', () => {
    expect(waitingDays('2026-03-07T12:00:00Z', now)).toBe(3)
    expect(waitingDays('2026-03-09T13:00:00Z', now)).toBe(0)
  })

  it('never goes negative for a clock-skewed future timestamp', () => {
    expect(waitingDays('2026-03-11T12:00:00Z', now)).toBe(0)
  })
})

describe('formatHours', () => {
  it('shows hours under two days and days beyond', () => {
    expect(formatHours(10, 'en')).toBe('10 h')
    expect(formatHours(72, 'en')).toBe('3 d')
    expect(formatHours(60, 'en')).toBe('2.5 d')
  })

  it('handles missing data and Arabic', () => {
    expect(formatHours(null, 'en')).toBe('—')
    expect(formatHours(5, 'ar')).toBe('5 ساعة')
  })
})
