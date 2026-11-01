import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'

describe('csv', () => {
  it('quotes cells and doubles embedded quotes', () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""')
  })
  it('renders null/undefined as empty', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })
  it('neutralises formula injection in text', () => {
    for (const bad of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x']) {
      expect(csvCell(bad).startsWith(`"'`)).toBe(true)
    }
  })
  it('leaves real numbers alone, including negatives', () => {
    expect(csvCell(-5)).toBe('"-5"')
    expect(csvCell(54)).toBe('"54"')
  })
  it('keeps Arabic text and adds a BOM and CRLF rows', () => {
    const out = toCsv([['المرحلة', 'الحضور'], ['الأولى', 91]])
    expect(out.startsWith('﻿')).toBe(true)
    expect(out).toContain('"المرحلة","الحضور"\r\n"الأولى","91"')
  })
})
