'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSavedStudentKey } from '@/lib/student-session'

/**
 * Student portal index. A student who already signed in on this device goes
 * straight to their dashboard; everyone else goes to the sign-in page.
 */
export default function StudentPortalIndex() {
  const router = useRouter()
  useEffect(() => {
    const key = getSavedStudentKey()
    router.replace(key ? `/student-portal/${encodeURIComponent(key)}` : '/student-portal/login')
  }, [router])
  return null
}
