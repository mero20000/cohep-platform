import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const lang = vi.hoisted(() => ({ current: 'en' as 'en' | 'ar' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => lang.current }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/image', () => ({
  default: ({ alt = '', ...rest }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img alt={alt as string} {...rest} />
  ),
}))

import RegisterPage from '../page'

beforeEach(() => {
  lang.current = 'en'
  vi.restoreAllMocks()
})

/** The error text rendered for a field, read through its aria wiring. */
function errorFor(field: string): string {
  const input = document.getElementById(field)
  if (!input) return ''
  const ids = input.getAttribute('aria-describedby')
  if (!ids) {
    // The register page renders its own <p> next to the input rather than via
    // FormField, so fall back to the sibling error text.
    return input.parentElement?.parentElement?.textContent ?? ''
  }
  return ids
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

describe('register form validation', () => {
  it('blocks step 1 and reports each empty required field', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: /Continue|Next/i }))

    await waitFor(() => {
      expect(errorFor('churchName')).toMatch(/Church name is required/)
    })
    expect(errorFor('email')).toMatch(/Email is required/)
    expect(errorFor('password')).toMatch(/Password is required/)
  })

  it('does not advance past step 1 while invalid', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: /Continue|Next/i }))
    // Step 2's fields must not be reachable yet.
    expect(document.getElementById('firstName')).toBeNull()
  })

  it('advances once step 1 is valid', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(document.getElementById('churchName')!, 'St. Mark')
    await user.type(document.getElementById('email')!, 'someone@example.com')
    await user.type(document.getElementById('password')!, 'LongEnough1')
    await user.type(document.getElementById('confirmPassword')!, 'LongEnough1')

    await user.click(screen.getByRole('button', { name: /Continue|Next/i }))

    await waitFor(() => {
      expect(document.getElementById('firstName')).not.toBeNull()
    })
  })

  it('reports a bad email format on blur', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(document.getElementById('email')!, 'not-an-email')
    await user.tab()

    await waitFor(() => {
      expect(errorFor('email')).toMatch(/valid email/)
    })
  })

  it('catches a mismatched password confirmation', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(document.getElementById('password')!, 'LongEnough1')
    await user.type(document.getElementById('confirmPassword')!, 'Different1')
    await user.tab()

    await waitFor(() => {
      expect(errorFor('confirmPassword')).toMatch(/do not match/)
    })
  })

  it('reports the specific unmet password requirement', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(document.getElementById('password')!, 'alllowercase1')
    await user.tab()

    await waitFor(() => {
      expect(errorFor('password')).toMatch(/uppercase/)
    })
  })

  it('reports validation errors in Arabic', async () => {
    lang.current = 'ar'
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: /متابعة|التالي|Continue|Next/i }))

    await waitFor(() => {
      // These messages were hard-coded English before the migration.
      expect(errorFor('churchName')).toMatch(/اسم الكنيسة/)
    })
  })
})
