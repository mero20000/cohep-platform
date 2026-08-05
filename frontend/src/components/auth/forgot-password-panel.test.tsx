import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ForgotPasswordPanel from './forgot-password-panel'

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  for (const name of ['Loader2', 'AlertCircle', 'CheckCircle2', 'KeyRound']) {
    icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return icons
})

const API = 'http://localhost:3001/api'

function createFetchMock(ok = true) {
  return vi.fn((url: string | URL | RequestInfo, options?: any) => {
    if (url.toString() === `${API}/auth/forgot-password` && options?.method === 'POST') {
      if (!ok) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Too many requests' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'If an account exists, a reset link was sent.' }),
      } as Response)
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`))
  })
}

describe('ForgotPasswordPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = createFetchMock()
  })

  it('submits email and shows the generic success message', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPanel />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API}/auth/forgot-password`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"email":"user@example.com"'),
        }),
      )
    })
    expect(await screen.findByText(/If an account exists, a reset link was sent/i)).toBeInTheDocument()
  })

  it('includes schoolIdentifier when provided', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPanel defaultSchoolId="niangelos-main" />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API}/auth/forgot-password`,
        expect.objectContaining({ body: expect.stringContaining('"schoolIdentifier":"niangelos-main"') }),
      )
    })
  })

  it('shows the server error message on failure', async () => {
    globalThis.fetch = createFetchMock(false)
    const user = userEvent.setup()
    render(<ForgotPasswordPanel />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Too many requests')).toBeInTheDocument()
  })

  it('does not submit an empty email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPanel />)

    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('prefills the default email', () => {
    render(<ForgotPasswordPanel defaultEmail="mina@example.com" />)
    expect(screen.getByLabelText(/email/i)).toHaveValue('mina@example.com')
  })
})
