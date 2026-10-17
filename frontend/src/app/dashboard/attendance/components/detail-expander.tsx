'use client'

// Contract: explicit callbacks (onBehaviorChange / onParticipationChange /
// onNoteChange) map 1:1 to the useMarkingState setters. Liturgy attendance is no
// longer ticked per class record: it is taken as its own Liturgy session.

type Lang = 'en' | 'ar'

const STRINGS = {
  en: { behavior: 'Behavior', participation: 'Participation', clear: 'Clear', note: 'Note', of5: 'of 5' },
  ar: { behavior: 'السلوك', participation: 'المشاركة', clear: 'مسح', note: 'ملاحظة', of5: 'من 5' },
} as const

interface DetailExpanderProps {
  behavior: number
  participation: number
  note: string
  onBehaviorChange: (v: number) => void
  onParticipationChange: (v: number) => void
  onNoteChange: (v: string) => void
  lang: Lang
  studentName?: string
}

function StarRow({
  label,
  value,
  onChange,
  lang,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  lang: Lang
}) {
  const t = STRINGS[lang]
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          aria-label={`${label} ${v} ${t.of5}`}
          className={`h-11 w-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${
            value >= v ? 'bg-emerald-500' : 'bg-gray-100 border border-gray-200'
          }`}
        >
          {v}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(0)}
        aria-label={`${t.clear} ${label}`}
        className="min-h-[44px] min-w-[44px] rounded-lg text-sm text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        ×
      </button>
    </div>
  )
}

export function DetailExpander({
  behavior,
  participation,
  note,
  onBehaviorChange,
  onParticipationChange,
  onNoteChange,
  lang,
}: DetailExpanderProps) {
  const t = STRINGS[lang]
  return (
    <details className="mt-2">
      <summary className="min-h-[44px] cursor-pointer text-sm text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
        {lang === 'ar' ? 'التفاصيل' : 'Details'}
      </summary>
      <div className="mt-2 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t.behavior}</label>
          <StarRow label={t.behavior} value={behavior} onChange={onBehaviorChange} lang={lang} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t.participation}</label>
          <StarRow label={t.participation} value={participation} onChange={onParticipationChange} lang={lang} />
        </div>
        <input
          value={note || ''}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={t.note}
          aria-label={t.note}
          className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        />
      </div>
    </details>
  )
}
