import { describe, it, expect } from 'vitest'
import { buildPortalShareMessage, buildPortalWhatsAppUrl, portalUrl } from '../portal-share'

describe('portal-share', () => {
  it('builds the portal url from origin and key', () => {
    expect(portalUrl('abc-123', 'https://app.example.org/')).toBe('https://app.example.org/student-portal/abc-123')
  })

  it('includes the student name and link in both languages', () => {
    const msg = buildPortalShareMessage({ studentName: 'Mina Samir', portalKey: 'k1', origin: 'https://x.org' })
    expect(msg).toContain('Mina Samir')
    expect(msg.match(/https:\/\/x\.org\/student-portal\/k1/g)).toHaveLength(2)
    expect(msg).toMatch(/[؀-ۿ]/)
  })

  it('targets the parent chat for an international number', () => {
    const url = buildPortalWhatsAppUrl('+20 100 123 4567', 'hi there')
    expect(url).toBe('https://wa.me/201001234567?text=hi%20there')
  })

  it('falls back to the contact picker for a local number', () => {
    expect(buildPortalWhatsAppUrl('0100 123 4567', 'hi')).toBe('https://wa.me/?text=hi')
    expect(buildPortalWhatsAppUrl('', 'hi')).toBe('https://wa.me/?text=hi')
  })
})
