'use client'

import { useState, useEffect, useCallback } from 'react'

const KEY = 'niangelos_active_role'

export interface ActiveRole {
  userRoles: string[]
  activeRole: string | null
  effectiveRole: string
  isSuperAdmin: boolean
  isViewingAs: boolean
  ready: boolean
  setRole: (role: string | null) => void
  clearRole: () => void
}

export function useActiveRole(): ActiveRole {
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const read = () => {
      try {
        const stored = localStorage.getItem('user')
        const u = stored ? JSON.parse(stored) : null
        setUserRoles(Array.isArray(u?.roles) ? u.roles : [])
      } catch {
        setUserRoles([])
      }
      setActiveRole(localStorage.getItem(KEY))
    }
    read()
    setReady(true)
    const onChange = () => read()
    window.addEventListener('rolechange', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('rolechange', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const setRole = useCallback((role: string | null) => {
    if (role) localStorage.setItem(KEY, role)
    else localStorage.removeItem(KEY)
    setActiveRole(role)
    window.dispatchEvent(new CustomEvent('rolechange'))
  }, [])

  const isSuperAdmin = userRoles.includes('super_admin')
  const effectiveRole = activeRole || userRoles[0] || 'guest'
  const isViewingAs = !!activeRole && activeRole !== userRoles[0]

  return { userRoles, activeRole, effectiveRole, isSuperAdmin, isViewingAs, ready, setRole, clearRole: () => setRole(null) }
}

export function roleCategory(role: string): 'management' | 'ministry' | 'parent' {
  if (role === 'parent') return 'parent'
  if (['servant', 'group_leader', 'level_leader', 'assistant_servant'].includes(role)) return 'ministry'
  return 'management'
}
