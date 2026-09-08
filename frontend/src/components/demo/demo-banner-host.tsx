'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DemoBanner } from './demo-banner'

export function DemoBannerHost() {
  const router = useRouter()
  const [isDemo, setIsDemo] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  const endSession = (expired: boolean) => {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('demo')
      localStorage.removeItem('demo_expires_at')
      localStorage.removeItem('niangelos_token')
      localStorage.removeItem('niangelos_refresh_token')
      localStorage.removeItem('user')
      localStorage.removeItem('niangelos_active_school')
    } catch {}
    router.push(expired ? '/auth/login?demoExpired=1' : '/auth/login')
  }

  useEffect(() => {
    try {
      setIsDemo(localStorage.getItem('demo') === '1')
    } catch {}
  }, [])

  // Ends the demo proactively when its clock runs out, rather than waiting for the
  // next API call to 401 and bounce the visitor with no warning — and counts down
  // the last stretch so the banner itself telegraphs that the demo is ending.
  useEffect(() => {
    if (!isDemo) return
    const tick = () => {
      let expiresAt: number | null = null
      try {
        const raw = localStorage.getItem('demo_expires_at')
        expiresAt = raw ? Number(raw) : null
      } catch {}
      if (!expiresAt || Number.isNaN(expiresAt)) {
        setRemainingMs(null)
        return
      }
      const left = expiresAt - Date.now()
      if (left <= 0) {
        endSession(true)
        return
      }
      setRemainingMs(left)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  if (!isDemo) return null

  return <DemoBanner remainingMs={remainingMs} onExit={() => endSession(false)} />
}
