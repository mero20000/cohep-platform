'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * ProgressBar — determinate progress with a text label so information is never
 * conveyed by the bar alone (WCAG 1.4.1). role="progressbar" carries the value
 * for assistive tech; wrap updates in aria-live at the page level if they
 * change without user action.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  className = '',
}: {
  value: number
  max?: number
  /** Accessible name, e.g. "Hymns mastered". */
  label: string
  showValue?: boolean
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {showValue && (
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {pct}%
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 rounded-full bg-gold-neutral-200 dark:bg-white/10 overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-[rgb(var(--gold-500))] motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * ProgressRing — circular progress for hero cards (student dashboard).
 * SVG-based, animates stroke on mount, honours prefers-reduced-motion.
 */
export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  label,
  children,
}: {
  value: number // 0–100
  size?: number
  strokeWidth?: number
  label: string
  /** Center content, e.g. "72%" or an icon. */
  children?: React.ReactNode
}) {
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const [shown, setShown] = useState(0)
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) return setShown(value)
    mounted.current = true
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  const offset = c - (Math.min(100, Math.max(0, shown)) / 100) * c
  return (
    <div
      role="img"
      aria-label={`${label}: ${Math.round(value)} percent`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth}
          className="stroke-white/20" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          className="stroke-[rgb(var(--gold-400))] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">{children}</div>
    </div>
  )
}

/**
 * StreakDots — Duolingo-style week strip. Each day is a labelled dot; state is
 * encoded by fill AND icon/text so it works without color perception.
 */
export function StreakDots({ days }: { days: Array<{ day: string; done: boolean; today?: boolean }> }) {
  return (
    <ol className="flex gap-2" aria-label="This week's practice">
      {days.map((d) => (
        <li key={d.day} className="flex flex-col items-center gap-1">
          <span
            aria-current={d.today ? 'date' : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border
              ${d.done
                ? 'bg-[rgb(var(--gold-500))] border-transparent text-[rgb(var(--gold-900))]'
                : 'bg-transparent border-[var(--hymn-border)] text-gray-400'}`}
          >
            {d.done ? '✓' : d.day.slice(0, 1)}
            <span className="sr-only">{d.done ? ` — practiced` : ''}</span>
          </span>
          <span aria-hidden="true" className="text-[10px] text-gray-500">{d.day}</span>
        </li>
      ))}
    </ol>
  )
}
