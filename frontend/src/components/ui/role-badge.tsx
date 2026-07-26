'use client'
import { getRoleByValue } from '@/lib/roles'

const BADGE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  super_admin:       { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  admin:             { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' },
  principal:         { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  curriculum_manager: { bg: 'bg-cyan-100',  text: 'text-cyan-700',  border: 'border-cyan-200' },
  level_leader:      { bg: 'bg-amber-100',  text: 'text-amber-700', border: 'border-amber-200' },
  group_leader:      { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  servant:           { bg: 'bg-green-100',  text: 'text-green-700', border: 'border-green-200' },
  parent:            { bg: 'bg-rose-100',   text: 'text-rose-700',  border: 'border-rose-200' },
}

interface Props {
  role: string
  lang?: 'en' | 'ar'
  size?: 'sm' | 'md'
}

export function RoleBadge({ role, lang = 'en', size = 'sm' }: Props) {
  const info = getRoleByValue(role)
  const style = BADGE_STYLE[role] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' }
  const label = lang === 'ar' ? info?.labelAr || role : info?.label || role
  const s = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${s} ${style.bg} ${style.text} ${style.border}`}>
      {label}
    </span>
  )
}
