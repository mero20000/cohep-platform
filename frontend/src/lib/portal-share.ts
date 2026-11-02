import { toWhatsAppDigits } from './phone'

interface ShareInput {
  /** First name only — the message never includes the surname. */
  firstName: string
  /** The student's own portal access key; the link is built from it, never hard-coded. */
  portalKey: string
  /** Defaults to NEXT_PUBLIC_APP_URL, then the current origin. */
  origin?: string
}

export function portalUrl(portalKey: string, origin?: string): string {
  const base = (origin
    || process.env.NEXT_PUBLIC_APP_URL
    || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  return `${base}/student-portal/${encodeURIComponent(portalKey)}`
}

/** WhatsApp invitation sent to the parent. `*name*` renders bold in WhatsApp. */
export function buildPortalShareMessage({ firstName, portalKey, origin }: ShareInput): string {
  const name = firstName.trim() || 'your child'
  return [
    'Salam 🙏',
    `*${name}* has a personal Portal at NiAngelos School 🎶`,
    '',
    '🎵 Practise Hymns',
    '⭐ Earn XP',
    '🏅 Collect Badges',
    '📈 Track Attendance & Progress',
    '',
    `❤️ Encourage *${name}* to log in every week, keep learning, and earn more XP!`,
    '',
    `👇 Open *${name}*’s NiAngelos Portal:`,
    portalUrl(portalKey, origin),
    '',
    '🔒 This link is private. Please don’t share it with others.',
    '',
    'Please pray for the Church and Service 🙏',
  ].join('\n')
}

/**
 * Opens a chat with the parent when their number is a full international number;
 * otherwise falls back to WhatsApp's contact picker so the servant can still send
 * (wa.me with a guessed number could message a stranger — see phone.ts).
 */
export function buildPortalWhatsAppUrl(parentPhone: string | null | undefined, message: string): string {
  const digits = toWhatsAppDigits(parentPhone)
  const text = encodeURIComponent(message)
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`
}
