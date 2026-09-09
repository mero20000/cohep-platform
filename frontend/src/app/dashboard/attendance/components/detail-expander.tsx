'use client'

type Lang = 'en' | 'ar'

interface DetailExpanderProps {
  behavior: number
  participation: number
  liturgy: boolean
  note: string
  onBehaviorChange: (v: number) => void
  onParticipationChange: (v: number) => void
  onLiturgyChange: (v: boolean) => void
  onNoteChange: (v: string) => void
  lang: Lang
  studentName?: string
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          aria-label={`${label} ${v} of 5`}
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
        aria-label={`Clear ${label}`}
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
  liturgy,
  note,
  onBehaviorChange,
  onParticipationChange,
  onLiturgyChange,
  onNoteChange,
  lang,
}: DetailExpanderProps) {
  return (
    <details className="mt-2">
      <summary className="min-h-[44px] cursor-pointer text-sm text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
        {lang === 'ar' ? 'التفاصيل' : 'Details'}
      </summary>
      <div className="mt-2 space-y-2">
        <StarRow label="behavior" value={behavior} onChange={onBehaviorChange} />
        <StarRow label="participation" value={participation} onChange={onParticipationChange} />
        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!liturgy}
            onChange={(e) => onLiturgyChange(e.target.checked)}
            className="h-6 w-6 accent-yellow-600"
          />
          {lang === 'ar' ? 'حضر القداس' : 'Attended liturgy'}
        </label>
        <input
          value={note || ''}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={lang === 'ar' ? 'ملاحظة' : 'Note'}
          aria-label="Note"
          className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        />
      </div>
    </details>
  )
}
