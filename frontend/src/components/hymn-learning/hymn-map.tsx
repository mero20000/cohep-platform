'use client'
import { useState, useMemo } from 'react'
import { Search, Filter } from 'lucide-react'
import { MASTERY_META, type HymnMapItem, type MasteryStatus } from './hooks'

interface Props {
  hymns: HymnMapItem[]
  onSelect: (hymn: HymnMapItem) => void
  lang: 'en' | 'ar'
}

const FILTERS: { value: MasteryStatus | 'all'; label: string; labelAr: string }[] = [
  { value: 'all',         label: 'All',         labelAr: 'الكل' },
  { value: 'not_started', label: 'Not started',  labelAr: 'لم يبدأ' },
  { value: 'introduced',  label: 'Introduced',   labelAr: 'تعرف عليه' },
  { value: 'practicing',  label: 'Practicing',   labelAr: 'يتدرب' },
  { value: 'known',       label: 'Known',        labelAr: 'يعرفه' },
  { value: 'mastered',    label: 'Mastered',     labelAr: 'أتقنه' },
]

export function HymnMap({ hymns, onSelect, lang }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MasteryStatus | 'all'>('all')
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null)
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  const filtered = useMemo(() => {
    return hymns.filter(h => {
      const mastery: MasteryStatus = h.progress?.masteryStatus ?? 'not_started'
      const matchesFilter = filter === 'all' || mastery === filter
      const q = search.toLowerCase()
      const matchesSearch = !q || h.title.toLowerCase().includes(q) || (h.titleAr ?? '').includes(q) || (h.titleCoptic ?? '').toLowerCase().includes(q)
      return matchesFilter && matchesSearch
    })
  }, [hymns, filter, search])

  // Group by level
  const byLevel = useMemo(() => {
    const map: Record<number, { name: string; items: HymnMapItem[] }> = {}
    for (const h of filtered) {
      const n = h.level.number
      if (!map[n]) map[n] = { name: h.level.name, items: [] }
      map[n].items.push(h)
    }
    return Object.entries(map).sort((a, b) => +a[0] - +b[0])
  }, [filtered])

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder={t('Search hymns...', 'ابحث عن تسبيحة...')} value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-gold-500 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f.value ? 'bg-gold-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {lang === 'ar' ? f.labelAr : f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">{filtered.length} {t('hymns', 'تسبيحة')}</p>

      {/* Level groups */}
      {byLevel.map(([levelNum, { name, items }]) => {
        const lvlN = +levelNum
        const isOpen = expandedLevel === lvlN || expandedLevel === null
        const masteryCount = items.filter(h => (h.progress?.masteryStatus ?? 'not_started') === 'mastered').length

        return (
          <div key={levelNum} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button onClick={() => setExpandedLevel(isOpen ? -1 : lvlN)}
              className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 text-left">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-100 text-xs font-bold text-gold-700">L{levelNum}</span>
                <span className="font-medium text-sm text-gray-900">{name}</span>
                <span className="text-xs text-gray-400">{items.length} {t('hymns', 'تسبيحة')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gold-700 font-medium">{masteryCount}/{items.length} {t('mastered', 'متقن')}</span>
                <LevelBar items={items} />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {items.map(hymn => {
                  const mastery: MasteryStatus = hymn.progress?.masteryStatus ?? 'not_started'
                  const meta = MASTERY_META[mastery]
                  const hasAudio = hymn.resources.some(r => r.type === 'audio')
                  return (
                    <button key={hymn.id} onClick={() => onSelect(hymn)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: meta.dot }} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">{hymn.title}</div>
                        {hymn.titleCoptic && <div className="text-xs text-gray-400 truncate font-coptic mt-0.5">{hymn.titleCoptic}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasAudio && <span className="text-xs text-blue-400" aria-label={t('Has audio', 'صوت متاح')}>♪</span>}
                        {hymn.estimatedDurationMinutes && <span className="text-xs text-gray-400">{hymn.estimatedDurationMinutes}m</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} ${meta.border} border`}>
                          {lang === 'ar' ? meta.labelAr : meta.label}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {byLevel.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">
          {t('No hymns match your search.', 'لا توجد تسابيح تطابق بحثك.')}
        </div>
      )}
    </div>
  )
}

function LevelBar({ items }: { items: HymnMapItem[] }) {
  const counts: Record<MasteryStatus, number> = { not_started: 0, introduced: 0, practicing: 0, known: 0, mastered: 0 }
  for (const h of items) counts[h.progress?.masteryStatus ?? 'not_started']++
  const total = items.length

  return (
    <div className="flex h-2 w-24 rounded-full overflow-hidden gap-0.5" role="img" aria-label="progress bar">
      {(['mastered', 'known', 'practicing', 'introduced'] as MasteryStatus[]).map(s => (
        <div key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: MASTERY_META[s].dot }} />
      ))}
      <div style={{ flex: 1, background: '#E5E7EB' }} />
    </div>
  )
}
