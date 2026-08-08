import { describe, it, expect } from 'vitest'
import { getGreeting, getGreetingAr, getDayName, getDayNameAr } from './datetime'

describe('datetime helpers', () => {
  it('returns a known greeting for every hour', () => {
    ;[0, 6, 11, 12, 16, 17, 23].forEach((h) => {
      const g = getGreeting(h)
      expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(g)
    })
  })

  it('returns Arabic greetings', () => {
    expect(['صباح الخير', 'مساء الخير']).toContain(getGreetingAr(9))
    expect(['مساء الخير']).toContain(getGreetingAr(20))
  })

  it('formats a full date string', () => {
    const d = new Date(2026, 7, 7, 12, 0, 0)
    expect(getDayName('en-GB', d)).toMatch(/\d{4}/)
    expect(getDayNameAr('ar-EG', d)).toMatch(/٢٠٢٦|2026/)
  })
})
