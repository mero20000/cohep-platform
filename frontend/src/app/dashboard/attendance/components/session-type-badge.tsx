'use client'
import { Church, Calendar, PartyPopper } from 'lucide-react'
import { sessionType, typeLabel, type SessionType } from '../lib/session-types'

const STYLE: Record<SessionType, string> = {
  class: 'bg-blue-50 text-blue-700',
  liturgy: 'bg-purple-50 text-purple-700',
  event: 'bg-amber-50 text-amber-700',
}
const ICON = { class: Calendar, liturgy: Church, event: PartyPopper } as const

export function SessionTypeBadge({ type, lang }: { type?: string | null; lang: 'en' | 'ar' }) {
  const t = sessionType({ type })
  const Icon = ICON[t]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${STYLE[t]}`}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {typeLabel(t, lang)}
    </span>
  )
}
