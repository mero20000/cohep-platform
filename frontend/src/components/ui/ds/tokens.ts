/**
 * COHEP Design System — tokens layer
 *
 * Extends the EXISTING brand (gold ramp, hymn surfaces, navy/green) rather than
 * replacing it. All values resolve from CSS variables already defined in
 * globals.css, so dark mode and accent switching keep working.
 *
 * Spacing scale follows a 4px base grid. Radii derive from --radius.
 */
export const ds = {
  /* Surfaces */
  surface: 'bg-[var(--hymn-surface)]',
  surfaceRaised: 'bg-white dark:bg-[var(--hymn-surface-header)]',
  heroGreen: 'bg-[var(--hymn-green)]',
  heroNavy: 'bg-[var(--hymn-navy)]',

  /* Borders use logical-safe plain borders (symmetric) */
  border: 'border-[var(--hymn-border)]',

  /* Focus ring — one consistent, visible treatment everywhere */
  focusRing:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hymn-surface)]',

  /* Minimum comfortable tap target (WCAG 2.5.5 / iOS HIG) */
  tapTarget: 'min-h-11 min-w-11',

  /* Motion — automatically inert when the user prefers reduced motion */
  motionSafeTransition:
    'motion-safe:transition-all motion-safe:duration-200 motion-reduce:transition-none',
} as const

/** Typography presets — Inter for UI, CS Avva Shenouda for display/Coptic. */
export const type = {
  display: 'font-display tracking-tight text-balance',
  h1: 'text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50',
  h2: 'text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-50',
  body: 'text-sm leading-relaxed text-gray-700 dark:text-gray-300',
  caption: 'text-xs text-gray-500 dark:text-gray-400',
  coptic: 'font-coptic',
} as const
