import { toWhatsAppDigits } from './phone'

interface ShareInput {
  studentName: string
  portalKey: string
  /** Defaults to the current origin (or NEXT_PUBLIC_APP_URL when set). */
  origin?: string
}

export function portalUrl(portalKey: string, origin?: string): string {
  const base = (origin
    || process.env.NEXT_PUBLIC_APP_URL
    || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  return `${base}/student-portal/${encodeURIComponent(portalKey)}`
}

/**
 * Warm, bilingual invitation for the parent. Arabic first, English second, so
 * it reads naturally for either household without the servant picking a language.
 */
export function buildPortalShareMessage({ studentName, portalKey, origin }: ShareInput): string {
  const url = portalUrl(portalKey, origin)
  const name = studentName.trim()
  return [
    `🕊️ سلام ونعمة ربنا يسوع معكم،`,
    `ابنكم/ابنتكم *${name}* عنده بوابة خاصة للتعلم في مدرسة الألحان! 🎶`,
    `من خلالها يقدر يتابع حضوره، يتدرّب على الألحان، يجمع النقاط والشارات 🏅 ويحل التقييمات.`,
    `شجّعوه يفتحها كل أسبوع، وشاركوه فرحة تقدّمه ❤️`,
    `👇 اضغط الرابط للدخول مباشرة:`,
    url,
    ``,
    `Grace and peace to you! 🕊️`,
    `*${name}* has a personal Student Portal for hymn learning. 🎶 They can follow attendance, practise hymns, earn points and badges 🏅 and take assessments.`,
    `Please open it together and cheer them on! ❤️`,
    `👇 Tap to open:`,
    url,
    ``,
    `🔒 هذا الرابط خاص بكم، من فضلكم لا تشاركوه مع الآخرين / This link is private — please don't share it.`,
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
