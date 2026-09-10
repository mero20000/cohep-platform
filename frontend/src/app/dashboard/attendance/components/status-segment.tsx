'use client'
import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'

const ITEMS = [
  { key: 'present', en: 'Present', ar: 'حاضر', Icon: CheckCircle2, active: 'bg-green-100 text-green-700' },
  { key: 'late', en: 'Late', ar: 'متأخر', Icon: Clock, active: 'bg-amber-100 text-amber-700' },
  { key: 'absent', en: 'Absent', ar: 'غائب', Icon: XCircle, active: 'bg-red-100 text-red-700' },
  { key: 'excused', en: 'Excused', ar: 'معذور', Icon: AlertCircle, active: 'bg-gray-200 text-gray-700' },
] as const

export function StatusSegment({ value, onChange, lang, studentName, compact = false }: { value: string; onChange: (s:string)=>void; lang: 'en'|'ar'; studentName: string; compact?: boolean }) {
  return (
    <div role="group" aria-label={lang==='ar' ? `الحالة - ${studentName}` : `Status - ${studentName}`} className={compact ? 'grid grid-cols-4 gap-1.5' : 'grid grid-cols-2 gap-2'}>
      {ITEMS.map(({key,en,ar,Icon,active}) => {
        const label = lang==='ar' ? ar : en
        const pressed = value===key
        return (
          <button key={key} type="button" onClick={()=>onChange(key)} aria-pressed={pressed} aria-label={`${label} - ${studentName}`} title={label}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1 ${compact ? 'min-w-0 flex-1 px-1' : 'min-w-[44px] px-3'} ${pressed ? active : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
