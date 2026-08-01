import { describe, it, expect } from 'vitest'
import { isChunkLoadError } from './error-reload'

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
