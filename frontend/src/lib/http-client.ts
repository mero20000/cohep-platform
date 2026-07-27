import { getSchoolId } from './school'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

interface ApiError {
  statusCode: number
  message: string
  error?: string
}

class HttpClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private clearAuth() {
    if (typeof window === 'undefined') return
    localStorage.removeItem('user')
  }

  private async refreshAuth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!res.ok) {
        this.clearAuth()
        if (typeof window !== 'undefined') window.location.href = '/auth/login'
        return false
      }
      return true
    } catch {
      return false
    }
  }

  private get authHeaders(): Record<string, string> {
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
    const headers: Record<string, string> = { ...this.authHeaders }
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

    if (res.status === 401 && path !== '/auth/refresh') {
      const refreshed = await this.refreshAuth()
      if (refreshed) {
        const retryHeaders: Record<string, string> = {}
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
