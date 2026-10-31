import { describe, it, expect } from 'vitest'
import { buildBirthdayMessage, defaultBirthdayVariant, isPersonalAvailable } from '../birthday-message'

const base = { name: 'Mina', servantName: 'Mariam Samir', school: 'NiAngelos School', church: 'St Mark Church', sessionsAttended: 0, hymnsLearned: 0 }

describe('birthday-message', () => {
  it('signs every message with servant, school and church on separate lines', () => {
    for (const v of ['warm', 'blessing', 'personal', 'miss'] as const) {
      expect(buildBirthdayMessage(v, base).endsWith('\n\n— Mariam Samir\nNiAngelos School\nSt Mark Church')).toBe(true)
    }
  })

  it('warm greeting matches the agreed wording', () => {
    expect(buildBirthdayMessage('warm', base)).toBe(
      "Happy birthday, Mina! 🎂 Wishing you a blessed year. We can't wait to see you on Sunday.\n\n— Mariam Samir\nNiAngelos School\nSt Mark Church",
    )
  })

  it('personal uses real numbers with correct singular/plural', () => {
    expect(buildBirthdayMessage('personal', { ...base, hymnsLearned: 12, sessionsAttended: 40 })).toContain("you've learned 12 hymns and joined us for 40 sessions")
    expect(buildBirthdayMessage('personal', { ...base, hymnsLearned: 1, sessionsAttended: 1 })).toContain('learned 1 hymn and joined us for 1 session.')
    expect(buildBirthdayMessage('personal', { ...base, sessionsAttended: 5 })).toContain("you've joined us for 5 sessions")
  })

  it('personal falls back to the warm wording when there is nothing to celebrate', () => {
    expect(isPersonalAvailable(base)).toBe(false)
    expect(buildBirthdayMessage('personal', base)).toContain("Wishing you a blessed year")
  })

  it('picks "we miss you" only after 3 absent weeks', () => {
    expect(defaultBirthdayVariant(true)).toBe('miss')
    expect(defaultBirthdayVariant(false)).toBe('warm')
  })

  it('omits missing sign-off parts without leaving blank lines or stray dashes', () => {
    const msg = buildBirthdayMessage('warm', { ...base, servantName: '', church: '' })
    expect(msg.endsWith('\n\nNiAngelos School')).toBe(true)
    expect(msg).not.toMatch(/—\s*$/m)
    expect(buildBirthdayMessage('warm', { ...base, servantName: '', school: '', church: '' }).endsWith('Sunday.')).toBe(true)
  })
})
