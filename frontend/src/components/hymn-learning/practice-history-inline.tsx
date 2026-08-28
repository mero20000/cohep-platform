'use client'

import { useStudentHymnHistory } from './student-hooks'
import { Star, Play, Loader2 } from 'lucide-react'

function Stars({ value, max = 5 }: { value: number | null; max?: number }) {
  if (!value) return <span className="text-xs text-gray-400">—</span>
  return (
    <span className="inline-flex" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < value ? 'text-blue-500 fill-blue-400' : 'text-gray-200 fill-gray-100'}`} aria-hidden="true" />
      ))}
    </span>
  )
}

export function PracticeHistoryInline({ code, lessonId, lang = 'en' }: { code: string; lessonId: string; lang?: 'en' | 'ar' }) {
  const { data: sessions, isLoading } = useStudentHymnHistory(code, lessonId)
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('Loading...', 'جارٍ التحميل...')}
      </div>
    )
  }

  const recent = sessions?.slice(0, 3) || []
  if (!recent.length) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">{t('Recent practice', 'تدريب حديث')}</p>
      <div className="space-y-1.5">
        {recent.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
            <span className="text-gray-600">
              {new Date(s.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })}
            </span>
            <div className="flex items-center gap-2">
              <Stars value={s.selfRating} />
              {s.recordingUrl && (
                <button
                  onClick={() => {
                    const audio = new Audio(s.recordingUrl)
                    audio.play()
                  }}
                  className="p-1 hover:bg-white rounded"
                  aria-label={t('Play recording', 'تشغيل التسجيل')}
                >
                  <Play className="h-3 w-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
