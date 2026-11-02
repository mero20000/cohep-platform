import { describe, it, expect } from 'vitest'
import { getTimezoneOptions, gmtOffsetLabel } from './timezones'

describe('timezones', () => {
  const winter = new Date('2026-01-15T12:00:00Z')
  const summer = new Date('2026-07-15T12:00:00Z')

  it('labels options as "Country (GMT+N)"', () => {
    const labels = getTimezoneOptions('en', undefined, winter).map((o) => o.label)
    expect(labels).toContain('United Arab Emirates (GMT+4)')
    expect(labels).toContain('India (GMT+5:30)')
    expect(labels).toContain('United States – Eastern (GMT-5)')
    expect(labels).toContain('United Kingdom (GMT)')
  })

  it('follows daylight saving', () => {
    expect(gmtOffsetLabel('Africa/Cairo', winter)).toBe('GMT+2')
    expect(gmtOffsetLabel('Africa/Cairo', summer)).toBe('GMT+3')
  })

  it('keeps every previously offered zone selectable', () => {
    const values = getTimezoneOptions('en').map((o) => o.value)
    for (const z of ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Africa/Cairo']) {
      expect(values).toContain(z)
    }
  })

  it('only uses zones the runtime recognises, with no duplicates', () => {
    const opts = getTimezoneOptions('en')
    expect(new Set(opts.map((o) => o.value)).size).toBe(opts.length)
    for (const o of opts) expect(gmtOffsetLabel(o.value)).not.toBeNull()
  })

  it('appends an unknown stored zone instead of dropping it', () => {
    const opts = getTimezoneOptions('en', 'Pacific/Fiji')
    expect(opts[opts.length - 1].value).toBe('Pacific/Fiji')
  })

  it('localises country names', () => {
    expect(getTimezoneOptions('ar').some((o) => o.label.includes('مصر'))).toBe(true)
  })
})
