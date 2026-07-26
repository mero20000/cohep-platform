'use client'

import { useState, useEffect, useCallback } from 'react'

export function useDataFreshness(pollInterval: number, onRefresh?: () => void) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isPolling, setIsPolling] = useState(false)

  const refresh = useCallback(() => {
    setIsPolling(true)
    try { onRefresh?.() } catch {}
    setLastUpdated(new Date())
    setTimeout(() => setIsPolling(false), 1000)
  }, [onRefresh])

  useEffect(() => {
    const interval = setInterval(() => {
      setIsPolling(true)
      try { onRefresh?.() } catch {}
      setLastUpdated(new Date())
      setTimeout(() => setIsPolling(false), 1000)
    }, pollInterval)
    return () => clearInterval(interval)
  }, [pollInterval, onRefresh])

  const timeAgo = (date: Date) => {
    const diff = Date.now() - date.getTime()
    const mins = Math.floor(diff / 60000)
    const lang = document.documentElement.lang || 'en'
    if (mins < 1) return lang === 'ar' ? 'الآن' : 'Just now'
    if (mins < 60) return lang === 'ar' ? `منذ ${mins} د` : `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return lang === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return lang === 'ar' ? `منذ ${days} ي` : `${days}d ago`
  }

  return { lastUpdated, isPolling, timeAgo, refresh }
}
