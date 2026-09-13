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
