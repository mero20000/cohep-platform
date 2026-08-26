import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, string>()
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}))

import { saveSession, clearSession } from '../lib/session'
import { apiFetch, loginRequest, UnauthorizedError, setUnauthorizedHandler } from '../lib/api'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

beforeEach(() => {
  store.clear()
  fetchMock.mockReset()
})

describe('loginRequest', () => {
  it('posts the access key and returns accessToken', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(201, { accessToken: 'jwt' }))
    await expect(loginRequest('KEY')).resolves.toEqual({ accessToken: 'jwt' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/student-portal/login'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ portalAccessKey: 'KEY' }) }),
    )
  })

  it('maps 401 to ApiError invalid key', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, {}))
    await expect(loginRequest('BAD')).rejects.toThrow(/Invalid access key/)
  })

  it('maps network failure to friendly ApiError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(loginRequest('KEY')).rejects.toThrow(/connection/)
  })
})

describe('apiFetch', () => {
  it('injects Bearer token from saved session', async () => {
    await saveSession({ token: 'jwt', studentCode: 'CODE' })
    fetchMock.mockResolvedValueOnce(jsonRes(200, { hello: 1 }))
    await expect(apiFetch('/student-portal/CODE')).resolves.toEqual({ hello: 1 })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer jwt')
  })

  it('throws UnauthorizedError immediately without a session', async () => {
    await expect(apiFetch('/anything')).rejects.toBeInstanceOf(UnauthorizedError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('on 401 clears session and fires handler', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    await saveSession({ token: 'old', studentCode: 'C' })
    fetchMock.mockResolvedValueOnce(jsonRes(401, {}))
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(UnauthorizedError)
    expect(handler).toHaveBeenCalled()
    await expect(import('../lib/session').then(m => m.getSavedSession())).resolves.toBeNull()
  })
})
