import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AttemptChip } from '../attempt-chip'

describe('AttemptChip', () => {
  it('renders the English label when the assessment allows several attempts', () => {
    render(<AttemptChip attempt={{ number: 2, max: 3 }} lang="en" />)
    expect(screen.getByText('Attempt 2 of 3')).toBeTruthy()
  })

  it('renders the Arabic label', () => {
    render(<AttemptChip attempt={{ number: 2, max: 3 }} lang="ar" />)
    expect(screen.getByText('المحاولة 2 من 3')).toBeTruthy()
  })

  it('renders nothing for a single-attempt assessment or when the attempt is missing', () => {
    const { container, rerender } = render(<AttemptChip attempt={{ number: 1, max: 1 }} lang="en" />)
    expect(container.firstChild).toBeNull()
    rerender(<AttemptChip attempt={undefined} lang="en" />)
    expect(container.firstChild).toBeNull()
  })
})
