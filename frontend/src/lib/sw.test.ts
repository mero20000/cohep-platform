import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadSw({ fetchImpl, cacheStore }: { fetchImpl: typeof fetch; cacheStore?: Map<string, Response> }) {
  const listeners = new Map<string, (event: any) => void>()
  const cache: any = {
    addAll: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockImplementation(async (req: Request, res: Response) => {
      cacheStore?.set(String(req.url), res)
    }),
  }
  const self: any = {
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn() },
    registration: { showNotification: vi.fn() },
    addEventListener: (type: string, cb: any) => { listeners.set(type, cb) },
  }
  const caches: any = {
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockImplementation(async (req: Request) => {
      return cacheStore?.get(String(req.url))
    }),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  }
  const code = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf-8')
  const fn = new Function('self', 'caches', 'fetch', code)
  fn(self, caches, fetchImpl)
  return { self, caches, cache, listeners }
}

function navigateRequest(url: string) {
  return { url, method: 'GET', mode: 'navigate' } as Request
}

function assetRequest(url: string) {
  return { url, method: 'GET', mode: 'no-cors' } as Request
}

function htmlResponse() {
  return { ok: true, type: 'basic', clone: () => htmlResponse() } as unknown as Response
}

describe('service worker fetch strategy (public/sw.js)', () => {
  let cacheStore: Map<string, Response>
  let fetchImpl: any

  beforeEach(() => {
    cacheStore = new Map()
    fetchImpl = vi.fn().mockResolvedValue(htmlResponse())
  })

  it('serves navigations network-first: network result is used even when a stale HTML shell is cached', async () => {
    const staleHtml = { ok: true, type: 'basic', clone: () => staleHtml } as unknown as Response
    cacheStore.set('https://app.example.com/', staleHtml)
    const networkHtml = { ok: true, type: 'basic', clone: () => networkHtml } as unknown as Response
    fetchImpl.mockResolvedValue(networkHtml)
    const { listeners } = loadSw({ fetchImpl, cacheStore })

    let response: unknown
    const event = { request: navigateRequest('https://app.example.com/'), respondWith: (p: unknown) => { response = p } }
    listeners.get('fetch')!(event)
    const result = await response

    expect(fetchImpl).toHaveBeenCalledWith(event.request)
    expect(result).toBe(networkHtml)
  })

  it('serves navigations from cache only when the network is unavailable (offline fallback)', async () => {
    fetchImpl.mockRejectedValue(new TypeError('Failed to fetch'))
    const cachedHtml = htmlResponse()
    cacheStore.set('https://app.example.com/', cachedHtml)
    const { listeners } = loadSw({ fetchImpl, cacheStore })

    let response: unknown
    const event = { request: navigateRequest('https://app.example.com/'), respondWith: (p: unknown) => { response = p } }
    listeners.get('fetch')!(event)
    const result = await response

    expect(result).toBe(cachedHtml)
  })

  it('keeps stale-while-revalidate for static assets: cached copy served immediately', async () => {
    const cachedAsset = htmlResponse()
    cacheStore.set('https://app.example.com/_next/static/chunks/1954.js', cachedAsset)
    const { listeners } = loadSw({ fetchImpl, cacheStore })

    let response: unknown
    const event = { request: assetRequest('https://app.example.com/_next/static/chunks/1954.js'), respondWith: (p: unknown) => { response = p } }
    listeners.get('fetch')!(event)
    const result = await response

    expect(result).toBe(cachedAsset)
  })

  it('ignores API requests (no respondWith)', async () => {
    const { listeners } = loadSw({ fetchImpl, cacheStore })
    const respondWith = vi.fn()
    const event = { request: navigateRequest('https://app.example.com/api/v1/users'), respondWith }
    listeners.get('fetch')!(event)
    expect(respondWith).not.toHaveBeenCalled()
  })
})
