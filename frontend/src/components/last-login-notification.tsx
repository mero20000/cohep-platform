'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/use-language'
import { Clock, X } from 'lucide-react'

interface LastLoginNotificationProps {
  lastLoginAt: string | null
  autoDismissMs?: number
}

export function LastLoginNotification({ lastLoginAt, autoDismissMs = 20000 }: LastLoginNotificationProps) {
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [visible, setVisible] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    if (!lastLoginAt) return

    // Show after a short delay so it doesn't compete with page load
    const showTimer = setTimeout(() => setVisible(true), 500)

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
      setDismissing(true)
      setTimeout(() => setVisible(false), 300)
    }, autoDismissMs + 500)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
    }
  }, [lastLoginAt, autoDismissMs])

  const handleClose = () => {
    setDismissing(true)
    setTimeout(() => setVisible(false), 300)
  }

  if (!visible || !lastLoginAt) return null

  const formattedDate = new Date(lastLoginAt).toLocaleDateString(
    lang === 'ar' ? 'ar-EG' : 'en-GB',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  )

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg transition-all duration-300 ${
        dismissing ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
    >
      <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">
          {t('Last login', 'آخر دخول')}
        </p>
        <p className="text-sm text-amber-700 mt-0.5">
          {formattedDate}
        </p>
      </div>
      <button
        onClick={handleClose}
        className="text-amber-400 hover:text-amber-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
