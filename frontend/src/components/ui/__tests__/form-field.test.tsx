import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FormField } from '../form-field'

describe('FormField label association', () => {
  it('associates the label with the control', () => {
    render(<FormField label="Email" value="" onChange={() => {}} />)
    expect(screen.getByLabelText(/Email/)).toBe(screen.getByRole('textbox'))
  })

  it('keeps ids unique across two fields sharing a label', () => {
    // Previously the id came from the label text, so both fields got id
    // "email" and the second label pointed at the first field.
    render(
      <>
        <FormField label="Email" value="" onChange={() => {}} />
        <FormField label="Email" value="" onChange={() => {}} />
      </>,
    )
    const [a, b] = screen.getAllByRole('textbox')
    expect(a.id).not.toBe(b.id)
    expect(a.id).toBeTruthy()
  })

  it('honours an explicit fieldId', () => {
    render(<FormField label="Email" fieldId="my-email" value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox').id).toBe('my-email')
  })

  it('keeps a hidden label available to assistive tech', () => {
    render(<FormField label="Search" hideLabel value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
  })
})

describe('FormField validation state', () => {
  it('exposes required to assistive tech, not just as an asterisk', () => {
    render(<FormField label="Name" required value="" onChange={() => {}} />)
    const input = screen.getByRole('textbox')
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('marks the control invalid and links the error text', () => {
    render(<FormField label="Email" error="Enter a valid email" value="" onChange={() => {}} />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    const ids = input.getAttribute('aria-describedby')!.split(' ')
    const text = ids.map((id) => document.getElementById(id)?.textContent).join(' ')
    expect(text).toContain('Enter a valid email')
  })

  it('announces the error via a live region', () => {
    render(<FormField label="Email" error="Bad" value="" onChange={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Bad')
  })

  it('is not marked invalid when there is no error', () => {
    render(<FormField label="Email" value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
  })

  it('describes the control by both hint and error together', () => {
    // The hint usually carries the format the error is complaining about, so
    // hiding it exactly when the user got it wrong is the wrong trade.
    render(
      <FormField
        label="Mobile"
        hint="Use international format"
        error="Invalid number"
        value=""
        onChange={() => {}}
      />,
    )
    const ids = screen.getByRole('textbox').getAttribute('aria-describedby')!.split(' ')
    expect(ids).toHaveLength(2)
    const text = ids.map((id) => document.getElementById(id)?.textContent).join(' ')
    expect(text).toContain('Use international format')
    expect(text).toContain('Invalid number')
  })
})

describe('FormField variants', () => {
  it('renders a select and keeps the label and state wiring', () => {
    render(
      <FormField label="Gender" as="select" required error="Pick one" value="" onChange={() => {}}>
        <option value="male">Male</option>
      </FormField>,
    )
    const select = screen.getByLabelText(/Gender/)
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAttribute('aria-required', 'true')
  })

  it('renders a textarea and keeps the label wiring', () => {
    render(<FormField label="Notes" as="textarea" value="" onChange={() => {}} />)
    const el = screen.getByLabelText('Notes')
    expect(el.tagName).toBe('TEXTAREA')
  })
})

describe('FormField ref', () => {
  it('exposes the control so a form can focus the first invalid field', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<FormField label="Email" inputRef={ref} value="" onChange={() => {}} />)
    expect(ref.current).toBe(screen.getByRole('textbox'))
  })
})
