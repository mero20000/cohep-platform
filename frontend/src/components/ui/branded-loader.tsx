export function BrandedLoader({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Gold glow ring */}
        <div className="absolute inset-0 animate-ping rounded-full bg-gold-400/20" style={{ animationDuration: '2s' }} />
        {/* Cross icon */}
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 shadow-lg shadow-gold-200">
          <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
            <rect x="8.5" y="2" width="3" height="16" rx="0.5" fill="white" />
            <rect x="4" y="7" width="12" height="3" rx="0.5" fill="white" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900">{message || 'Loading...'}</p>
        <p className="mt-1 text-xs text-gold-600">Learn. Grow. Praise.</p>
      </div>
    </div>
  )
}
