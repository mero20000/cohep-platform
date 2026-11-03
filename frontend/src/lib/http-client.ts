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

  /**
   * Ends the session and returns to login. A demo guest token carries no refresh
   * token, so it always lands here once its 30-minute lifetime is up — previously
   * this dropped the visitor on a bare login page with no explanation of what just
   * happened. Demo state is cleared too, and the login page is told why via a query
   * param so it can show a message instead of looking like a silent failure.
   */
  private redirectToLogin() {
    if (typeof window === 'undefined') return
    const wasDemo = localStorage.getItem('demo') === '1'
    this.clearAuth()
    if (wasDemo) {
      localStorage.removeItem('demo')
      localStorage.removeItem('demo_expires_at')
    }
    window.location.href = wasDemo ? '/auth/login?demoExpired=1' : '/auth/login'
  }

  /**
   * 'ok' — new tokens stored. 'rejected' — the server refused the refresh token, the session
   * is over. 'unavailable' — the refresh call never got a verdict (429, 5xx, network): the
   * session may be fine, so it must not be ended over it.
   */
  private refreshInFlight: Promise<'ok' | 'rejected' | 'unavailable'> | null = null

  /**
   * One refresh at a time. A dashboard fires many requests at once, and when the access token
   * expires they all 401 together. The server rotates the refresh token on use, so only the
   * first call can win — every other one would be refused and, treated as a dead session,
   * log the user out right after the winner stored fresh tokens. Callers share one attempt.
   */
  private refreshAuth(): Promise<'ok' | 'rejected' | 'unavailable'> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh(false)
        .then((outcome) => {
          if (outcome === 'rejected') this.redirectToLogin()
          return outcome
        })
        .finally(() => {
          this.refreshInFlight = null
        })
    }
    return this.refreshInFlight
  }

  private async performRefresh(retriedAfterOtherTab: boolean): Promise<'ok' | 'rejected' | 'unavailable'> {
    const sentToken = typeof window !== 'undefined' ? localStorage.getItem('niangelos_refresh_token') : null
    if (!sentToken) return 'rejected'
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: sentToken }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.accessToken) {
          localStorage.setItem('niangelos_token', data.accessToken)
        }
        if (data.refreshToken) {
          localStorage.setItem('niangelos_refresh_token', data.refreshToken)
        }
        return 'ok'
      }
      if (res.status === 401 || res.status === 403) {
        // Another tab can rotate the token while this call is in flight, leaving the one we
        // sent used-up even though the session lives on. Try the token that replaced it once.
        const current = localStorage.getItem('niangelos_refresh_token')
        if (!retriedAfterOtherTab && current && current !== sentToken) {
          return this.performRefresh(true)
        }
        return 'rejected'
      }
      return 'unavailable'
    } catch {
      return 'unavailable'
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

  private async request<T>(method: string, path: string, body?: unknown, opts?: { formData?: boolean; params?: Record<string, string>; timeoutMs?: number }): Promise<T> {
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

    // Bounded requests: uploads (e.g. student photos on slow mobile links)
    // used to hang the form indefinitely with no feedback. Anything slower
    // than the budget now fails fast with an actionable message instead.
    // The default covers Render free-tier cold starts (≈30–60s); uploads get
    // longer for large photos on mobile links.
    const timeoutMs = opts?.timeoutMs ?? (opts?.formData ? 120000 : 60000)
    const doFetch = (hdrs: Record<string, string>) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      return fetch(url, {
        method,
        headers: hdrs,
        credentials: 'include',
        signal: controller.signal,
        body: opts?.formData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
      }).finally(() => clearTimeout(timer))
    }
    const timedOut = (e: unknown) => {
      // NOTE: DOMException is not an instanceof Error — match on name.
      if ((e as { name?: string })?.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and retry.')
      }
      throw e
    }

    let res: Response
    try {
      res = await doFetch(headers)
    } catch (e) {
      timedOut(e)
      throw e
    }

    // Portal requests must never touch the staff refresh/redirect path. This interceptor
    // used to fire first on every portal 401: it found no staff refresh token, cleared
    // auth and hard-navigated to /auth/login — a form with no access-key field — which
    // made portal-session's own clear-and-retry logic unreachable and lost in-flight
    // answers. A portal 401 is thrown instead, for portalGet to recover from.
    if (res.status === 401 && isPortal) {
      throw new PortalUnauthorizedError()
    }

    let signedOut = false
    if (res.status === 401 && path !== '/auth/refresh') {
      const outcome = await this.refreshAuth()
      if (outcome === 'ok') {
        // Re-attach the (freshly refreshed) token on the retry — refreshAuth stores
        // the new access token in localStorage, so authHeaders picks it up.
        const retryHeaders: Record<string, string> = { ...this.authHeaders }
        if (!opts?.formData) retryHeaders['Content-Type'] = 'application/json'
        try {
          res = await doFetch(retryHeaders)
        } catch (e) {
          timedOut(e)
          throw e
        }
      } else if (outcome === 'unavailable') {
        throw new Error('Could not refresh your session. Please check your connection and retry.')
      } else {
        signedOut = true
      }
    }

    if (!res.ok) {
      if (res.status === 401 && !signedOut) {
        this.redirectToLogin()
      }
      const error = await res.json().catch<ApiError>(() => ({
        statusCode: res.status,
        message: `HTTP ${res.status}`,
      }))
      // Carry the status and full body so callers can act on extra fields (e.g. a 409's existingSessionId).
      throw Object.assign(new Error(error.message || `Request failed: ${res.status}`), { status: res.status, body: error })
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
