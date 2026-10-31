import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const post = vi.fn()
const del = vi.fn()
vi.mock('@/lib/http-client', () => ({ http: { post: (...a: unknown[]) => post(...a), delete: (...a: unknown[]) => del(...a) } }))

import { disablePush, enablePush, getPushState, isPushSupported, syncPushSubscription, urlBase64ToUint8Array } from './push'

const subscription = (endpoint = 'https://fcm.googleapis.com/x') => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: 'P256', auth: 'AUTH' } }),
  unsubscribe: vi.fn().mockResolvedValue(true),
})

let existing: ReturnType<typeof subscription> | null
let pushManager: { getSubscription: any; subscribe: any }
let permission: NotificationPermission
let requestPermission: any

function installBrowser({ supported = true }: { supported?: boolean } = {}) {
  existing = null
  pushManager = {
    getSubscription: vi.fn(async () => existing),
    subscribe: vi.fn(async () => { existing = subscription(); return existing }),
  }
  if (!supported) return
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } })
  ;(window as any).PushManager = function PushManager() {}
  requestPermission = vi.fn(async () => permission)
  ;(window as any).Notification = {
    get permission() { return permission },
    requestPermission,
  }
}

const serverKey = (key: string | null) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    key ? ({ ok: true, json: async () => ({ key }) } as Response) : ({ ok: false, json: async () => ({}) } as Response),
  )

beforeEach(() => {
  permission = 'default'
  post.mockReset().mockResolvedValue({})
  del.mockReset().mockResolvedValue({})
})
afterEach(() => {
  vi.restoreAllMocks()
  delete (navigator as any).serviceWorker
  delete (window as any).PushManager
  delete (window as any).Notification
})

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url with missing padding and url-safe characters', () => {
    // bytes 251,255,191 encode to "-_-_" in base64url ("+/+/" in standard base64)
    expect(Array.from(urlBase64ToUint8Array('-_-_'))).toEqual([251, 255, 191])
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(urlBase64ToUint8Array('AQI'))).toEqual([1, 2])
  })
})

describe('getPushState', () => {
  it('is unsupported without service worker / Push API', async () => {
    installBrowser({ supported: false })
    expect(isPushSupported()).toBe(false)
    expect(await getPushState()).toBe('unsupported')
  })

  it('is denied when the user blocked notifications', async () => {
    installBrowser(); permission = 'denied'
    expect(await getPushState()).toBe('denied')
  })

  it('is on when permission is granted and a subscription exists', async () => {
    installBrowser(); permission = 'granted'; existing = subscription()
    expect(await getPushState()).toBe('on')
  })

  it('is off when the server has a key to offer', async () => {
    installBrowser(); serverKey('KEY')
    expect(await getPushState()).toBe('off')
  })

  it('is unavailable when the server has push switched off', async () => {
    installBrowser(); serverKey(null)
    expect(await getPushState()).toBe('unavailable')
  })
})

describe('enablePush', () => {
  it('asks permission, subscribes with the server key and registers the device', async () => {
    installBrowser(); permission = 'granted'; serverKey('AQID')
    expect(await enablePush()).toBe('on')
    expect(requestPermission).toHaveBeenCalled()
    const opts = pushManager.subscribe.mock.calls[0][0]
    expect(opts.userVisibleOnly).toBe(true)
    expect(Array.from(opts.applicationServerKey)).toEqual([1, 2, 3])
    expect(post).toHaveBeenCalledWith('/push/subscribe', { endpoint: 'https://fcm.googleapis.com/x', p256dh: 'P256', auth: 'AUTH' })
  })

  it('reports denied and subscribes nothing when the user says no', async () => {
    installBrowser(); permission = 'denied'; serverKey('KEY')
    expect(await enablePush()).toBe('denied')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it('stays off if the prompt is dismissed', async () => {
    installBrowser(); permission = 'default'; serverKey('KEY')
    expect(await enablePush()).toBe('off')
    expect(post).not.toHaveBeenCalled()
  })

  it('reports unavailable when the server has no key', async () => {
    installBrowser(); permission = 'granted'; serverKey(null)
    expect(await enablePush()).toBe('unavailable')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
  })

  it('reuses an existing browser subscription instead of creating another', async () => {
    installBrowser(); permission = 'granted'; serverKey('KEY'); existing = subscription()
    await enablePush()
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(post).toHaveBeenCalled()
  })
})

describe('disablePush', () => {
  it('removes the device on the server and in the browser', async () => {
    installBrowser(); permission = 'granted'; const sub = (existing = subscription())
    expect(await disablePush()).toBe('off')
    expect(del).toHaveBeenCalledWith('/push/subscribe', { endpoint: sub.endpoint })
    expect(sub.unsubscribe).toHaveBeenCalled()
  })

  it('still unsubscribes the browser when the server call fails', async () => {
    installBrowser(); permission = 'granted'; const sub = (existing = subscription())
    del.mockRejectedValue(new Error('offline'))
    await disablePush()
    expect(sub.unsubscribe).toHaveBeenCalled()
  })
})

describe('syncPushSubscription', () => {
  it('re-registers an existing subscription when permission was already granted', async () => {
    installBrowser(); permission = 'granted'; existing = subscription()
    await syncPushSubscription()
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('never prompts and never registers without prior permission', async () => {
    installBrowser(); permission = 'default'; existing = subscription()
    await syncPushSubscription()
    expect(requestPermission).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it('swallows server errors', async () => {
    installBrowser(); permission = 'granted'; existing = subscription()
    post.mockRejectedValue(new Error('500'))
    await expect(syncPushSubscription()).resolves.toBeUndefined()
  })
})
