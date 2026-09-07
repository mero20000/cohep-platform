'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DemoBanner } from './demo-banner'

export function DemoBannerHost() {
  const router = useRouter()
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    try {
      setIsDemo(localStorage.getItem('demo') === '1')
    } catch {}
  }, [])

  if (!isDemo) return null

  const handleExit = () => {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('demo')
      localStorage.removeItem('niangelos_token')
      localStorage.removeItem('niangelos_refresh_token')
      localStorage.removeItem('user')
      localStorage.removeItem('niangelos_active_school')
    } catch {}
    router.push('/auth/login')
  }

  return <DemoBanner onExit={handleExit} />
}
