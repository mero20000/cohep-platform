import { describe, it, expect } from 'vitest'
import { hazzatFromHtml } from './hazzat-paste'
import { csToUnicode } from './coptic-converter'

const run = (font: string, text: string) => `<span style='font-family:"${font}"'>${text}</span>`

describe('hazzatFromHtml', () => {
  it('converts Coptic-font runs to Unicode and keeps Hazzat-font runs as typed', () => {
    const html = `<p class=MsoNormal>${run('CS Avva Shenouda', 'K')}${run('Hazzat', '`=')}${run('CS Avva Shenouda', 'cua')}${run('Hazzat', '_=.')}</p>`
    expect(hazzatFromHtml(html)).toBe(`${csToUnicode('K')}\`=${csToUnicode('cua')}_=.`)
  })

  it('keeps each paragraph and <br> as its own line, and turns non-breaking spaces into spaces', () => {
    const html = `<p>${run('Hazzat', '=_=')}</p><p>${run('CS Avva Shenouda', 'T')}${run('Hazzat', '&nbsp;&nbsp;.=')}<br>${run('Hazzat', '__')}</p>`
    expect(hazzatFromHtml(html)).toBe(`=_=\n${csToUnicode('T')}  .=\n__`)
  })

  it('inherits the font from a parent element', () => {
    expect(hazzatFromHtml(`<p style='font-family:Hazzat'><b>=_.</b></p>`)).toBe('=_.')
  })

  it('ignores style blocks and Word metadata', () => {
    const html = `<html><head><style>p{font-family:Hazzat}</style></head><body><p>${run('Hazzat', '=_')}</p></body></html>`
    expect(hazzatFromHtml(html)).toBe('=_')
  })

  it('returns null when no Hazzat or Coptic font is present, so a plain paste is used instead', () => {
    expect(hazzatFromHtml(`<p style='font-family:Calibri'>hello</p>`)).toBeNull()
    expect(hazzatFromHtml('')).toBeNull()
  })
})
