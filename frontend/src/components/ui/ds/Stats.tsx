import { type } from './tokens'

/**
 * StatTile — Khan-style summary stat for parent/servant dashboards.
 * Delta is text + arrow glyph (never color alone); value uses tabular nums
 * so digits don't jitter as data refreshes.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaDirection,
  icon,
}: {
  label: string
  value: string | number
  /** e.g. "+12" or "−3". */
  delta?: string
  deltaDirection?: 'up' | 'down' | 'flat'
  icon?: React.ReactNode
}) {
  const dirGlyph = deltaDirection === 'up' ? '▲' : deltaDirection === 'down' ? '▼' : '—'
  const dirColor =
    deltaDirection === 'up'
      ? 'text-emerald-700'
      : deltaDirection === 'down'
        ? 'text-red-700'
        : 'text-gray-500'
  return (
    <div className="bg-white dark:bg-[var(--hymn-surface-header)] border border-[var(--hymn-border)]
      rounded-2xl p-4 min-h-20">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className={`${type.caption} font-medium`}>{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">{value}</p>
      {delta && (
        <p className={`text-xs font-medium mt-0.5 ${dirColor}`}>
          <span aria-hidden="true">{dirGlyph}</span> {delta}
          <span className="sr-only">
            {deltaDirection === 'up' ? ' increased' : deltaDirection === 'down' ? ' decreased' : ' no change'}
          </span>
        </p>
      )}
    </div>
  )
}

/**
 * ScoreChip — assessment outcome. Icon + label + tone, so state survives
 * color-blindness and high-contrast modes. Sizes meet tap targets when used
 * as buttons in the servant's entry flow (pass size="lg").
 */
const SCORE_TONES = {
  excellent: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-300', glyph: '★★' },
  good: { cls: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-900))] border-[rgb(var(--gold-300))]', glyph: '★' },
  developing: { cls: 'bg-amber-50 text-amber-800 border-amber-300', glyph: '◐' },
  'needs-work': { cls: 'bg-orange-50 text-orange-900 border-orange-300', glyph: '○' },
  excused: { cls: 'bg-gray-100 text-gray-700 border-gray-300', glyph: '–' },
} as const

export type ScoreLevel = keyof typeof SCORE_TONES

export function ScoreChip({
  level,
  size = 'md',
  active = false,
  onClick,
}: {
  level: ScoreLevel
  size?: 'md' | 'lg'
  /** Visual selected state for radio-group usage in assessment entry. */
  active?: boolean
  onClick?: () => void
}) {
  const t = SCORE_TONES[level]
  const label = level.replace('-', ' ')
  const cls = `inline-flex items-center justify-center gap-1.5 rounded-xl border font-semibold capitalize
    ${size === 'lg' ? 'min-h-14 px-4 text-sm' : 'min-h-8 px-2.5 text-xs'}
    ${t.cls}
    ${active ? 'ring-2 ring-[rgb(var(--gold-500))] ring-offset-2 ring-offset-white dark:ring-offset-[var(--hymn-surface)]' : ''}`
  if (!onClick) {
    return (
      <span className={cls}>
        <span aria-hidden="true">{t.glyph}</span> {label}
      </span>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      <span aria-hidden="true">{t.glyph}</span> {label}
    </button>
  )
}
