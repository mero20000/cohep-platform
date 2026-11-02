'use client'
import { useEffect, useState } from 'react'
import { getSchoolId } from './school'
import { http } from './http-client'

/** Submissions awaiting the caller's marking (backend scopes by role). 0 when disabled or on error. */
export function usePendingReviewCount(enabled: boolean, refreshKey?: string): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) { setCount(0); return }
    let cancelled = false
    http.get<{ count: number }>('/assessments/pending-review/count', { schoolId: getSchoolId() })
      .then(d => { if (!cancelled) setCount(d?.count ?? 0) })
      .catch(() => { if (!cancelled) setCount(0) })
    return () => { cancelled = true }
  }, [enabled, refreshKey])
  return count
}
