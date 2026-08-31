import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from '../modal'

vi.mock('lucide-react', () => ({
  X: (props: any) => <span data-testid="icon-x" {...props} />,
}))

function Harness({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Background button</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit student" description="Details">
        {children ?? (
          <>
            <input aria-label="first" />
            <input aria-label="last" />
          </>
        )}
      </Modal>
    </>
  )
}

describe('Modal dialog semantics', () => {
  it('puts the dialog role on the panel, named by its title', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open'))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Edit student')
    expect(dialog).toHaveAccessibleDescription('Details')
    // The panel is the focused element, so the role must live there rather than
    // on the backdrop.
    expect(dialog.className).toContain('rounded-2xl')
  })

  it('gives two simultaneous modals distinct title ids', async () => {
    render(
      <>
        <Modal open onClose={() => {}} title="First">
          <span>a</span>
        </Modal>
        <Modal open onClose={() => {}} title="Second">
          <span>b</span>
        </Modal>
      </>,
    )
    const [a, b] = screen.getAllByRole('dialog')
    const idA = a.getAttribute('aria-labelledby')
    const idB = b.getAttribute('aria-labelledby')
    expect(idA).not.toBe(idB)
    expect(a).toHaveAccessibleName('First')
    expect(b).toHaveAccessibleName('Second')
  })
})

describe('Modal focus trap', () => {
  it('cycles Tab from the last focusable back to the first', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open'))

    const close = screen.getByLabelText('Close')
    const first = screen.getByLabelText('first')
    const last = screen.getByLabelText('last')

    last.focus()
    await user.tab()
    // Without a trap this landed on the page behind the dialog.
    expect([close, first]).toContain(document.activeElement)
  })

  it('cycles Shift+Tab from the first focusable back to the last', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open'))

    const close = screen.getByLabelText('Close')
    close.focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByLabelText('last'))
  })

  it('never lets Tab reach the background button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open'))

    const background = screen.getByText('Background button')
    for (let i = 0; i < 8; i++) {
      await user.tab()
      expect(document.activeElement).not.toBe(background)
    }
  })

  it('keeps focus on the panel when nothing inside is focusable', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={() => {}}>
        <span>Just text</span>
      </Modal>,
    )
    const panel = screen.getByRole('dialog')
    panel.focus()
    await user.tab()
    expect(document.activeElement).toBe(panel)
  })
})

describe('Modal close behaviour', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    // AnimatePresence keeps the panel mounted through its exit animation.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
