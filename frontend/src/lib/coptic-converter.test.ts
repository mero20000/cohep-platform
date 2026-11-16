import { describe, it, expect } from 'vitest'
import { csToUnicode, isLikelyCsEncoded, toDisplayCoptic } from './coptic-converter'

describe('toDisplayCoptic', () => {
  it('converts raw CS keystrokes to Unicode Coptic', () => {
    expect(isLikelyCsEncoded('ouo`w')).toBe(true)
    expect(toDisplayCoptic('ouo`w')).toBe(csToUnicode('ouo`w'))
  })
  it('keeps Unicode Coptic, empty and missing values as they are', () => {
    expect(toDisplayCoptic('Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ')).toBe('Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ')
    expect(toDisplayCoptic('')).toBe('')
    expect(toDisplayCoptic(null)).toBe('')
    expect(toDisplayCoptic(undefined)).toBe('')
  })
})
