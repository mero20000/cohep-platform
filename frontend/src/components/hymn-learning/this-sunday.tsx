'use client'
import { Play, Clock } from 'lucide-react'
import { MASTERY_META, type MasteryStatus, type HymnMapItem, type ThisSundayResponse } from './hooks'

const SEASON_LABEL: Record<string, { en: string; ar: string; color: string }> = {
  kiahk:       { en: 'Kiahk · Midnight Praises', ar: 'كيهك · الليلة المائة', color: 'text-purple-700' },
  nativity:    { en: 'Nativity Season', ar: 'موسم الميلاد', color: 'text-blue-700' },
  great_lent:  { en: 'Great Lent', ar: 'الصوم الكبير', color: 'text-gray-700' },
  bright_week: { en: 'Bright Week', ar: 'أسبوع البرامون', color: 'text-amber-700' },
  regular:     { en: 'Regular Season', ar: 'الزمن العادي', color: 'text-gray-500' },
}

interface Props {
  data: ThisSundayResponse | null
  isLoading: boolean
  hymnMap?: HymnMapItem[]
  onSelect: (id: string, title: string, audioUrl?: string) => void
  lang: 'en' | 'ar'
}

export function ThisSundayPanel({ data, isLoading, hymnMap = [], onSelect, lang }: Props) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  const masteryMap: Record<string, MasteryStatus> = {}
  for (const h of hymnMap) masteryMap[h.id] = h.progress?.masteryStatus ?? 'not_started'

  if (isLoading) return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse">
      <div className="h-4 w-48 bg-gray-200 rounded mb-3" />
      {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg mb-2" />)}
    </div>
  )

  if (!data) return null

  const season = SEASON_LABEL[data.season] ?? SEASON_LABEL.regular

  // Countdown to next Sunday
  const now = new Date()
  const sunday = new Date(data.sunday)
  const diffMs = sunday.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const countdown = diffMs > 0
    ? diffDays > 0
      ? t(`in ${diffDays}d ${diffHours}h`, `بعد ${diffDays}ي ${diffHours}س`)
      : t(`in ${diffHours}h`, `بعد ${diffHours}س`)
    : null

  // Georgian date
  const georgianDate = sunday.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-gray-900">{t('This Sunday', 'الأحد القادم')}</h3>
            <p className={`text-xs mt-0.5 ${season.color}`}>
              {lang === 'ar' ? season.ar : season.en} · {data.copticDate.monthName} {data.copticDate.day}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-500">{georgianDate}</div>
            {countdown && (
              <div className="flex items-center gap-1 justify-end mt-0.5 text-xs text-blue-600 font-medium">
                <Clock className="h-3 w-3" />
                {countdown}
              </div>
            )}
          </div>
        </div>
      </div>

      {data.hymns.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">{t('No hymns tagged for this Sunday yet.', 'لا توجد تسابيح معلّمة لهذا الأحد بعد.')}</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {data.hymns.map(hymn => {
            const mastery = masteryMap[hymn.id] ?? 'not_started'
            const meta = MASTERY_META[mastery]
            return (
              <button key={hymn.id} onClick={() => onSelect(hymn.id, hymn.title, hymn.audioUrl ?? undefined)}
                className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-gray-50 transition-colors">
                <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: meta.dot }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">{hymn.title}</div>
                  {hymn.titleCoptic && <div className="text-xs text-gray-400 truncate mt-0.5">{hymn.titleCoptic}</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                    {lang === 'ar' ? meta.labelAr : meta.label}
                  </span>
                  {hymn.audioUrl && (
                    <span className="rounded-full bg-blue-50 p-1 text-blue-500">
                      <Play className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
