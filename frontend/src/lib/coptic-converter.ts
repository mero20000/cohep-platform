const CS_TO_UNICODE: Record<string, string> = {
  "A": "Ⲁ", "a": "ⲁ", "B": "Ⲃ", "b": "ⲃ", "G": "Ⲅ", "g": "ⲅ",
  "D": "Ⲇ", "d": "ⲇ", "E": "Ⲉ", "e": "ⲉ", "Z": "Ⲍ", "z": "ⲍ",
  "Y": "Ⲏ", "y": "ⲏ", ":": "Ⲑ", ";": "ⲑ", "I": "Ⲓ", "i": "ⲓ",
  "K": "Ⲕ", "k": "ⲕ", "L": "Ⲗ", "l": "ⲗ", "M": "Ⲙ", "m": "ⲙ",
  "N": "Ⲛ", "n": "ⲛ", "X": "Ⲝ", "x": "ⲝ", "O": "Ⲟ", "o": "ⲟ",
  "P": "Ⲡ", "p": "ⲡ", "R": "Ⲣ", "r": "ⲣ", "C": "Ⲥ", "c": "ⲥ",
  "T": "Ⲧ", "t": "ⲧ", "U": "Ⲩ", "u": "ⲩ", "V": "Ⲫ", "v": "ⲫ",
  "<": "Ⲭ", ",": "ⲭ", "\"": "Ⲯ", "'": "ⲯ", "W": "Ⲱ", "w": "ⲱ",
  "S": "Ϣ", "s": "ϣ", "F": "Ϥ", "f": "ϥ", "Q": "Ϧ", "q": "ϧ",
  "H": "Ϩ", "h": "ϩ", "J": "Ϫ", "j": "ϫ", "{": "Ϭ", "[": "ϭ",
  "}": "Ϯ", "]": "ϯ", "^": "ⲋ", "@": ":", "&": ";",
}

const OVERLINE = '\u0305'

export function csToUnicode(text: string): string {
  const out: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '=') {
      // Jimkin — combine overline with previous character
      if (out.length > 0) {
        out[out.length - 1] += OVERLINE
      }
    } else if (ch === '|') {
      // Double overline — combine with previous character
      if (out.length > 0) {
        out[out.length - 1] += '\u033F'
      }
    } else {
      out.push(CS_TO_UNICODE[ch] ?? ch)
    }
  }
  return out.join('')
}

export function isLikelyCsEncoded(text: string): boolean {
  if (!text) return false
  let count = 0
  for (const ch of text) {
    if (ch in CS_TO_UNICODE && CS_TO_UNICODE[ch] !== ch) {
      count++
    }
  }
  // If >50% of characters match CS encoding, it's likely CS-encoded
  return count > text.length * 0.5
}
