import { describe, it, expect } from 'vitest'
import { BUILD_LABEL, BUILD_SHA } from '../build-info'

describe('build-info', () => {
  it('exposes a short label derived from the sha', () => {
    expect(typeof BUILD_SHA).toBe('string')
    expect(BUILD_LABEL).toBe(BUILD_SHA === 'dev' ? 'dev' : BUILD_SHA.slice(0, 7))
    expect(BUILD_LABEL.length).toBeLessThanOrEqual(7)
  })
})
