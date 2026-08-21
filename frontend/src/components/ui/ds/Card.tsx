import { ds, type } from './tokens'

/**
 * Card — the unified surface. Replaces the mixed dark-glass/light card styles
 * with one system: light raised cards on the hymn surface, plus an explicit
 * `tone="hero"` for the single dark green hero band per screen.
 */
export function Card({
  tone = 'raised',
  as: Tag = 'section',
  className = '',
  children,
  ...props
}: {
  tone?: 'raised' | 'flat' | 'hero'
  as?: React.ElementType
  className?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  const tones = {
    raised:
      'bg-white dark:bg-[var(--hymn-surface-header)] border border-[var(--hymn-border)] rounded-2xl shadow-[0_1px_3px_rgba(26,39,68,0.06)]',
    flat: 'bg-transparent border border-[var(--hymn-border)] rounded-2xl',
    hero: `${ds.heroGreen} text-white rounded-2xl`,
  } as const
  return (
    <Tag className={`p-4 sm:p-5 ${tones[tone]} ${className}`} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  action,
}: {
  title: string
  /** Optional trailing control (e.g. "See all" link). Rendered after title in DOM order. */
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h2 className={`${type.h2} ${type.display}`}>{title}</h2>
      {action}
    </div>
  )
}
