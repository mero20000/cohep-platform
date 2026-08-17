export function getGreeting(h = new Date().getHours()) {
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getGreetingAr(h = new Date().getHours()) {
  if (h < 12) return 'صباح الخير'
  return 'مساء الخير'
}

export function getDayName(locale = 'en-GB', d = new Date()) {
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function getDayNameAr(locale = 'ar-EG', d = new Date()) {
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const COPTIC_MONTHS_EN = [
  'Thout', 'Paopi', 'Hathor', 'Koiak', 'Tobi', 'Meshir',
  'Paremhat', 'Paremoude', 'Pashons', 'Paoni', 'Epip', 'Mesori', 'Pi Kogi Enavot',
]
const COPTIC_MONTHS_AR = [
  'توت', 'بابه', 'هاتور', 'كيهك', 'طوبة', 'أمشير',
  'برمهات', 'برمودة', 'بشنس', 'بؤونة', 'أبيب', 'مسرى', 'نسيء',
]
const COPTIC_EPOCH_JDN = 1_825_030

export function getCopticDate(d = new Date()): { day: number; month: number; year: number } {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const dd = d.getDate()

  const a = Math.floor((14 - m) / 12)
  const y2 = y + 4800 - a
  const m2 = m + 12 * a - 3
  const jdn =
    dd + Math.floor((153 * m2 + 2) / 5) + 365 * y2 +
    Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045

  const n = jdn - COPTIC_EPOCH_JDN
  const yearIndex = Math.floor((4 * n + 3) / 1461)
  const yday = n - Math.floor((1461 * yearIndex) / 4)
  const month = Math.floor(yday / 30) + 1
  const day = (yday % 30) + 1

  return { day, month, year: yearIndex + 1 }
}

export function getFullDay(lang: 'en' | 'ar', d = new Date()): string {
  const gregorian = lang === 'ar' ? getDayNameAr('ar-EG', d) : getDayName('en-GB', d)
  const c = getCopticDate(d)
  const monthName = lang === 'ar' ? COPTIC_MONTHS_AR[c.month - 1] : COPTIC_MONTHS_EN[c.month - 1]
  const num = (v: number) => (lang === 'ar' ? v.toLocaleString('ar-EG') : String(v))
  const era = lang === 'ar' ? ' للشهداء' : ' AM'
  return `${gregorian} · ${num(c.day)} ${monthName} ${num(c.year)}${era}`
}
