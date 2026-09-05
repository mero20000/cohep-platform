'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000 // show countdown 5 min before expiry
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

interface IdleTimeoutOptions {
  onLogout: () => void
  enabled?: boolean
}

export function useIdleTimeout({ onLogout, enabled = true }: IdleTimeoutOptions) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const expiryRef = useRef<number>(0)
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const onLogoutRef = useRef(onLogout)

  // Keep ref fresh without re-registering listeners
  useEffect(() => {
    onLogoutRef.current = onLogout
  }, [onLogout])

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setRemainingMs(null)
    setIsCountingDown(false)
  }, [])

  const startWarningCountdown = useCallback(() => {
    setIsCountingDown(true)
    setRemainingMs(WARNING_BEFORE_MS)

    countdownRef.current = setInterval(() => {
      setRemainingMs(prev => {
        if (prev === null || prev <= 1000) {
          // Time's up — logout
          if (countdownRef.current) clearInterval(countdownRef.current)
          countdownRef.current = null
          onLogoutRef.current()
          return 0
        }
        return prev - 1000
      })
    }, 1000)
  }, [])

  const resetTimer = useCallback(() => {
    clearTimers()
    if (!enabled) return

    expiryRef.current = Date.now() + IDLE_TIMEOUT_MS

    // Schedule the warning countdown
    const timeUntilWarning = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS
    warningTimerRef.current = setTimeout(() => {
      startWarningCountdown()
    }, timeUntilWarning)
  }, [enabled, clearTimers, startWarningCountdown])

  // Reset on any activity
  useEffect(() => {
    if (!enabled) return

    resetTimer()

    const handleActivity = () => {
      if (isCountingDown) {
        // User came back during countdown — cancel and reset
        clearTimers()
      }
      resetTimer()
    }

    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      clearTimers()
    }
  }, [enabled, resetTimer, isCountingDown, clearTimers])

  // Stay signed in: reset timer and dismiss countdown
  const extendSession = useCallback(() => {
    clearTimers()
    resetTimer()
  }, [clearTimers, resetTimer])

  return {
    isCountingDown,
    remainingMs,
    extendSession,
  }
}
