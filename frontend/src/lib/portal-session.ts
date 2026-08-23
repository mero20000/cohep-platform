'use client'

/**
 * Ensure a student-portal session exists for the given access key.
 * Exchanges the long-lived access key for a short-lived JWT at
 * /student-portal/login and caches it in sessionStorage. No-op when a token
 * is already cached (validity is enforced by the API; on 401 the caller can
 * clear it and retry once).
 */
export async function ensurePortalSession(code: string): Promise<void> {
  if (typeof window === 'undefined' || !code) return
  let token: string | null = null
  try { token = sessionStorage.getItem('student_portal_token') } catch {}
  if (token) return
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

export function clearPortalSession(): void {
  try { sessionStorage.removeItem('student_portal_token') } catch {}
}
