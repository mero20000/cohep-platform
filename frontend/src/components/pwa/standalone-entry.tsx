'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isStandalone } from '@/lib/install-detect'
import { getSavedStudentKey } from '@/lib/student-session'

/**
 * Installed apps open at "/" (the landing page). If a student previously signed
 * in on this device and nobody else is signed in, send them to their dashboard.
 * Staff/parent sessions (localStorage "user") always win.
 */
export default function StandaloneEntry() {
  const pathname = usePathname()
  const router = useRouter()
  useEffect(() => {
    if (pathname !== '/' || !isStandalone()) return
    let hasAccount = false
    try { hasAccount = !!localStorage.getItem('user') } catch { /* noop */ }
    if (hasAccount) return
    const key = getSavedStudentKey()
    if (key) router.replace(`/student-portal/${encodeURIComponent(key)}`)
  }, [pathname, router])
  return null
}
