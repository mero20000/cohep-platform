import { describe, it, expect, vi, afterEach } from 'vitest'
import { setAppBadge } from './app-badge'

const nav = navigator as any

afterEach(() => {
  delete nav.setAppBadge
  delete nav.clearAppBadge
})

describe('setAppBadge', () => {
  it('sets the badge to the unread count', () => {
    nav.setAppBadge = vi.fn().mockResolvedValue(undefined)
    nav.clearAppBadge = vi.fn().mockResolvedValue(undefined)
    setAppBadge(7)
    expect(nav.setAppBadge).toHaveBeenCalledWith(7)
    expect(nav.clearAppBadge).not.toHaveBeenCalled()
  })

  it('clears the badge at zero', () => {
    nav.setAppBadge = vi.fn().mockResolvedValue(undefined)
    nav.clearAppBadge = vi.fn().mockResolvedValue(undefined)
    setAppBadge(0)
    expect(nav.clearAppBadge).toHaveBeenCalled()
    expect(nav.setAppBadge).not.toHaveBeenCalled()
  })

  it('does nothing where the Badging API is missing', () => {
    expect(() => setAppBadge(3)).not.toThrow()
  })

  it('swallows both synchronous and asynchronous failures', async () => {
    nav.setAppBadge = vi.fn().mockRejectedValue(new Error('not installed'))
    expect(() => setAppBadge(1)).not.toThrow()
    nav.setAppBadge = vi.fn(() => { throw new Error('sync boom') })
    expect(() => setAppBadge(2)).not.toThrow()
    await Promise.resolve()
  })
})
