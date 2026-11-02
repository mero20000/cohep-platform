import { describe, it, expect } from 'vitest'
import { buildPortalShareMessage, buildPortalWhatsAppUrl, portalUrl } from '../portal-share'

describe('portal-share', () => {
  it('builds each student\'s link from their own key and the configured origin', () => {
    expect(portalUrl('abc-123', 'https://app.example.org/')).toBe('https://app.example.org/student-portal/abc-123')
    expect(portalUrl('xyz-789', 'https://app.example.org')).toBe('https://app.example.org/student-portal/xyz-789')
  })

  it('uses the first name only and the student\'s own link, in English', () => {
    const msg = buildPortalShareMessage({ firstName: 'Malak', portalKey: 'k1', origin: 'https://x.org' })
    expect(msg.startsWith('Salam')).toBe(true)
    expect(msg).toContain('*Malak* has a personal Portal at NiAngelos School 🎶')
    expect(msg).toContain('Encourage *Malak* to log in every week')
    expect(msg).toContain('Open *Malak*’s NiAngelos Portal:\nhttps://x.org/student-portal/k1')
    expect(msg).toContain('This link is private')
    expect(msg).toContain('Please pray for the Church and Service')
    expect(msg).not.toMatch(/[؀-ۿ]/)
  })

  it('two students never share a link', () => {
    const a = buildPortalShareMessage({ firstName: 'Malak', portalKey: 'key-a', origin: 'https://x.org' })
    const b = buildPortalShareMessage({ firstName: 'John', portalKey: 'key-b', origin: 'https://x.org' })
    expect(a).toContain('/student-portal/key-a')
    expect(a).not.toContain('key-b')
    expect(b).toContain('/student-portal/key-b')
  })

  it('falls back to "your child" when there is no first name', () => {
    expect(buildPortalShareMessage({ firstName: '  ', portalKey: 'k', origin: 'https://x.org' })).toContain('*your child* has a personal Portal')
  })

  it('targets the parent chat for an international number', () => {
    expect(buildPortalWhatsAppUrl('+20 100 123 4567', 'hi there')).toBe('https://wa.me/201001234567?text=hi%20there')
  })

  it('falls back to the contact picker for a local number', () => {
    expect(buildPortalWhatsAppUrl('0100 123 4567', 'hi')).toBe('https://wa.me/?text=hi')
    expect(buildPortalWhatsAppUrl('', 'hi')).toBe('https://wa.me/?text=hi')
  })
})
