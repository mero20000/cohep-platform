/**
 * Minimal CSV builder for report exports.
 *
 * - Quotes every cell and doubles embedded quotes.
 * - Neutralises spreadsheet formula injection: a cell that starts with = + - @ (or a tab / CR) gets a leading
 *   apostrophe, so a student or group named `=HYPERLINK(...)` opens as text in Excel/Sheets.
 *   Genuine numbers (including negatives such as -5) are left alone.
 * - Prepends a UTF-8 BOM so Excel reads Arabic correctly.
 */
export type CsvCell = string | number | null | undefined

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '""'
  let text = String(value)
  const isPlainNumber = typeof value === 'number' && Number.isFinite(value)
  if (!isPlainNumber && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(rows: CsvCell[][]): string {
  return `﻿${rows.map(r => r.map(csvCell).join(',')).join('\r\n')}`
}

export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
