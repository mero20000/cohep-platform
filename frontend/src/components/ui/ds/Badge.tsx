import { type } from './tokens'

/**
 * Badge — status with icon + text so state never relies on color alone
 * (WCAG 1.4.1). Mastery levels map to the brand: gold = mastered.
 */
const TONES = {
  neutral: 'bg-gold-neutral-100 text-gray-700 border-[var(--hymn-border)]',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  progress: 'bg-amber-50 text-amber-800 border-amber-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  gold: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-900))] border-[rgb(var(--gold-300))]',
} as const

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: keyof typeof TONES
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {icon}
      {children}
    </span>
  )
}

/** Standard mastery mapping used across student/parent/servant views. */
export const MASTERY = {
  'not_started': { tone: 'neutral', label: 'Not started', icon: '○' },
  learning: { tone: 'progress', label: 'Learning', icon: '◐' },
  assessed: { tone: 'info', label: 'Assessed', icon: '✓' },
  mastered: { tone: 'gold', label: 'Mastered', icon: '★' },
} as const

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
      {/* Decorative mark — hidden from AT, real meaning carried by the text */}
      <div aria-hidden="true" className="font-coptic text-3xl text-[rgb(var(--gold-400))]">ⲁⲗⲏⲑⲱⲥ</div>
      <h3 className={`${type.h2}`}>{title}</h3>
      {description && <p className={`${type.body} max-w-sm`}>{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
