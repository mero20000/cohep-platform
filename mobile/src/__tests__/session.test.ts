import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, string>()
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}))

import { saveSession, getSavedSession, clearSession } from '../lib/session'

beforeEach(() => store.clear())

describe('session storage', () => {
  it('round-trips a session', async () => {
    await saveSession({ token: 't1', studentCode: 'c1' })
    await expect(getSavedSession()).resolves.toEqual({ token: 't1', studentCode: 'c1' })
  })

  it('returns null when nothing saved', async () => {
    await expect(getSavedSession()).resolves.toBeNull()
  })

  it('returns null on corrupt JSON', async () => {
    store.set('cohep.portal.session', '{oops')
    await expect(getSavedSession()).resolves.toBeNull()
  })

  it('returns null when required fields are missing', async () => {
    store.set('cohep.portal.session', JSON.stringify({ token: 'x' }))
    await expect(getSavedSession()).resolves.toBeNull()
  })

  it('clearSession removes it', async () => {
    await saveSession({ token: 't', studentCode: 'c' })
    await clearSession()
    await expect(getSavedSession()).resolves.toBeNull()
  })
})
