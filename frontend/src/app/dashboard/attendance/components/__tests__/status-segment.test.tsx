import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusSegment } from '../status-segment'

describe('StatusSegment', () => {
  it('renders 4 labeled 44px targets with aria-pressed', () => {
    const onChange = vi.fn()
    render(<StatusSegment value="present" onChange={onChange} lang="en" studentName="Mina" />)
    const btn = screen.getByRole('button', { name: /Present - Mina/i })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(btn.className).toMatch(/min-h-\[44px\]|min-w-\[44px\]/)
    fireEvent.click(screen.getByRole('button', { name: /Late - Mina/i }))
    expect(onChange).toHaveBeenCalledWith('late')
  })
})
