import { http } from '@/lib/http-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

/**
 * - unsupported: this browser/context cannot do web push (e.g. iPhone Safari outside an installed app)
 * - unavailable: the server has no push keys configured
 * - denied:      the user blocked notifications in the browser
 * - off / on:    permission is open / this device is subscribed
 */
export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on'

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** The Push API wants the VAPID key as bytes; the server sends it as base64url. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/vapid-public-key`)
    if (!res.ok) return null
    const { key } = await res.json()
    return typeof key === 'string' && key ? key : null
  } catch {
    return null
  }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready
}

function toServerBody(sub: PushSubscription) {
  const json = sub.toJSON()
  return { endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth }
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await (await registration()).pushManager.getSubscription()
  if (sub && Notification.permission === 'granted') return 'on'
  return (await fetchPublicKey()) ? 'off' : 'unavailable'
}

/** Must run from a user gesture (a click): browsers refuse the permission prompt otherwise. */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'

  const key = await fetchPublicKey()
  if (!key) return 'unavailable'

  const reg = await registration()
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }))
  await http.post('/push/subscribe', toServerBody(sub))
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  const sub = await (await registration()).pushManager.getSubscription()
  if (sub) {
    await http.delete('/push/subscribe', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe()
  }
  return Notification.permission === 'denied' ? 'denied' : 'off'
}

/**
 * Re-registers an existing subscription with the server (after login, on a new device record, or once
 * the server rotated). Never prompts: only acts when permission was already granted.
 */
export async function syncPushSubscription(): Promise<void> {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return
    const sub = await (await registration()).pushManager.getSubscription()
    if (sub) await http.post('/push/subscribe', toServerBody(sub))
  } catch {
    // Best effort: a failed sync must never surface as an error to the user.
  }
}
