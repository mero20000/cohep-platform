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
