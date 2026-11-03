import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http } from '../http-client'

const realFetch = globalThis.fetch

function mockFetch(impl: (url: any, init?: any) => any) {
  globalThis.fetch = vi.fn(impl) as any
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('niangelos_token', 'tok')
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('http-client timeouts', () => {
  it('fails fast with an actionable message when the server hangs', async () => {
    // Like real fetch: the hanging request rejects once the signal aborts.
    mockFetch((_url: any, init: any) => new Promise((_resolve, reject) => {
      if (init?.signal?.aborted) {
        reject(new DOMException('aborted', 'AbortError'))
        return
      }
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    await expect(
      (http as any).request('POST', '/students', { a: 1 }, { timeoutMs: 40 }),
    ).rejects.toThrow('Request timed out. Please check your connection and retry.')
  }, 5000)

  it('returns JSON when the server responds in time', async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ id: 's1' }) }) as any)
    const res = await (http as any).request('GET', '/students', undefined, { timeoutMs: 1000 })
    expect(res).toEqual({ id: 's1' })
  })

  it('does not set Content-Type on FormData uploads', async () => {
    let seen: any = null
    mockFetch(async (_url: any, init: any) => {
      seen = init
      return { ok: true, status: 200, json: async () => ({ url: '/u/x.jpg' }) } as any
    })
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'x.jpg')
    await (http as any).request('POST', '/upload/student-photo', fd, { formData: true, timeoutMs: 1000 })
    expect(seen.headers['Content-Type']).toBeUndefined()
    expect(seen.body).toBe(fd)
  })
})

describe('http-client token refresh', () => {
  const json = (status: number, body: unknown = {}) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as any

  const realLocation = window.location
  let hrefSet: string[]

  beforeEach(() => {
    hrefSet = []
    // jsdom cannot navigate; record assignments so a redirect to login is observable.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { get href() { return 'http://localhost/dashboard' }, set href(v: string) { hrefSet.push(v) } },
    })
    localStorage.setItem('user', '{"id":"u1"}')
    localStorage.setItem('niangelos_refresh_token', 'r1')
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  })

  const refreshBody = (init: any) => JSON.parse(init.body).refreshToken

  it('makes one refresh call for a burst of parallel 401s and keeps every caller signed in', async () => {
    let refreshCalls = 0
    mockFetch(async (url: any, init: any) => {
      if (String(url).includes('/auth/refresh')) {
        refreshCalls++
        // The server rotates: only the first presentation of r1 wins, reuse of r1 is a 401.
        return refreshCalls === 1 && refreshBody(init) === 'r1'
          ? json(200, { accessToken: 'tok2', refreshToken: 'r2' })
          : json(401, { message: 'Refresh token has been revoked' })
      }
      return init.headers.Authorization === 'Bearer tok2' ? json(200, { ok: true }) : json(401)
    })

    const results = await Promise.all(Array.from({ length: 16 }, () => http.get('/students')))

    expect(refreshCalls).toBe(1)
    expect(results).toHaveLength(16)
    expect(hrefSet).toEqual([])
    expect(localStorage.getItem('user')).not.toBeNull()
    expect(localStorage.getItem('niangelos_refresh_token')).toBe('r2')
  })

  it('retries with the newer refresh token when another tab rotated it mid-flight', async () => {
    const sent: string[] = []
    mockFetch(async (url: any, init: any) => {
      if (String(url).includes('/auth/refresh')) {
        sent.push(refreshBody(init))
        if (refreshBody(init) === 'r1') {
          localStorage.setItem('niangelos_refresh_token', 'r-other-tab')
          return json(401, { message: 'Refresh token has been revoked' })
        }
        return json(200, { accessToken: 'tok2', refreshToken: 'r3' })
      }
      return init.headers.Authorization === 'Bearer tok2' ? json(200, { ok: true }) : json(401)
    })

    await expect(http.get('/students')).resolves.toEqual({ ok: true })

    expect(sent).toEqual(['r1', 'r-other-tab'])
    expect(hrefSet).toEqual([])
    expect(localStorage.getItem('user')).not.toBeNull()
  })

  it.each([
    ['a 429 rate limit', () => json(429, { message: 'Too Many Requests' })],
    ['a 503 while the server wakes', () => json(503, { message: 'Service Unavailable' })],
  ])('keeps the session when refresh fails with %s', async (_label, refreshReply) => {
    mockFetch(async (url: any) => (String(url).includes('/auth/refresh') ? refreshReply() : json(401)))

    await expect(http.get('/students')).rejects.toThrow()

    expect(hrefSet).toEqual([])
    expect(localStorage.getItem('user')).not.toBeNull()
    expect(localStorage.getItem('niangelos_refresh_token')).toBe('r1')
  })

  it('keeps the session when the refresh request itself fails to connect', async () => {
    mockFetch(async (url: any) => {
      if (String(url).includes('/auth/refresh')) throw new TypeError('Failed to fetch')
      return json(401)
    })

    await expect(http.get('/students')).rejects.toThrow()

    expect(hrefSet).toEqual([])
    expect(localStorage.getItem('user')).not.toBeNull()
  })

  it('signs out when the refresh token is genuinely rejected', async () => {
    mockFetch(async (url: any) =>
      String(url).includes('/auth/refresh') ? json(401, { message: 'Invalid refresh token' }) : json(401),
    )

    await expect(http.get('/students')).rejects.toThrow()

    expect(hrefSet).toEqual(['/auth/login'])
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('niangelos_refresh_token')).toBeNull()
  })
})
