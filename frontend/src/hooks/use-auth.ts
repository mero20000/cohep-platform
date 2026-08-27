'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLogto } from '@logto/react'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl?: string
  roles: string[]
  schoolId?: string
  metadata?: Record<string, any>
}

interface UseAuthOptions {
  useLogto?: boolean
}

export function useAuth(options: UseAuthOptions = {}) {
  const { useLogto: useLogtoAuth = false } = options
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const logto = useLogto()

  // Logto authentication flow
  useEffect(() => {
    if (!useLogtoAuth) return

    const fetchLogtoUser = async () => {
      if (logto.isAuthenticated) {
        try {
          const response = await fetch('/api/logto/user')
          if (response.ok) {
            const data = await response.json()
            const logtoUser = data.user

            const authUser: AuthUser = {
              id: logtoUser.sub,
              email: logtoUser.email || '',
              firstName: logtoUser.name?.split(' ')[0] || logtoUser.username || '',
              lastName: logtoUser.name?.split(' ').slice(1).join(' ') || '',
              avatarUrl: logtoUser.picture,
              roles: [],
              schoolId: undefined,
              metadata: logtoUser,
            }

            setUser(authUser)
            localStorage.setItem('user', JSON.stringify(authUser))
            localStorage.setItem('niangelos_token', data.accessToken)
          }
        } catch (error) {
          console.error('Failed to fetch Logto user:', error)
        }
      } else {
        setUser(null)
        localStorage.removeItem('user')
        localStorage.removeItem('niangelos_token')
      }
      setLoading(false)
    }

    fetchLogtoUser()
  }, [useLogtoAuth, logto.isAuthenticated])

  // Legacy authentication flow (localStorage-based)
  useEffect(() => {
    if (useLogtoAuth) return

    const stored = localStorage.getItem('user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [useLogtoAuth])

  const login = useCallback(async (email?: string, password?: string, schoolIdentifier?: string) => {
    if (useLogtoAuth) {
      // Logto sign-in
      await logto.signIn(`${window.location.origin}/api/logto/callback`)
      return
    }

    // Legacy login
    if (!email || !password) {
      throw new Error('Email and password are required for legacy login')
    }

    localStorage.removeItem('niangelos_active_school')
    localStorage.removeItem('user')
    localStorage.removeItem('niangelos_token')
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    const body: Record<string, string> = { email, password }
    if (schoolIdentifier) {
      body.schoolIdentifier = schoolIdentifier
    }
    const res = await fetch(baseUrl + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }))
      throw new Error(err.message || 'Login failed')
    }
    const data = await res.json()
    if (data.accessToken) {
      localStorage.setItem('niangelos_token', data.accessToken)
    }
    if (data.refreshToken) {
      localStorage.setItem('niangelos_refresh_token', data.refreshToken)
    }
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data
  }, [useLogtoAuth, logto])

  const logout = useCallback(async () => {
    if (useLogtoAuth) {
      await logto.signOut(`${window.location.origin}/auth/login`)
      setUser(null)
      localStorage.removeItem('user')
      localStorage.removeItem('niangelos_token')
      localStorage.removeItem('niangelos_refresh_token')
      localStorage.removeItem('niangelos_active_school')
      router.push('/auth/login')
      return
    }

    // Legacy logout
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    void fetch(baseUrl + '/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    localStorage.removeItem('user')
    localStorage.removeItem('niangelos_token')
    localStorage.removeItem('niangelos_refresh_token')
    localStorage.removeItem('niangelos_active_school')
    setUser(null)
    router.push('/auth/login')
  }, [useLogtoAuth, logto, router])

  return { user, loading, login, logout }
}
