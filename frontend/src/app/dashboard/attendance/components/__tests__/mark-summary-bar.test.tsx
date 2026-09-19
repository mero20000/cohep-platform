import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkSummaryBar } from '../mark-summary-bar'

describe('MarkSummaryBar', () => {
  it('exposes Present/Late/Absent/Excused text labels (not color-only) and names the live region', () => {
    render(
      <MarkSummaryBar present={1} late={2} absent={0} excused={1} marked={4} total={4} dirty={false} error="" onRetry={() => {}} lang="en" />,
    )
    for (const label of ['Present', 'Late', 'Absent', 'Excused']) {
      expect(screen.getByText(label, { exact: false })).toBeInTheDocument()
    }
    const live = screen.getByRole('status')
    expect(live).toHaveAttribute('aria-label', expect.stringContaining('Present'))
  })
})
