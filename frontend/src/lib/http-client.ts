import { getSchoolId } from './school'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface ApiError {
  statusCode: number
  message: string
  error?: string
}

/**
 * A student-portal request came back 401. Thrown rather than redirected, so the portal's
 * own re-exchange of the access key can recover the session in place — a student has no
 * password to re-enter, and the staff login page has no access-key field.
 */
export class PortalUnauthorizedError extends Error {
  readonly status = 401
  constructor() {
    super('Invalid or expired portal session')
    this.name = 'PortalUnauthorizedError'
  }
}

class HttpClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private clearAuth() {
    if (typeof window === 'undefined') return
    localStorage.removeItem('user')
    localStorage.removeItem('niangelos_token')
    localStorage.removeItem('niangelos_refresh_token')
  }

  private async refreshAuth(): Promise<boolean> {
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('niangelos_refresh_token') : null
      if (!refreshToken) {
        this.clearAuth()
        if (typeof window !== 'undefined') window.location.href = '/auth/login'
        return false
      }
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        this.clearAuth()
        if (typeof window !== 'undefined') window.location.href = '/auth/login'
        return false
      }
      const data = await res.json()
      if (data.accessToken) {
        localStorage.setItem('niangelos_token', data.accessToken)
      }
      if (data.refreshToken) {
        localStorage.setItem('niangelos_refresh_token', data.refreshToken)
      }
      return true
    } catch {
      return false
    }
  }

  private get authHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {}
    const token = localStorage.getItem('niangelos_token')
    if (token) return { Authorization: `Bearer ${token}` }
    return {}
  }

  /**
   * Student-portal requests authenticate with the short-lived session token
   * issued at /student-portal/login (the raw access key is never a credential
   * for API calls). Kept separate from the parent JWT so both can coexist.
   */
  private get portalAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {}
    try {
      const token = sessionStorage.getItem('student_portal_token')
      if (token) return { Authorization: `Bearer ${token}` }
    } catch {}
    return {}
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    let url = `${this.baseUrl}${path}`
    if (params) {
      const qs = new URLSearchParams(params).toString()
      if (qs) url += (url.includes('?') ? '&' : '?') + qs
    }
    return url
  }

  private async request<T>(method: string, path: string, body?: unknown, opts?: { formData?: boolean; params?: Record<string, string> }): Promise<T> {
    const isPortal = path.startsWith('/student-portal/')
    const headers: Record<string, string> = {
      ...(isPortal ? this.portalAuthHeaders : this.authHeaders),
    }
    if (!opts?.formData) headers['Content-Type'] = 'application/json'

    const params = { ...opts?.params }
    if (!params.schoolId && !path.includes('schoolId=')) {
      const sid = getSchoolId()
      if (sid) params.schoolId = sid
    }

    const url = this.buildUrl(path, params)

    let res = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: opts?.formData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    })

    // Portal requests must never touch the staff refresh/redirect path. This interceptor
    // used to fire first on every portal 401: it found no staff refresh token, cleared
    // auth and hard-navigated to /auth/login — a form with no access-key field — which
    // made portal-session's own clear-and-retry logic unreachable and lost in-flight
    // answers. A portal 401 is thrown instead, for portalGet to recover from.
    if (res.status === 401 && isPortal) {
      throw new PortalUnauthorizedError()
    }

    if (res.status === 401 && path !== '/auth/refresh') {
      const refreshed = await this.refreshAuth()
      if (refreshed) {
        // Re-attach the (freshly refreshed) token on the retry — refreshAuth stores
        // the new access token in localStorage, so authHeaders picks it up.
        const retryHeaders: Record<string, string> = { ...this.authHeaders }
        if (!opts?.formData) retryHeaders['Content-Type'] = 'application/json'
        res = await fetch(url, {
          method,
          headers: retryHeaders,
          credentials: 'include',
          body: opts?.formData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
        })
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        this.clearAuth()
        if (typeof window !== 'undefined') window.location.href = '/auth/login'
      }
      const error = await res.json().catch<ApiError>(() => ({
        statusCode: res.status,
        message: `HTTP ${res.status}`,
      }))
      throw new Error(error.message || `Request failed: ${res.status}`)
    }

    if (res.status === 204) return undefined as T
    return res.json()
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, { params })
  }

  post<T>(path: string, data?: unknown, params?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', path, data, { params })
  }

  put<T>(path: string, data?: unknown, params?: Record<string, string>): Promise<T> {
    return this.request<T>('PUT', path, data, { params })
  }

  patch<T>(path: string, data?: unknown, params?: Record<string, string>): Promise<T> {
    return this.request<T>('PATCH', path, data, { params })
  }

  delete<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', path, undefined, { params })
  }

  upload<T>(path: string, data: FormData, params?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', path, data, { formData: true, params })
  }

  /** Expose raw fetch for one-off requests (logout etc.) */
  rawHeaders(): Record<string, string> {
    return this.authHeaders
  }
}

export const http = new HttpClient(API_BASE)
