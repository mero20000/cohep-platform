import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const store = new Map<string, string>()
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}))
vi.mock('@expo/vector-icons', () => ({}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { AuthProvider, useAuth } from '../lib/auth'

function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

beforeEach(() => {
  store.clear()
  fetchMock.mockReset()
})

describe('AuthProvider', () => {
  it('restores an existing session on mount', async () => {
    store.set('cohep.portal.session', JSON.stringify({ token: 't', studentCode: 'c' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.session).toEqual({ token: 't', studentCode: 'c' })
  })

  it('login stores session and resolves true on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(201, { accessToken: 'jwt' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    let ok = false
    await act(async () => {
      ok = await result.current.login(' KEY ')
    })
    expect(ok).toBe(true)
    expect(result.current.session).toEqual({ token: 'jwt', studentCode: 'KEY' })
  })

  it('login surfaces a friendly error and returns false on bad key', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, {}))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    let ok = true
    await act(async () => {
      ok = await result.current.login('NOPE')
    })
    expect(ok).toBe(false)
    expect(result.current.loginError).toBe('Invalid access key.')
  })

  it('logout clears the stored session', async () => {
    store.set('cohep.portal.session', JSON.stringify({ token: 't', studentCode: 'c' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.session).not.toBeNull())
    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.session).toBeNull()
  })
})
