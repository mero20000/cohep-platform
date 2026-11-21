import { describe, it, expect } from 'vitest'
import { normalizeSearchText, matchesNameQuery } from './name-search'

const mina = ['Mina', 'Gerges', 'مينا', 'جرجس']
const ahmed = ['Ahmed', 'Samir', 'أحمد', 'سمير']
const jose = ['José', 'Núñez', null, undefined]

describe('normalizeSearchText', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeSearchText('  MINA   Gerges ')).toBe('mina gerges')
  })
  it('folds Latin accents', () => {
    expect(normalizeSearchText('José Núñez')).toBe('jose nunez')
  })
  it('folds Arabic alef, ya, ta-marbuta and hamza-on-waw/ya variants', () => {
    expect(normalizeSearchText('أحمد إبراهيم آمال')).toBe('احمد ابراهيم امال')
    expect(normalizeSearchText('مصطفى')).toBe(normalizeSearchText('مصطفي'))
    expect(normalizeSearchText('فاطمة')).toBe(normalizeSearchText('فاطمه'))
  })
  it('strips Arabic diacritics and tatweel', () => {
    expect(normalizeSearchText('مُحَمَّد')).toBe('محمد')
    expect(normalizeSearchText('جـــرجس')).toBe('جرجس')
  })
  it('turns Arabic-Indic digits into ASCII digits', () => {
    expect(normalizeSearchText('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
    expect(normalizeSearchText('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789') // Persian digits
  })
  it('tolerates null and undefined', () => {
    expect(normalizeSearchText(null)).toBe('')
    expect(normalizeSearchText(undefined)).toBe('')
  })
})

describe('matchesNameQuery', () => {
  it('matches everything when the query is empty or blank', () => {
    expect(matchesNameQuery(mina, '')).toBe(true)
    expect(matchesNameQuery(mina, '   ')).toBe(true)
  })

  it.each(['MINA', 'mina', 'ina', 'erg', 'ges'])('matches any part of a name, ignoring case: %s', (q) => {
    expect(matchesNameQuery(mina, q)).toBe(true)
  })

  it.each(['Mina Gerges', 'Gerges Mina', 'mina ge', 'ge mi', 'Mina   Gerges', ' mina gerges '])(
    'matches first and last name together, in any order, with any spacing: %s', (q) => {
      expect(matchesNameQuery(mina, q)).toBe(true)
    })

  it.each(['مينا جرجس', 'جرجس مينا', 'جرج', 'مين جر'])('matches Arabic names, partial and together: %s', (q) => {
    expect(matchesNameQuery(mina, q)).toBe(true)
  })

  it('matches English and Arabic parts in one query', () => {
    expect(matchesNameQuery(mina, 'mina جرجس')).toBe(true)
  })

  it.each(['احمد', 'أحمد', 'إحمد', 'احمد سمير'])('ignores Arabic spelling variants: %s', (q) => {
    expect(matchesNameQuery(ahmed, q)).toBe(true)
  })

  it.each(['jose', 'JOSÉ', 'jose nunez', 'nunez'])('ignores Latin accents: %s', (q) => {
    expect(matchesNameQuery(jose, q)).toBe(true)
  })

  it('matches the student code when it is part of the searchable fields', () => {
    expect(matchesNameQuery([...mina, 'STU-0042'], 'stu-0042')).toBe(true)
    expect(matchesNameQuery([...mina, 'STU-0042'], 'mina 0042')).toBe(true)
  })

  it('requires every word to match', () => {
    expect(matchesNameQuery(mina, 'mina samir')).toBe(false)
    expect(matchesNameQuery(mina, 'zzz')).toBe(false)
  })

  it('does not match across unrelated students by accident (a word only matches inside the combined name)', () => {
    expect(matchesNameQuery(['Ann', 'Lee'], 'nl')).toBe(false) // words are joined with a space, so "n" + "l" never touch
  })
})
