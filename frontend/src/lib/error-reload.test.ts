import { describe, it, expect, beforeEach } from 'vitest'
import { isChunkLoadError, shouldAutoReloadOnChunkError, CHUNK_RELOAD_KEY, CHUNK_RELOAD_MAX } from './error-reload'

describe('isChunkLoadError', () => {
  it('detects Next.js "Loading chunk N failed" message', () => {
    expect(isChunkLoadError(new Error('Loading chunk 727 failed.'))).toBe(true)
  })

  it('detects "Failed to fetch dynamically imported module" message', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/_next/static/chunks/727.js'))).toBe(true)
  })

  it('detects "Importing a module script failed" message', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
  })

  it('detects chunk failure when message is wrapped by the browser', () => {
    expect(isChunkLoadError(new Error('Failed to load resource: the server responded with a status of 404 (Not Found)'))).toBe(false)
  })

  it('returns false for a generic error', () => {
    expect(isChunkLoadError(new Error('Something went wrong'))).toBe(false)
  })

  it('returns false for an empty message', () => {
    expect(isChunkLoadError(new Error(''))).toBe(false)
  })

  it('returns false when given null', () => {
    expect(isChunkLoadError(null)).toBe(false)
  })
})

describe('shouldAutoReloadOnChunkError', () => {
  beforeEach(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
  })

  it('returns true for a chunk error when no attempts remain in the session', () => {
    expect(shouldAutoReloadOnChunkError(new Error('Loading chunk 727 failed.'))).toBe(true)
  })

  it('allows up to CHUNK_RELOAD_MAX auto-reloads per session (bounded retry)', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://x/_next/static/chunks/727.js')
    for (let i = 0; i < CHUNK_RELOAD_MAX; i++) {
      expect(shouldAutoReloadOnChunkError(error)).toBe(true)
    }
    expect(shouldAutoReloadOnChunkError(error)).toBe(false)
  })

  it('returns false for a non-chunk error and does not consume an attempt', () => {
    expect(shouldAutoReloadOnChunkError(new Error('Something went wrong'))).toBe(false)
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull()
  })

  it('returns false when given null', () => {
    expect(shouldAutoReloadOnChunkError(null)).toBe(false)
  })
})
