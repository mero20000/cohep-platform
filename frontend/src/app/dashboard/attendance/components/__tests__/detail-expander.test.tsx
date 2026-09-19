import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetailExpander } from '../detail-expander'

function setup(overrides = {}) {
  const props = {
    behavior: 0,
    participation: 0,
    liturgy: false,
    note: '',
    onBehaviorChange: vi.fn(),
    onParticipationChange: vi.fn(),
    onLiturgyChange: vi.fn(),
    onNoteChange: vi.fn(),
    lang: 'en' as const,
    ...overrides,
  }
  render(<DetailExpander {...props} />)
  return props
}

describe('DetailExpander', () => {
  it('click-N-sets-N for behavior stars', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Behavior 3 of 5' }))
    expect(props.onBehaviorChange).toHaveBeenCalledWith(3)
  })

  it('Clear resets behavior to 0', () => {
    const props = setup({ behavior: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Clear Behavior' }))
    expect(props.onBehaviorChange).toHaveBeenCalledWith(0)
  })
})
