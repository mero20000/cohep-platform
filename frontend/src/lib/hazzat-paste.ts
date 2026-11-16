import { csToUnicode } from './coptic-converter'

/**
 * Turn rich text copied from Word into the plain text the Hazzat reader expects.
 *
 * A hymn's hazzat is typed in two fonts at once: Coptic letters in a legacy Coptic font and the
 * notation marks in the Hazzat font. Both are ordinary keystrokes, so the same character (a `c`, a `u`)
 * is a Coptic letter in one run and a mark in the other, and plain-text paste loses which is which.
 * The clipboard's HTML keeps each run's font, so:
 *
 *   - runs in a Coptic font become Unicode Coptic (Avva Shenouda draws these)
 *   - runs in the Hazzat font, and everything else, are kept exactly as typed (the Hazzat font draws these)
 *
 * Stored that way, the characters themselves say which font they need, so no markup is required.
 * Returns null when the HTML carries no recognisable Hazzat/Coptic font, so the caller can fall back
 * to a plain paste.
 */
const COPTIC_FONT = /avva|shenouda|coptic|antinoou|athanasius|new\s*athena|\bcs\b/i
const HAZZAT_FONT = /hazzat/i
const BLOCKS = new Set(['P', 'DIV', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'])

function fontOf(el: Element, inherited: string): string {
  const style = el.getAttribute('style') || ''
  const m = style.match(/(?:^|;)\s*(?:mso-ascii-font-family|font-family)\s*:\s*([^;]+)/i)
  const face = el.tagName === 'FONT' ? el.getAttribute('face') : null
  return (m?.[1] || face || inherited).replace(/["']/g, '').trim()
}

export function hazzatFromHtml(html: string): string | null {
  if (!html || typeof DOMParser === 'undefined') return null
  const body = new DOMParser().parseFromString(html, 'text/html').body
  if (!body) return null

  let sawKnownFont = false
  let out = ''

  const walk = (node: Node, font: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // HTML collapses source line breaks; real line breaks come from <p>/<br>.
      const text = (node.textContent || '').replace(/\s*\n\s*/g, ' ').replace(/ /g, ' ')
      if (!text) return
      if (COPTIC_FONT.test(font) && !HAZZAT_FONT.test(font)) {
        sawKnownFont = true
        out += csToUnicode(text)
      } else {
        if (HAZZAT_FONT.test(font)) sawKnownFont = true
        out += text
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (['STYLE', 'SCRIPT', 'HEAD', 'TITLE', 'META', 'XML'].includes(el.tagName)) return
    if (el.tagName === 'BR') { out += '\n'; return }
    const f = fontOf(el, font)
    const block = BLOCKS.has(el.tagName)
    if (block && out && !out.endsWith('\n')) out += '\n'
    el.childNodes.forEach(c => walk(c, f))
    if (block && !out.endsWith('\n')) out += '\n'
  }
  body.childNodes.forEach(c => walk(c, ''))

  if (!sawKnownFont) return null
  return out.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '')
}
