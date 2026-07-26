import { describe, it, expect } from 'vitest'
import { getSubjectStyle, toDateStr, formatDateFull, STATUS_BADGE } from './constants'

describe('getSubjectStyle', () => {
  it('returns Hymns style for Coptic Hymns', () => {
    const style = getSubjectStyle('Coptic Hymns')
    expect(style.label).toBe('Hymns')
    expect(style.bg).toBe('bg-amber-50')
  })

  it('returns Rites style for Coptic Rites', () => {
    const style = getSubjectStyle('Coptic Rites')
    expect(style.label).toBe('Rites')
  })

  it('returns Language style for Coptic Language', () => {
    const style = getSubjectStyle('Coptic Language')
    expect(style.label).toBe('Language')
  })

  it('falls back to Hymns for unknown subject', () => {
    const style = getSubjectStyle('Unknown Subject')
    expect(style.label).toBe('Hymns')
  })
})

describe('toDateStr', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2026, 0, 15)
    expect(toDateStr(date)).toBe('2026-01-15')
  })

  it('pads single-digit month and day', () => {
    const date = new Date(2026, 8, 5)
    expect(toDateStr(date)).toBe('2026-09-05')
  })
})

describe('formatDateFull', () => {
  it('formats with weekday and date', () => {
    const result = formatDateFull('2026-01-15')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
  })
})

describe('STATUS_BADGE', () => {
  it('maps statuses correctly', () => {
    expect(STATUS_BADGE.published).toBe('success')
    expect(STATUS_BADGE.archived).toBe('danger')
    expect(STATUS_BADGE.draft).toBe('default')
  })
})
