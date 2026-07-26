'use client'
import { useState, useEffect } from 'react'

const KEY = 'niangelos_active_school'

export function useActiveSchool() {
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null)

  useEffect(() => {
    const read = () => setActiveSchoolId(localStorage.getItem(KEY))
    read()
    const handler = () => read()
    window.addEventListener('schoolchange', handler)
    return () => window.removeEventListener('schoolchange', handler)
  }, [])

  const setActiveSchool = (id: string | null) => {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
    setActiveSchoolId(id)
    window.dispatchEvent(new CustomEvent('schoolchange'))
    // Reload so every mounted page re-fetches with the new scope
    window.location.reload()
  }

  return { activeSchoolId, setActiveSchool }
}
