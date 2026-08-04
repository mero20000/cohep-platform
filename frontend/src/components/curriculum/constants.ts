import { Music2, Cross, Church, BookOpen, Star, type LucideIcon } from 'lucide-react'
import type { SubjectStyle } from './types'
import { getSchoolId } from '@/lib/school'

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
export const SCHOOL_ID = getSchoolId()

export const TERM_LABELS = ['', 'Term 1 (Sep-Dec)', 'Term 2 (Jan-Mar)', 'Term 3 (Apr-Jun)']
export const TERM_SHORT = ['', 'T1', 'T2', 'T3']

const STYLE_POOL: SubjectStyle[] = [
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400', light: 'bg-amber-50/50', hover: 'hover:bg-amber-50', icon: Music2, label: 'Hymns' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-400', light: 'bg-purple-50/50', hover: 'hover:bg-purple-50', icon: Cross, label: 'Rites' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-400', light: 'bg-sky-50/50', hover: 'hover:bg-sky-50', icon: Church, label: 'Language' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400', light: 'bg-emerald-50/50', hover: 'hover:bg-emerald-50', icon: BookOpen, label: 'Studies' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-400', light: 'bg-rose-50/50', hover: 'hover:bg-rose-50', icon: Star, label: 'Other' },
]

const styleCache = new Map<string, SubjectStyle>()

export function getSubjectStyle(name: string): SubjectStyle {
  if (styleCache.has(name)) return styleCache.get(name)!
  const n = (name || '').toLowerCase()
  let style: SubjectStyle
  if (n.includes('hymn')) style = STYLE_POOL[0]
  else if (n.includes('rite')) style = STYLE_POOL[1]
  else if (n.includes('language') || n.includes('coptic')) style = STYLE_POOL[2]
  else if (n.includes('study') || n.includes('bible') || n.includes('doctrine')) style = STYLE_POOL[3]
  else style = STYLE_POOL[0]
  styleCache.set(name, style)
  return style
}

export const STATUS_BADGE: Record<string, 'success' | 'danger' | 'default'> = {
  published: 'success', archived: 'danger', draft: 'default',
}

const KNOWN_ITEM_STATUSES = ['pending', 'allocated', 'in_progress', 'completed'] as const

export function normalizeItemStatus(status?: string): 'pending' | 'allocated' | 'in_progress' | 'completed' {
  return (KNOWN_ITEM_STATUSES as readonly string[]).includes(status ?? '')
    ? status as 'pending' | 'allocated' | 'in_progress' | 'completed'
    : 'pending'
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDateFull(dateStr: string, lang?: string): string {
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
}
