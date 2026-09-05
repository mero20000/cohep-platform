'use client'

import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'

interface SessionExpiryModalProps {
  remainingMs: number
  onExtend: () => void
  onLogout: () => void
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function SessionExpiryModal({ remainingMs, onExtend, onLogout }: SessionExpiryModalProps) {
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const progress = Math.max(0, Math.min(100, (remainingMs / (5 * 60 * 1000)) * 100))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl">⏱</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            {t('Session Expiring', 'انتهاء الجلسة')}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {t('Your session will expire in', 'ستنتهي جلستك خلال')}
          </p>
          <p className="mt-2 text-3xl font-mono font-bold text-amber-600">
            {formatTime(remainingMs)}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear bg-amber-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onLogout}
            variant="outline"
            className="flex-1"
          >
            {t('Sign out', 'تسجيل خروج')}
          </Button>
          <Button
            onClick={onExtend}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {t('Stay signed in', 'البقاء مسجلاً')}
          </Button>
        </div>
      </div>
    </div>
  )
}
