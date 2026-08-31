import React, { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatePicker } from '../date-picker'

const lang = vi.hoisted(() => ({ current: 'en' as 'en' | 'ar' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => lang.current }))

beforeEach(() => {
  lang.current = 'en'
})

function Harness({ initial = '', ...rest }: { initial?: string } & Record<string, unknown>) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="d">Date</label>
      <DatePicker id="d" value={value} onChange={setValue} {...rest} />
      <span data-testid="value">{value}</span>
    </>
  )
}

// Scoped to the text input by id: once the calendar is open the month and year
// <select>s are comboboxes too, so a bare role query is ambiguous.
const field = () => document.getElementById('d') as HTMLInputElement
const value = () => screen.getByTestId('value').textContent

describe('DatePicker field semantics', () => {
  it('exposes itself as a closed combobox that owns a dialog', () => {
    render(<Harness />)
    expect(field()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(field()).toHaveAttribute('aria-expanded', 'false')
  })

  it('reflects required and invalid state, and links its error message', () => {
    render(<Harness required error="Pick a date" />)
    expect(field()).toHaveAttribute('aria-required', 'true')
    expect(field()).toHaveAttribute('aria-invalid', 'true')

    const describedBy = field().getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toBe('Pick a date')
  })

  it('has no aria-invalid when valid', () => {
    render(<Harness />)
    expect(field()).not.toHaveAttribute('aria-invalid')
  })
})

describe('DatePicker keyboard access', () => {
  it('opens from the keyboard, which was previously impossible', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.tab()
    expect(field()).toHaveFocus()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens with ArrowDown and moves focus into the grid at the selected day', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    const focused = document.activeElement as HTMLElement
    expect(focused.getAttribute('aria-label')).toContain('June 15, 2025')
  })

  it('arrow keys move focus without committing a value', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    await user.keyboard('{ArrowRight}')

    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toContain(
      'June 16, 2025',
    )
    // Browsing must not change the value — only Enter/click commits.
    expect(value()).toBe('2025-06-15')
  })

  it('ArrowDown moves a week, and Enter commits the focused day', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    await user.keyboard('{ArrowDown}{Enter}')

    expect(value()).toBe('2025-06-22')
    expect(screen.queryByRole('dialog')).toBeNull()
    // Focus returns to the field rather than being lost to the body.
    expect(field()).toHaveFocus()
  })

  it('crosses a month boundary when arrowing past the end', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-30" />)

    await user.click(field())
    await user.keyboard('{ArrowRight}{Enter}')
    expect(value()).toBe('2025-07-01')
  })

  it('Home and End jump to the ends of the month', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    await user.keyboard('{Home}{Enter}')
    expect(value()).toBe('2025-06-01')

    await user.click(field())
    await user.keyboard('{End}{Enter}')
    expect(value()).toBe('2025-06-30')
  })

  it('PageUp and PageDown step a month, Shift a year', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    await user.keyboard('{PageDown}{Enter}')
    expect(value()).toBe('2025-07-15')

    await user.click(field())
    await user.keyboard('{Shift>}{PageUp}{/Shift}{Enter}')
    expect(value()).toBe('2024-07-15')
  })

  it('Escape closes without committing and restores focus to the field', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    await user.keyboard('{ArrowRight}{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(value()).toBe('2025-06-15')
    expect(field()).toHaveFocus()
  })

  it('keeps one tab stop for the whole month via roving tabindex', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    const grid = screen.getByRole('grid')
    const tabbable = within(grid)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
  })
})

describe('DatePicker min/max', () => {
  it('will not commit an out-of-range day but still lets focus pass over it', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" max="2025-06-16" />)

    await user.click(field())
    // 17th is beyond max: reachable, marked disabled, not committable.
    await user.keyboard('{ArrowRight}{ArrowRight}')
    const active = document.activeElement as HTMLElement
    expect(active.getAttribute('aria-label')).toContain('June 17, 2025')
    expect(active).toHaveAttribute('aria-disabled', 'true')

    await user.keyboard('{Enter}')
    expect(value()).toBe('2025-06-15')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('DatePicker grid structure', () => {
  it('nests rows and cells so position is announced', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    const grid = screen.getByRole('grid')
    // A header row plus one row per week of June 2025.
    expect(within(grid).getAllByRole('row').length).toBeGreaterThan(1)
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7)
    expect(within(grid).getAllByRole('gridcell').length).toBeGreaterThanOrEqual(30)
  })

  it("marks today with aria-current and the selection with aria-selected", async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`

    render(<Harness initial={today} />)
    await user.click(field())

    expect(document.querySelector('[aria-current="date"]')).toBeTruthy()
    expect(document.querySelector('[role="gridcell"][aria-selected="true"]')).toBeTruthy()
  })
})

describe('DatePicker in Arabic', () => {
  it('mirrors the horizontal arrows so ArrowLeft moves the way it points', async () => {
    lang.current = 'ar'
    const user = userEvent.setup()
    render(<Harness initial="2025-06-15" />)

    await user.click(field())
    // RTL: the visual "next" direction is left.
    await user.keyboard('{ArrowLeft}{Enter}')
    expect(value()).toBe('2025-06-16')
  })
})
