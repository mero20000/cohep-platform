'use client'

import { useLanguage } from '@/lib/use-language'

interface DemoBannerProps {
  onExit: () => void
  /** Milliseconds left in the demo session, or null/omitted when unknown (older session, no timestamp). */
  remainingMs?: number | null
}

const WARNING_THRESHOLD_MS = 5 * 60 * 1000

export function DemoBanner({ onExit, remainingMs = null }: DemoBannerProps) {
  const lang = useLanguage()
  const isAr = lang === 'ar'
  const expiringSoon = remainingMs !== null && remainingMs <= WARNING_THRESHOLD_MS

  const countdown = remainingMs !== null && remainingMs > 0
    ? (() => {
        const totalSeconds = Math.floor(remainingMs / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${String(seconds).padStart(2, '0')}`
      })()
    : null

  const baseMessage = isAr ? 'وضع التجربة — لا يتم حفظ البيانات' : 'Demo Mode — data is not saved'
  const endsInLabel = isAr ? `ينتهي بعد ${countdown}` : `Ends in ${countdown}`

  return (
    <div
      className={`sticky top-0 z-50 text-white text-sm px-4 py-2 flex justify-between items-center gap-3 ${
        expiringSoon ? 'bg-red-600' : 'bg-amber-600'
      }`}
    >
      <span>
        {baseMessage}
        {countdown && <span className="ms-2 font-semibold">{endsInLabel}</span>}
      </span>
      <button
        onClick={onExit}
        className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-amber-600 rounded px-1 py-0.5"
      >
        {isAr ? 'الخروج من التجربة' : 'Exit Demo'}
      </button>
    </div>
  )
}
