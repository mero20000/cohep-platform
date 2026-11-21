/**
 * Name search for client-side lists (e.g. the attendance roster).
 *
 * Matching is forgiving on purpose: case, Latin accents, Arabic spelling variants
 * (أ/إ/آ → ا, ى → ي, ة → ه), Arabic diacritics, tatweel and Arabic digits are all
 * ignored, and the query is split into words that may appear in any order across
 * the first name, last name and any other field, so "Mina Gerges", "gerges mina"
 * and "mi ger" all find the same student.
 */

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g

/** Lowercased, accent- and diacritic-free form of `value` with single spaces. */
export function normalizeSearchText(value: string | null | undefined): string {
  return String(value ?? '')
    // NFD splits accents and the hamza/madda marks off their letters (أ → ا + ٔ), so one
    // pass of "remove combining marks" folds Latin accents, Arabic diacritics and alef variants.
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '') // tatweel
    .replace(/ٱ/g, 'ا') // alef wasla
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when every word of `query` appears inside the combined `parts`
 * (first name, last name, Arabic names, student code…). An empty query matches all.
 */
export function matchesNameQuery(parts: ReadonlyArray<string | null | undefined>, query: string): boolean {
  const words = normalizeSearchText(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  // Parts are joined with a space, and words contain none, so a word can never straddle two fields.
  const haystack = parts.map(normalizeSearchText).filter(Boolean).join(' ')
  return words.every((w) => haystack.includes(w))
}
