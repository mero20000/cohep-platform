'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Play, Pause, RotateCcw, RotateCw, ChevronUp } from 'lucide-react'
import { ds } from './tokens'

export interface TabItem {
  href: string
  label: string
  labelAr?: string
  icon: React.ComponentType<{ className?: string }>
}

/**
 * BottomNav — mobile-first primary navigation (max 5 items, thumb zone).
 * Hidden on ≥lg where the sidebar takes over. Active state = gold fill + bold
 * label + aria-current, never color alone.
 * RTL-safe: flex order mirrors automatically with dir="rtl".
 */
export function BottomNav({ items, lang = 'en' }: { items: TabItem[]; lang?: 'en' | 'ar' }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Primary'}
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden
        bg-white/95 dark:bg-[var(--hymn-surface-header)]/95 backdrop-blur
        border-t border-[var(--hymn-border)]
        pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-flow-col auto-cols-fr">
        {items.slice(0, 5).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-16 py-2
                  ${ds.focusRing} ${ds.motionSafeTransition}
                  ${active ? 'text-[rgb(var(--gold-700))]' : 'text-gray-500'}`}
              >
                <Icon className={`h-6 w-6 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-[11px] ${active ? 'font-semibold' : 'font-medium'}`}>
                  {lang === 'ar' && item.labelAr ? item.labelAr : item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * PageContent — main-content wrapper that reserves space for the fixed
 * BottomNav and optional MiniPlayer so nothing is occluded. Use it as the
 * direct child of <main id="main-content"> on mobile-first pages.
 */
export function PageContent({
  hasPlayer = false,
  className = '',
  children,
}: {
  /** Set true when the MiniPlayer is mounted on this route. */
  hasPlayer?: boolean
  className?: string
  children: React.ReactNode
}) {
  // nav 64px + safe area; player adds ~68px
  const pad = hasPlayer ? 'pb-36 lg:pb-8' : 'pb-20 lg:pb-8'
  return <div className={`${pad} ${className}`}>{children}</div>
}

/**
 * MiniPlayer — persistent hymn audio dock (Spotify pattern), sits above the
 * bottom nav on mobile / floats bottom-right on desktop. Expandable to a full
 * sheet. Wire to your audio context via props; Media Session API integration
 * belongs in the consuming hook.
 */
export function MiniPlayer({
  title,
  titleCoptic,
  playing,
  onToggle,
  onSkip,
  onExpand,
  progress = 0,
}: {
  title: string
  titleCoptic?: string
  playing: boolean
  onToggle: () => void
  onSkip: (seconds: number) => void
  onExpand: () => void
  /** 0–1 */
  progress?: number
}) {
  return (
    <div
      className="fixed z-40 inset-x-0 bottom-16 lg:bottom-auto lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-80
        bg-white dark:bg-[var(--hymn-surface-header)] border border-[var(--hymn-border)] rounded-t-2xl lg:rounded-2xl
        shadow-[0_-4px_24px_rgba(26,39,68,0.12)]"
      role="region"
      aria-label="Audio player"
    >
      <div className="h-1 bg-gold-neutral-200 rounded-t-2xl overflow-hidden" aria-hidden="true">
        <div className="h-full bg-[rgb(var(--gold-500))]" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="flex items-center gap-1 p-2 sm:gap-2 sm:p-3">
        <button
          onClick={onExpand}
          aria-label={`Expand player — current hymn: ${title}`}
          className={`flex-1 min-w-0 text-start rounded-lg p-1 ${ds.focusRing}`}
        >
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          {titleCoptic && <p className="truncate font-coptic text-xs text-gray-500">{titleCoptic}</p>}
        </button>
        <button
          onClick={() => onSkip(-15)}
          aria-label="Back 15 seconds"
          className={`h-11 w-11 grid place-items-center rounded-full text-gray-600 dark:text-gray-300 ${ds.focusRing} ${ds.motionSafeTransition} hover:bg-black/5`}
        >
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className={`h-12 w-12 grid place-items-center rounded-full bg-[rgb(var(--gold-500))]
            text-[rgb(var(--gold-900))] shadow-sm ${ds.focusRing} ${ds.motionSafeTransition}`}
        >
          {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button
          onClick={() => onSkip(15)}
          aria-label="Forward 15 seconds"
          className={`h-11 w-11 grid place-items-center rounded-full text-gray-600 dark:text-gray-300 ${ds.focusRing} ${ds.motionSafeTransition} hover:bg-black/5`}
        >
          <RotateCw className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {/* Hidden expand affordance for pointer users on desktop */}
      <button
        onClick={onExpand}
        aria-hidden="true"
        tabIndex={-1}
        className="hidden lg:block absolute -top-3 right-4 h-6 w-6 grid place-items-center rounded-full
          bg-white dark:bg-[var(--hymn-surface-header)] border border-[var(--hymn-border)] text-gray-500"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
    </div>
  )
}
