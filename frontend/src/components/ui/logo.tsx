interface LogoProps {
  /** Logo size in pixels */
  size?: number
  /** Show text label alongside icon */
  showText?: boolean
  /** Text color variant */
  variant?: 'light' | 'dark' | 'gold'
  /** Custom class name */
  className?: string
}

const VARIANT_COLORS = {
  light: { icon: '#FFFFFF', text: '#FFFFFF', subtext: 'rgba(255,255,255,0.7)' },
  dark: { icon: '#D4A843', text: '#111827', subtext: '#6B7280' },
  gold: { icon: '#D4A843', text: '#D4A843', subtext: 'rgba(212,168,67,0.7)' },
} as const

export function Logo({ size = 36, showText = true, variant = 'dark', className = '' }: LogoProps) {
  const colors = VARIANT_COLORS[variant]
  const scale = size / 36

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle with gold gradient */}
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4A843" />
            <stop offset="100%" stopColor="#B8912A" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="8" fill="url(#logoGrad)" />
        {/* Cross */}
        <rect x="15" y="7" width="6" height="22" rx="1" fill="white" />
        <rect x="9" y="14" width="18" height="6" rx="1" fill="white" />
      </svg>

      {/* Text label */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className="font-bold tracking-tight"
            style={{ color: colors.text, fontSize: Math.max(14, 16 * scale) }}
          >
            COHEP
          </span>
          <span
            className="font-medium"
            style={{ color: colors.subtext, fontSize: Math.max(9, 10 * scale) }}
          >
            Coptic Orthodox Hymn Education
          </span>
        </div>
      )}
    </div>
  )
}

/** Compact logo for tight spaces (sidebar, mobile nav) */
export function LogoCompact({ size = 28, variant = 'dark', className = '' }: Omit<LogoProps, 'showText'>) {
  const colors = VARIANT_COLORS[variant]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoCompactGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4A843" />
          <stop offset="100%" stopColor="#B8912A" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="8" fill="url(#logoCompactGrad)" />
      <rect x="15" y="7" width="6" height="22" rx="1" fill="white" />
      <rect x="9" y="14" width="18" height="6" rx="1" fill="white" />
    </svg>
  )
}
