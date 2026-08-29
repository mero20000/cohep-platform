'use client'

import { http, PortalUnauthorizedError } from '@/lib/http-client'

/**
 * Ensure a student-portal session exists for the given access key.
 * Exchanges the long-lived access key for a short-lived JWT at
 * /student-portal/login and caches it in sessionStorage.
 */
export async function ensurePortalSession(code: string): Promise<void> {
  if (typeof window === 'undefined' || !code) return
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    const res = await fetch(`${base}/student-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalAccessKey: code }),
    })
    if (!res.ok) return
    const data = await res.json()
    if (data?.accessToken) {
      try { sessionStorage.setItem('student_portal_token', data.accessToken) } catch {}
    }
  } catch {}
}

export function hasPortalSession(): boolean {
  try { return !!sessionStorage.getItem('student_portal_token') } catch { return false }
}

export function clearPortalSession(): void {
  try { sessionStorage.removeItem('student_portal_token') } catch {}
}

/** True for a 401 on a portal request, whoever reported it. */
function isPortalAuthFailure(e: unknown): boolean {
  if (e instanceof PortalUnauthorizedError) return true
  const msg = String((e as { message?: string })?.message || '')
  return /unauthorized|invalid or expired portal session|missing portal session/i.test(msg)
}

/**
 * Authenticated portal GET: on 401 (missing/expired session) clears the cached
 * token, re-exchanges the access key, and retries exactly once.
 */
export async function portalGet<T>(code: string, path: string): Promise<T> {
  if (!hasPortalSession()) await ensurePortalSession(code)
  try {
    return await http.get<T>(path)
  } catch (e: any) {
    if (!isPortalAuthFailure(e)) throw e
    clearPortalSession()
    await ensurePortalSession(code)
    return http.get<T>(path)
  }
}

/**
 * Authenticated portal POST with the same one-shot recovery.
 *
 * Writes need this at least as much as reads do: a 401 mid-practice or mid-assessment
 * previously discarded what the student had just done.
 */
export async function portalPost<T>(code: string, path: string, body?: unknown): Promise<T> {
  if (!hasPortalSession()) await ensurePortalSession(code)
  try {
    return await http.post<T>(path, body)
  } catch (e: any) {
    if (!isPortalAuthFailure(e)) throw e
    clearPortalSession()
    await ensurePortalSession(code)
    return http.post<T>(path, body)
  }
}
