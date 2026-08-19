import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  /** Optional custom illustration element */
  illustration?: React.ReactNode
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

function CrossIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className}>
      {/* Soft gold glow */}
      <circle cx="60" cy="55" r="45" fill="url(#emptyGlow)" opacity="0.15" />
      {/* Decorative circles */}
      <circle cx="60" cy="55" r="35" stroke="#D4A843" strokeWidth="1" opacity="0.2" />
      <circle cx="60" cy="55" r="25" stroke="#D4A843" strokeWidth="1" opacity="0.15" />
      {/* Cross */}
      <rect x="55" y="25" width="10" height="60" rx="2" fill="#D4A843" opacity="0.25" />
      <rect x="38" y="42" width="44" height="10" rx="2" fill="#D4A843" opacity="0.25" />
      {/* Center dot */}
      <circle cx="60" cy="47" r="3" fill="#D4A843" opacity="0.3" />
      <defs>
        <radialGradient id="emptyGlow" cx="50%" cy="48%" r="50%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}

export function EmptyState({ icon: Icon, title, description, action, illustration, size = 'md' }: EmptyStateProps) {
  const sizeClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-16',
  }

  const iconSizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-14 w-14',
    lg: 'h-18 w-18',
  }

  const iconInnerSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-7 w-7',
    lg: 'h-9 w-9',
  }

  return (
    <div className={`flex flex-col items-center justify-center px-4 ${sizeClasses[size]}`}>
      {illustration || (
        <div className="relative mb-2">
          <CrossIllustration className={`${iconSizeClasses[size]} text-gold-400`} />
          {Icon && (
            <div className={`absolute inset-0 flex items-center justify-center`}>
              <Icon className={`${iconInnerSizeClasses[size]} text-gold-500`} />
            </div>
          )}
        </div>
      )}
      <h3 className="mt-3 text-base font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-gray-500 text-center max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
