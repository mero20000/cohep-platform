import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from '../modal'

vi.mock('lucide-react', () => ({
  X: (props: any) => <span data-testid="icon-x" {...props} />,
}))

function Harness() {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState('')
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="T">
        <input aria-label="field" value={val} onChange={(e) => setVal(e.target.value)} />
      </Modal>
    </>
  )
}

describe('Modal focus retention while typing', () => {
  it('does not steal focus from the input on re-render', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByText('Open'))
    const input = screen.getByLabelText('field') as HTMLInputElement
    await user.click(input)
    await user.type(input, 'a')

    // After typing, focus must remain inside the modal input, not on the trigger button.
    expect(document.activeElement).toBe(input)
  })
})
