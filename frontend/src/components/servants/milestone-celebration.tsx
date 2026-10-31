'use client'

import { Sparkles, X } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { useMarkMilestonesSeen, type NextMilestone, type ServantMilestoneData } from './hooks'

export function MilestoneCelebration({ milestones }: { milestones: ServantMilestoneData[] }) {
  const lang = useLanguage()
  const dismiss = useMarkMilestonesSeen()
  if (milestones.length === 0) return null

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900">
          {lang === 'ar' ? 'شكراً لخدمتك' : 'Thank you for your service'}
        </p>
        <ul className="mt-1 space-y-0.5 text-sm text-amber-800">
          {milestones.map((m) => (
            <li key={`${m.type}-${m.threshold}`}>{lang === 'ar' && m.labelAr ? m.labelAr : m.label}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => dismiss.mutate()}
        disabled={dismiss.isPending}
        aria-label={lang === 'ar' ? 'إغلاق' : 'Dismiss'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-amber-700 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function NextMilestoneBar({ next }: { next: NextMilestone | null }) {
  const lang = useLanguage()
  if (!next) return null
  const pct = Math.min(100, Math.round((next.current / next.target) * 100))
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>{lang === 'ar' ? 'المحطة القادمة' : 'Next milestone'}: {lang === 'ar' ? next.labelAr : next.label}</span>
        <span className="shrink-0">
          {lang === 'ar' ? `متبقي ${next.remaining}` : `${next.remaining} to go`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={next.target}
        aria-valuenow={next.current}
        className="h-1.5 overflow-hidden rounded-full bg-gray-100"
      >
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
