/**
 * wa.me requires the full country code with no leading trunk digit (e.g. a
 * number entered as "0100 123 4567" instead of "+20 100 123 4567" builds a
 * link that opens WhatsApp to a completely different, wrong contact — silently,
 * with no error). There is no safe way to guess a missing country code, so a
 * number that isn't already unambiguously international is treated as
 * unusable for WhatsApp rather than guessed at.
 *
 * Returns digits only (no leading +), ready for `https://wa.me/<digits>`, or
 * null when the input can't be trusted to be a full international number.
 */
export function toWhatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone) return null
  let normalized = phone.trim()
  if (normalized.startsWith('00')) normalized = '+' + normalized.slice(2)
  if (!normalized.startsWith('+')) return null

  const digits = normalized.slice(1).replace(/\D/g, '')
  // Real international numbers run 8-15 digits (E.164); anything outside that
  // range after stripping the '+' isn't a usable phone number.
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

/**
 * `tel:` links are resolved by the device's own dialer using its region
 * settings, so a locally-formatted number works fine there even though it
 * isn't safe for `toWhatsAppDigits` above — this just strips decoration
 * (spaces, dashes, parens) while keeping a leading '+' if present.
 */
export function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}
