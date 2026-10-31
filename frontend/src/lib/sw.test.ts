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
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    navigator: { setAppBadge: vi.fn().mockResolvedValue(undefined) },
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
  const fn = new Function('self', 'caches', 'fetch', 'clients', code)
  fn(self, caches, fetchImpl, self.clients)
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

function pushEvent(payload: unknown) {
  const waits: Promise<unknown>[] = []
  return { event: { data: { json: () => payload }, waitUntil: (p: Promise<unknown>) => waits.push(p) }, done: () => Promise.all(waits) }
}

describe('service worker push (public/sw.js)', () => {
  const load = () => loadSw({ fetchImpl: vi.fn() as any })

  it('shows the notification and sets the app badge from the unread total', async () => {
    const { self, listeners } = load()
    const { event, done } = pushEvent({ title: 'Graded', body: 'Quiz marked', url: '/dashboard/assessments', unread: 4, tag: 'assessment' })
    listeners.get('push')!(event)
    await done()
    expect(self.registration.showNotification).toHaveBeenCalledWith('Graded', expect.objectContaining({
      body: 'Quiz marked', tag: 'assessment', data: { url: '/dashboard/assessments' },
    }))
    expect(self.navigator.setAppBadge).toHaveBeenCalledWith(4)
  })

  it('leaves the badge alone when the push carries no unread total', async () => {
    const { self, listeners } = load()
    const { event, done } = pushEvent({ title: 'Hi', body: '' })
    listeners.get('push')!(event)
    await done()
    expect(self.navigator.setAppBadge).not.toHaveBeenCalled()
  })

  it('still shows the notification where the Badging API is missing', async () => {
    const { self, listeners } = load()
    delete self.navigator.setAppBadge
    const { event, done } = pushEvent({ title: 'Hi', body: 'x', unread: 2 })
    listeners.get('push')!(event)
    await done()
    expect(self.registration.showNotification).toHaveBeenCalled()
  })

  it('falls back to a default notification on a malformed payload', async () => {
    const { self, listeners } = load()
    const waits: Promise<unknown>[] = []
    listeners.get('push')!({ data: { json: () => { throw new Error('bad json') } }, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
    expect(self.registration.showNotification).toHaveBeenCalledWith('COHEP', expect.any(Object))
  })

  it.each(['https://evil.example/phish', '//evil.example', 'javascript:alert(1)', undefined])(
    'never opens a non-local link (%s)', async (url) => {
      const { self, listeners } = load()
      const { event, done } = pushEvent({ title: 't', body: 'b', url })
      listeners.get('push')!(event)
      await done()
      expect(self.registration.showNotification.mock.calls[0][1].data.url).toBe('/dashboard')
    },
  )
})

describe('service worker notification click (public/sw.js)', () => {
  const click = async (url: string, windows: any[]) => {
    const { self, listeners } = loadSw({ fetchImpl: vi.fn() as any })
    self.clients.matchAll.mockResolvedValue(windows)
    const waits: Promise<unknown>[] = []
    const close = vi.fn()
    listeners.get('notificationclick')!({ notification: { close, data: { url } }, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
    return { self, close }
  }

  it('focuses a window that is already on the target page', async () => {
    const focus = vi.fn().mockResolvedValue(undefined)
    const { close } = await click('/dashboard/notifications', [{ url: 'https://app.example.com/dashboard/notifications', focus }])
    expect(close).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
  })

  it('navigates an open app window instead of opening another tab', async () => {
    const focus = vi.fn()
    const navigate = vi.fn().mockResolvedValue({ focus })
    const { self } = await click('/dashboard/assessments', [{ url: 'https://app.example.com/dashboard', navigate, focus }])
    expect(navigate).toHaveBeenCalledWith('/dashboard/assessments')
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })

  it('opens a new window when the app is closed', async () => {
    const { self } = await click('/dashboard/assessments', [])
    expect(self.clients.openWindow).toHaveBeenCalledWith('/dashboard/assessments')
  })
})
