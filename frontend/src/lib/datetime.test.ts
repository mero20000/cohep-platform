import { describe, it, expect } from 'vitest'
import { getGreeting, getGreetingAr, getDayName, getDayNameAr, getCopticDate, getFullDay } from './datetime'

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

  describe('Coptic calendar', () => {
    const cases: Array<[string, number, number, number]> = [
      ['2026-08-17', 12, 11, 1742], // 11 Mesori 1742
      ['2026-09-11', 1, 1, 1743],   // 1 Thout 1743 (Nayrouz)
      ['2026-06-06', 9, 29, 1742],  // 29 Pashons 1742
      ['2026-09-06', 13, 1, 1742],  // 1 Pi Kogi Enavot 1742 (epagomenal month)
    ]
    it.each(cases)('converts %s to Coptic month %i day %i year %i', (iso, month, day, year) => {
      const [yy, mm, dd] = iso.split('-').map(Number)
      const res = getCopticDate(new Date(yy, mm - 1, dd, 12, 0, 0))
      expect(res).toEqual({ day, month, year })
    })

    it('formats the combined bilingual day with the Coptic fragment', () => {
      const d = new Date(2026, 7, 17, 12, 0, 0)
      const en = getFullDay('en', d)
      expect(en).toContain('17 August 2026')
      expect(en).toContain('11 Mesori 1742 AM')
      const ar = getFullDay('ar', d)
      expect(ar).toContain('مسرى')
      expect(ar).toContain('للشهداء')
    })
  })
})
