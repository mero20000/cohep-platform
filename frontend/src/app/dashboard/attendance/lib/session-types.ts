export type SessionType = 'class' | 'liturgy' | 'event'
export const SESSION_TYPES: SessionType[] = ['class', 'liturgy', 'event']

type Lang = 'en' | 'ar'

export interface AudienceTarget {
  groupId: string
  levelId?: string | null
  gradeId?: string | null
  gender?: string | null
  group?: { name: string } | null
}

export interface SessionLike {
  type?: string | null
  title?: string | null
  titleAr?: string | null
  allGroups?: boolean | null
  group?: { id?: string; name: string } | null
  level?: { name: string; number?: number } | null
  grade?: { name: string } | null
  targets?: AudienceTarget[] | null
}

export const sessionType = (s: { type?: string | null }): SessionType =>
  s.type === 'liturgy' || s.type === 'event' ? s.type : 'class'

export const typeLabel = (type: SessionType, lang: Lang): string => {
  if (type === 'liturgy') return lang === 'ar' ? 'قداس' : 'Liturgy'
  if (type === 'event') return lang === 'ar' ? 'فعالية' : 'Event'
  return lang === 'ar' ? 'حصة' : 'Class'
}

/** Legacy liturgy sessions were stored as "recorded"; that means finished. */
export const isFinalStatus = (status?: string | null): boolean => status === 'completed' || status === 'recorded'

/** Scheduled day is after today (liturgy/event attendance opens on that day). */
export function isFutureDay(scheduledDate?: string | null, now: Date = new Date()): boolean {
  if (!scheduledDate) return false
  const d = new Date(scheduledDate)
  if (Number.isNaN(d.getTime())) return false
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  return d.getTime() > endOfToday.getTime()
}

/** Who the session is for, e.g. "All groups", "Group A", "Group A, Group B", "4 groups". */
export function audienceSummary(s: SessionLike, lang: Lang): string {
  if (s.allGroups) return lang === 'ar' ? 'كل المجموعات' : 'All groups'
  const names = [...new Set((s.targets ?? []).map(t => t.group?.name).filter((n): n is string => !!n))]
  if (names.length === 0) return s.group?.name ?? ''
  if (names.length <= 2) return names.join(lang === 'ar' ? '، ' : ', ')
  return lang === 'ar' ? `${names.length} مجموعات` : `${names.length} groups`
}

/** Primary line for a session row/header. */
export function sessionTitle(s: SessionLike, lang: Lang): string {
  const type = sessionType(s)
  const own = lang === 'ar' ? (s.titleAr || s.title) : (s.title || s.titleAr)
  if (type === 'class') {
    return `${s.group?.name || '?'}${s.level ? ` · L${s.level.number ?? ''}`.trimEnd() : ''}${s.grade ? ` · ${s.grade.name}` : ''}`
  }
  if (own) return own
  return `${typeLabel(type, lang)} · ${audienceSummary(s, lang)}`.replace(/ · $/, '')
}
