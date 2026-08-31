import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { useFormValidation } from '../use-form-validation'
import { email, matches, password, required, type Schema } from '@/lib/validation'
import { FormField } from '@/components/ui/form-field'

interface Form extends Record<string, unknown> {
  email: string
  password: string
  confirm: string
}

const schema: Schema<Form> = {
  email: [required({ en: 'Email', ar: 'البريد' }), email()],
  password: [required(), password()],
  confirm: [required(), matches<Form>('password')],
}

function Harness({ lang = 'en' as 'en' | 'ar' }) {
  const [values, setValues] = useState<Form>({ email: '', password: '', confirm: '' })
  const { fieldErrors, errorSummary, isValid, handleBlur, revalidate, validate, register } =
    useFormValidation({ values, schema, lang })

  const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [field]: e.target.value }
    setValues(next)
    // Passing `next` matters: without it the check lags one keystroke behind.
    revalidate(field, next)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (validate()) screen.getByTestId('status').textContent = 'submitted'
      }}
    >
      {errorSummary.length > 0 && (
        <div role="alert" data-testid="summary">
          {errorSummary.length} problem(s): {errorSummary.map((e) => String(e.field)).join(',')}
        </div>
      )}
      <FormField
        label="Email"
        value={values.email}
        error={fieldErrors.email}
        onChange={set('email')}
        onBlur={() => handleBlur('email')}
        inputRef={register('email')}
      />
      <FormField
        label="Password"
        type="password"
        value={values.password}
        error={fieldErrors.password}
        onChange={set('password')}
        onBlur={() => handleBlur('password')}
        inputRef={register('password')}
      />
      <FormField
        label="Confirm"
        type="password"
        value={values.confirm}
        error={fieldErrors.confirm}
        onChange={set('confirm')}
        onBlur={() => handleBlur('confirm')}
        inputRef={register('confirm')}
      />
      <span data-testid="valid">{String(isValid)}</span>
      <button type="submit">Submit</button>
    </form>
  )
}

describe('useFormValidation', () => {
  it('stays quiet until a field is touched', () => {
    render(<Harness />)
    expect(screen.queryByTestId('summary')).toBeNull()
    expect(screen.getByLabelText(/Email/)).not.toHaveAttribute('aria-invalid')
  })

  it('reports an error on blur and wires it to the control', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const emailInput = screen.getByLabelText(/Email/)
    await user.click(emailInput)
    await user.tab()

    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    const ids = emailInput.getAttribute('aria-describedby')!.split(' ')
    const text = ids.map((id) => document.getElementById(id)?.textContent).join(' ')
    expect(text).toContain('Email is required')
  })

  it('clears the error as the user fixes the field', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const emailInput = screen.getByLabelText(/Email/)
    await user.click(emailInput)
    await user.tab()
    expect(emailInput).toHaveAttribute('aria-invalid', 'true')

    await user.type(emailInput, 'someone@example.com')
    expect(emailInput).not.toHaveAttribute('aria-invalid')
  })

  it('clears the error on the exact keystroke that fixes it, not the one after', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const emailInput = screen.getByLabelText(/Email/)
    await user.click(emailInput)
    await user.tab()

    // "a@b.co" is the first valid value; typing exactly it must clear the
    // error. A stale-values revalidate would still show invalid here and only
    // recover on the next keystroke.
    await user.type(emailInput, 'a@b.co')
    expect(emailInput).not.toHaveAttribute('aria-invalid')
  })

  it('does not report an untouched field while typing in it', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // Typing a partial address must not flash "invalid email" before blur.
    await user.type(screen.getByLabelText(/Email/), 'som')
    expect(screen.getByLabelText(/Email/)).not.toHaveAttribute('aria-invalid')
  })

  it('validates everything on submit and blocks it', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByText('Submit'))
    expect(screen.getByTestId('summary')).toHaveTextContent('3 problem(s)')
  })

  it('moves focus to the first invalid field on a failed submit', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByText('Submit'))
    // focusField defers a frame so the error paint does not steal focus back.
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(document.activeElement).toBe(screen.getByLabelText(/Email/))
  })

  it('orders the summary by the schema, not by discovery order', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // Touch confirm first, then submit; email must still be listed first so the
    // summary matches the visual field order.
    await user.click(screen.getByLabelText(/Confirm/))
    await user.tab()
    await user.click(screen.getByText('Submit'))
    expect(screen.getByTestId('summary')).toHaveTextContent('email,password,confirm')
  })

  it('enforces the cross-field confirm rule', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/^Password/), 'LongEnough1')
    await user.type(screen.getByLabelText(/Confirm/), 'Different1')
    await user.tab()

    expect(screen.getByLabelText(/Confirm/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('resolves messages in Arabic', async () => {
    const user = userEvent.setup()
    render(<Harness lang="ar" />)

    const emailInput = screen.getByLabelText(/Email/)
    await user.click(emailInput)
    await user.tab()

    const ids = emailInput.getAttribute('aria-describedby')!.split(' ')
    const text = ids.map((id) => document.getElementById(id)?.textContent).join(' ')
    // Previously every validation message was hard-coded English.
    expect(text).toContain('البريد')
  })
})
