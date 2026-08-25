'use client'

import { useStudentHymnHistory } from './student-hooks'
import { Star, Loader2 } from 'lucide-react'

/**
 * Practice history timeline for one hymn — closes the Listening Loop by
 * returning each session's outcome (and the servant's review, when given)
 * to the learner. Backend: GET /student-portal/:code/history/:lessonId.
 */
function Stars({ value, max = 5, tone }: { value: number | null; max?: number; tone: 'self' | 'servant' }) {
  if (!value) return <span className="text-xs text-gray-400">—</span>
  const color = tone === 'servant' ? 'text-gold-600 fill-gold-500' : 'text-blue-500 fill-blue-400'
  return (
    <span className="inline-flex" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < value ? color : 'text-gray-200 fill-gray-100'}`} aria-hidden="true" />
      ))}
    </span>
  )
}

export function PracticeHistory({ code, lessonId, lang = 'en' }: { code: string; lessonId: string; lang?: 'en' | 'ar' }) {
  const { data: sessions, isLoading } = useStudentHymnHistory(code, lessonId)
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-400" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('Loading your practice story…', 'جارٍ تحميل رحلة تدريبك…')}
      </div>
    )
  }
  if (!sessions?.length) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        {t('Your practice story', 'قصة تدريبك')}
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        {t('Every time you pray this hymn — and what your servant heard.', 'كل مرة صليت فيها هذه الترنيمة وما سمعه خادمك.')}
      </p>
      <ol className="space-y-3">
        {sessions.map((s) => (
          <li key={s.id} className="relative pl-5">
            {/* timeline dot */}
            <span aria-hidden="true"
              className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-gold-400 ring-2 ring-white border border-gold-300" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-gray-900">
                {new Date(s.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <span className="inline-flex items-center gap-1 text-gray-500">
                <span className="text-[11px] uppercase tracking-wide">{t('You', 'أنت')}</span>
                <Stars value={s.selfRating} tone="self" />
              </span>
              {s.servantReviewedAt && (
                <span className="inline-flex items-center gap-1 text-gray-700">
                  <span className="text-[11px] uppercase tracking-wide">{t('Servant', 'الخادم')}</span>
                  <Stars value={s.servantRating} tone="servant" />
                </span>
              )}
            </div>
            {s.servantNote && (
              <p className="mt-1 rounded-lg bg-gold-neutral-50 border border-gold-neutral-200 px-3 py-2 text-sm text-gray-800">
                <span className="sr-only">{t('Note from your servant: ', 'رسالة من خادمك: ')}</span>
                {s.servantNote}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
