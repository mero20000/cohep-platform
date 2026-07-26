import { type Announcement } from './announcement-types'

const STORAGE_KEY = 'niangelos_announcements'

function loadAll(): Announcement[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveAll(list: Announcement[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch {}
}

export function lsFetch(): Announcement[] {
  return loadAll()
}

export function lsCreate(data: Partial<Announcement>): Announcement {
  const list = loadAll()
  const now = new Date().toISOString()
  const item: Announcement = {
    title: data.title || '',
    titleAr: data.titleAr,
    body: data.body || '',
    bodyAr: data.bodyAr,
    priority: data.priority || 'normal',
    targetRoles: data.targetRoles || [],
    createdBy: { id: 'local', firstName: 'Local', lastName: 'User' },
    ...data,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  }
  list.unshift(item)
  saveAll(list)
  return item
}

export function lsUpdate(id: string, changes: Partial<Announcement>): Announcement | null {
  const list = loadAll()
  const idx = list.findIndex(a => a.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...changes, updatedAt: new Date().toISOString() }
  saveAll(list)
  return list[idx]
}

export function lsDelete(id: string): boolean {
  const list = loadAll().filter(a => a.id !== id)
  saveAll(list)
  return true
}

export function lsPublish(id: string): Announcement | null {
  return lsUpdate(id, { publishedAt: new Date().toISOString() })
}
