import { describe, it, expect, vi } from 'vitest'

const redirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: (...a: any[]) => redirect(...a) }))

describe('retired liturgy attendance pages', () => {
  it('send old links to the unified Sessions page with the liturgy dialog open', async () => {
    const { default: Page } = await import('../page')
    Page()
    expect(redirect).toHaveBeenCalledWith('/dashboard/attendance/sessions?new=liturgy')
  })

  it('the old create page opens the dialog without "start now"', async () => {
    const { default: Page } = await import('../create/page')
    Page()
    expect(redirect).toHaveBeenCalledWith('/dashboard/attendance/sessions?new=liturgy&start=0')
  })
})
