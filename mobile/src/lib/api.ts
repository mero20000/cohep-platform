import { API_URL } from './config'
import { clearSession, getSavedSession } from './session'
import type { HymnMapItem, MasteryLevel, PortalData } from './types'

export class UnauthorizedError extends Error {}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

let unauthorizedHandler: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, `API responded ${res.status}`)
  return (await res.json()) as T
}

export async function loginRequest(portalAccessKey: string): Promise<{ accessToken: string }> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/student-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalAccessKey }),
    })
  } catch {
    throw new ApiError(0, 'No connection — check your internet and try again.')
  }
  if (res.status === 400 || res.status === 401 || res.status === 404) {
    throw new ApiError(res.status, 'Invalid access key.')
  }
  return parseJson<{ accessToken: string }>(res)
}

async function requireSession() {
  const session = await getSavedSession()
  if (!session) throw new UnauthorizedError('No active session')
  return session
}

export async function apiFetch<T>(path: string): Promise<T> {
  const session = await requireSession()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
  } catch {
    throw new ApiError(0, 'No connection — check your internet and try again.')
  }
  if (res.status === 401) {
    await clearSession()
    unauthorizedHandler?.()
    throw new UnauthorizedError('Session expired')
  }
  return parseJson<T>(res)
}

async function portalPath(suffix = ''): Promise<string> {
  const session = await requireSession()
  return `/student-portal/${session.studentCode}${suffix}`
}

export const fetchPortalData = (): Promise<PortalData> =>
  portalPath().then(p => apiFetch<PortalData>(p))

export const fetchHymnMap = (): Promise<HymnMapItem[]> =>
  portalPath('/hymn-map').then(p => apiFetch<HymnMapItem[]>(p))

export const MASTERY_META: Record<MasteryLevel, { label: string; color: string }> = {
  not_started: { label: 'Not started', color: '#9ca3af' },
  introduced: { label: 'Introduced', color: '#38bdf8' },
  practicing: { label: 'Practicing', color: '#f59e0b' },
  known: { label: 'Known', color: '#34d399' },
  mastered: { label: 'Mastered', color: '#d4af37' },
}
