import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { portalGet } from './portal-session'

/**
 * Fake portal backend: the access-key exchange is rate limited (like the real
 * /student-portal/login), data routes require a valid Bearer token.
 */
function fakeBackend({ loginLimit }: { loginLimit: number }) {
  let logins = 0
  let issued = 0
  const valid = new Set<string>()
  const json = (status: number, body: unknown) =>
    ({ ok: status < 400, status, json: async () => body }) as unknown as Response
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/student-portal/login')) {
      logins++
      if (logins > loginLimit) return json(429, { message: 'Too Many Requests' })
      const token = `tok-${++issued}`
      valid.add(token)
      return json(200, { accessToken: token })
    }
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? ''
    if (!valid.has(auth.replace('Bearer ', ''))) return json(401, { message: 'Unauthorized' })
    return json(200, { ok: true })
  })
  return { impl, loginCount: () => logins }
}

beforeEach(() => { sessionStorage.clear(); localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals() })

describe('portalGet on a tokenless load (app reopened, sessionStorage empty)', () => {
  it('loads every concurrent dashboard request with a single access-key exchange', async () => {
    const be = fakeBackend({ loginLimit: 5 })
    vi.stubGlobal('fetch', be.impl)

    // The dashboard fires about ten portal requests at once on load.
    const calls = Array.from({ length: 10 }, (_, i) => portalGet('key-1', `/student-portal/key-1/part-${i}`))
    const results = await Promise.allSettled(calls)

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0)
    expect(be.loginCount()).toBe(1)
  })

  it('still recovers when the token expired mid-session', async () => {
    const be = fakeBackend({ loginLimit: 5 })
    vi.stubGlobal('fetch', be.impl)
    sessionStorage.setItem('student_portal_token', 'expired-token')

    const calls = Array.from({ length: 4 }, (_, i) => portalGet('key-1', `/student-portal/key-1/part-${i}`))
    const results = await Promise.allSettled(calls)

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0)
    expect(be.loginCount()).toBe(1)
  })

  it('does not burn the login rate limit: several reopenings in a minute all load', async () => {
    // Real limit is single digits per minute per IP (a whole class shares the church wifi).
    const be = fakeBackend({ loginLimit: 5 })
    vi.stubGlobal('fetch', be.impl)

    for (let reopen = 0; reopen < 3; reopen++) {
      sessionStorage.clear() // app closed: the session token does not survive
      const calls = Array.from({ length: 10 }, (_, i) => portalGet('key-1', `/student-portal/key-1/part-${i}`))
      const results = await Promise.allSettled(calls)
      expect(results.filter((r) => r.status === 'rejected'), `reopen #${reopen + 1}`).toHaveLength(0)
    }
  })
})
