import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'
import { Card, CardHeader } from './Card'
import { ProgressBar, StreakDots } from './Progress'
import { Badge, EmptyState } from './Badge'
import { StatTile, ScoreChip } from './Stats'

describe('ds.Button', () => {
  it('renders with accessible name from children', () => {
    render(<Button>Save assessment</Button>)
    expect(screen.getByRole('button', { name: 'Save assessment' })).toBeTruthy()
  })
  it('defaults to type=button so forms don\'t submit accidentally', () => {
    render(<Button>Hi</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })
})

describe('ds.Card', () => {
  it('renders header as an h2 for heading hierarchy', () => {
    render(<Card><CardHeader title="This Week" /></Card>)
    expect(screen.getByRole('heading', { level: 2, name: 'This Week' })).toBeTruthy()
  })
})

describe('ds.Progress', () => {
  it('progressbar exposes value to assistive tech and text (not color alone)', () => {
    render(<ProgressBar value={72} label="Hymns mastered" />)
    const bar = screen.getByRole('progressbar', { name: 'Hymns mastered' })
    expect(bar.getAttribute('aria-valuenow')).toBe('72')
    expect(screen.getByText('72%')).toBeTruthy()
  })
  it('streak dots mark done days with a check glyph and today with aria-current', () => {
    render(<StreakDots days={[{ day: 'Sun', done: true }, { day: 'Mon', done: false, today: true }]} />)
    expect(screen.getByText('✓')).toBeTruthy()
    expect(document.querySelector('[aria-current="date"]')).toBeTruthy()
  })
})

describe('ds.Badge / EmptyState', () => {
  it('badge renders icon + text', () => {
    render(<Badge tone="gold"><span aria-hidden>★</span>Mastered</Badge>)
    expect(screen.getByText('Mastered')).toBeTruthy()
  })
  it('empty state provides a heading and next action', () => {
    render(<EmptyState title="No assessments yet" action={<button>Message servant</button>} />)
    expect(screen.getByRole('heading', { name: 'No assessments yet' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Message servant' })).toBeTruthy()
  })
})

describe('ds.Stats', () => {
  it('stat tile conveys delta direction via sr-only text, not just arrow/color', () => {
    render(<StatTile label="Attendance" value={92} delta="+4" deltaDirection="up" />)
    expect(screen.getByText(/increased/)).toBeTruthy()
  })
  it('score chip button exposes pressed state', () => {
    render(<ScoreChip level="excellent" size="lg" active onClick={() => {}} />)
    const chip = screen.getByRole('button', { pressed: true })
    expect(chip.textContent).toMatch(/excellent/i)
  })
})
