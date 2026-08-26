import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  clearSession,
  getSavedSession,
  saveSession,
  type Session,
} from './session'
import { ApiError, loginRequest, setUnauthorizedHandler } from './api'

interface AuthContextValue {
  session: Session | null
  ready: boolean
  loggingIn: boolean
  loginError: string | null
  login(accessKey: string): Promise<boolean>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    getSavedSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (accessKey: string): Promise<boolean> => {
    const key = accessKey.trim()
    if (!key) {
      setLoginError('Enter your access key.')
      return false
    }
    setLoggingIn(true)
    setLoginError(null)
    try {
      const { accessToken } = await loginRequest(key)
      const next: Session = { token: accessToken, studentCode: key }
      await saveSession(next)
      setSession(next)
      return true
    } catch (e) {
      setLoginError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
      return false
    } finally {
      setLoggingIn(false)
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    await clearSession()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, ready, loggingIn, loginError, login, logout }),
    [session, ready, loggingIn, loginError, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
