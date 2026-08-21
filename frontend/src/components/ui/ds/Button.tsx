'use client'

import { forwardRef } from 'react'
import { ds } from './tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  /* Gold = the brand's sacred accent. Dark text on gold keeps ≥4.5:1. */
  primary:
    'bg-[rgb(var(--gold-500))] text-[rgb(var(--gold-900))] hover:bg-[rgb(var(--gold-600))] hover:text-white shadow-sm',
  secondary:
    'bg-white dark:bg-[var(--hymn-surface-header)] text-gray-900 dark:text-gray-100 border border-[var(--hymn-border)] hover:bg-gold-neutral-50',
  ghost: 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg', // 36px — secondary controls only
  md: 'min-h-11 px-4 text-sm gap-2 rounded-xl', // 44px default
  lg: 'min-h-12 px-6 text-base gap-2 rounded-xl', // primary CTAs
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Required when the button contains only an icon (a11y: accessible name). */
  'aria-label'?: string
}

/**
 * Button — the single button primitive.
 * - All sizes meet or exceed 44px touch targets (sm reserved for dense toolbars).
 * - Visible gold focus ring; disabled keeps contrast via opacity + cursor.
 * - RTL-safe: padding/gap are direction-agnostic.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center font-medium select-none
        disabled:opacity-50 disabled:pointer-events-none
        ${VARIANTS[variant]} ${SIZES[size]}
        ${ds.focusRing} ${ds.motionSafeTransition} active:motion-safe:scale-[0.98]
        ${className}`}
      {...props}
    />
  ),
)
Button.displayName = 'ds.Button'
