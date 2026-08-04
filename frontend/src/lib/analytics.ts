/**
 * Lightweight, self-hosted product analytics for the MEASURE bundle (C1–C4).
 *
 * Sends batched, low-sensitivity screen/action telemetry to
 * POST /api/analytics/events. Uses sessionStorage so each browser tab is one
 * app session; the server measures session length from real start/end and
 * keeps an idle heartbeat so lastActiveAt stays fresh.
 */

import { getSchoolId } from './school'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const SESSION_KEY = 'niangelos_session_id'
const HEARTBEAT_MS = 60_000
const FLUSH_MS = 5_000

interface Event {
  name: string
  category?: string
  properties?: Record<string, unknown>
}

let sessionId: string | null = null
let startTime: number | null = null
let buffer: Event[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

function currentUserId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const stored = localStorage.getItem('user')
    if (!stored) return undefined
    const u = JSON.parse(stored)
    return u?.id || undefined
  } catch {
    return undefined
  }
}

function currentLocale(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem('niangelos_language') || undefined
}

function ensureSession() {
  if (sessionId) return
  if (typeof window === 'undefined') return
  const existing = sessionStorage.getItem(SESSION_KEY)
  if (existing) {
    sessionId = existing
  } else {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(SESSION_KEY, id)
    sessionId = id
  }
  startTime = Date.now()
}

function send(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const token = localStorage.getItem('niangelos_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    void fetch(`${API}/analytics/events`, {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {})
  } catch {
    /* analytics must never throw into app code */
  }
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush(false)
  }, FLUSH_MS)
}

function flush(ending: boolean) {
  if (!sessionId) return
  const events = buffer
  buffer = []
  if (events.length === 0 && !ending) return

  const actionCount = events.filter((e) => e.category === 'action').length
  send({
    sessionId,
    userId: currentUserId(),
    schoolId: getSchoolId() || undefined,
    locale: currentLocale(),
    ...(ending
      ? { end: true, durationSec: startTime ? Math.round((Date.now() - startTime) / 1000) : undefined }
      : {}),
    ...(actionCount ? { actionCount } : {}),
    events,
  })
}

function startHeartbeat() {
  if (heartbeatTimer) return
  heartbeatTimer = setInterval(() => {
    // Only heartbeat a visible tab so backgrounded tabs don't skew "active" time.
    if (document.visibilityState !== 'hidden' && sessionId) {
      send({ sessionId, events: [] })
    }
  }, HEARTBEAT_MS)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

/** Call once on app mount to begin a session. */
export function startAnalytics() {
  if (typeof window === 'undefined') return
  ensureSession()
  send({
    sessionId,
    start: true,
    userId: currentUserId(),
    schoolId: getSchoolId() || undefined,
    locale: currentLocale(),
    entryPage: window.location.pathname,
    userAgent: navigator.userAgent.slice(0, 255),
    events: [{ name: 'session.start', category: 'session' }],
  })
  startHeartbeat()
}

/** Record a single event; batched and flushed a few seconds later. */
export function track(name: string, category?: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  ensureSession()
  buffer.push({ name, category, properties })
  scheduleFlush()
}

/** End the session (pagehide / tab closing) and flush anything buffered. */
export function endAnalytics() {
  if (!sessionId) return
  stopHeartbeat()
  flush(true)
}