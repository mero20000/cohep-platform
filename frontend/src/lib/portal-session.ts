'use client'

import { http, PortalUnauthorizedError } from '@/lib/http-client'

/**
 * Concurrent callers for the same access key share ONE exchange.
 *
 * The dashboard fires about ten portal requests at once, and on a tokenless load (app
 * reopened, sessionStorage empty) each used to run its own exchange. The login route is
 * rate limited to a few per minute per IP, so one load used the whole budget: the next
 * load, or the next student on the same wifi, was refused, got no token and every request
 * failed with "Invalid or expired portal session".
 */
const inflight = new Map<string, Promise<void>>()

/**
 * Ensure a student-portal session exists for the given access key.
 * Exchanges the long-lived access key for a short-lived JWT at
 * /student-portal/login and caches it in sessionStorage.
 */
export function ensurePortalSession(code: string): Promise<void> {
  if (typeof window === 'undefined' || !code) return Promise.resolve()
  const running = inflight.get(code)
  if (running) return running
  const exchange = exchangeAccessKey(code).finally(() => { inflight.delete(code) })
  inflight.set(code, exchange)
  return exchange
}

async function exchangeAccessKey(code: string): Promise<void> {
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

function currentToken(): string | null {
  try { return sessionStorage.getItem('student_portal_token') } catch { return null }
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
 * Run a portal request; on a 401 re-exchange the access key and retry exactly once.
 *
 * If another request already replaced the token while this one was in flight, just retry
 * with it: clearing here would throw away a valid session a sibling had just obtained.
 */
async function withPortalRecovery<T>(code: string, run: () => Promise<T>): Promise<T> {
  if (!hasPortalSession()) await ensurePortalSession(code)
  const used = currentToken()
  try {
    return await run()
  } catch (e: any) {
    if (!isPortalAuthFailure(e)) throw e
    if (currentToken() === used) {
      clearPortalSession()
      await ensurePortalSession(code)
    } else if (!hasPortalSession()) {
      await ensurePortalSession(code)
    }
    return run()
  }
}

/** Authenticated portal GET with one-shot session recovery. */
export function portalGet<T>(code: string, path: string): Promise<T> {
  return withPortalRecovery(code, () => http.get<T>(path))
}

/**
 * Authenticated portal POST with the same one-shot recovery.
 *
 * Writes need this at least as much as reads do: a 401 mid-practice or mid-assessment
 * previously discarded what the student had just done.
 */
export function portalPost<T>(code: string, path: string, body?: unknown): Promise<T> {
  return withPortalRecovery(code, () => http.post<T>(path, body))
}

/** Authenticated portal PATCH with the same one-shot recovery. */
export function portalPatch<T>(code: string, path: string, body?: unknown): Promise<T> {
  return withPortalRecovery(code, () => http.patch<T>(path, body))
}
