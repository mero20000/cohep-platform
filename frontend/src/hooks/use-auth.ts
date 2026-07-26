'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getBaseSchoolId } from '@/lib/school'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl?: string
  roles: string[]
  schoolId?: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string, schoolIdentifier = getBaseSchoolId()) => {
    localStorage.removeItem('niangelos_active_school')
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    const res = await fetch(baseUrl + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, schoolIdentifier }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }))
      throw new Error(err.message || 'Login failed')
    }
    const data = await res.json()
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    void fetch(baseUrl + '/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    localStorage.removeItem('user')
    localStorage.removeItem('niangelos_active_school')
    setUser(null)
    router.push('/auth/login')
  }, [router])

  return { user, loading, login, logout }
}
