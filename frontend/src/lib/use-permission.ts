'use client'
import { useState, useEffect } from 'react'
import { type Permission, hasPermission } from './permissions'
import { roleCategory } from './roles'

interface UsePermissionReturn {
  can: (permission: Permission) => boolean
  role: string
  isSuperAdmin: boolean
  category: ReturnType<typeof roleCategory>
}

export function usePermission(): UsePermissionReturn {
  const [role, setRole] = useState<string>('guest')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user')
      if (!stored) { setRole('guest'); return }
      const user = JSON.parse(stored)
      const roles: string[] = user?.roles ?? []
      // effective role logic: check for saved override
      const saved = localStorage.getItem('niangelos_active_role')
      const effective = saved && roles.includes(saved) ? saved : (roles[0] || 'guest')
      setRole(effective)
    } catch { setRole('guest') }
  }, [])

  return {
    can: (permission: Permission) => hasPermission(role, permission),
    role,
    isSuperAdmin: role === 'super_admin',
    category: roleCategory(role),
  }
}
