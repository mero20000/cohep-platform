import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResetPasswordPage from './page'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=valid-token'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  for (const name of ['Cross', 'Loader2', 'AlertCircle', 'CheckCircle2', 'Eye', 'EyeOff', 'ArrowLeft', 'KeyRound']) {
    icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return icons
})

const API = 'http://localhost:3001/api'

function createFetchMock(verifyOk = true) {
  return vi.fn((url: string | URL | RequestInfo, options?: any) => {
    const u = url.toString()
    if (u === `${API}/auth/reset-password/verify?token=valid-token`) {
      if (!verifyOk) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Invalid or expired reset link' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ valid: true, email: 'us••@example.com' }),
      } as Response)
    }
    if (u === `${API}/auth/reset-password` && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Password reset successfully. You can now sign in with your new password.' }),
      } as Response)
    }
    return Promise.reject(new Error(`Unhandled fetch: ${u}`))
  })
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = createFetchMock()
  })

  it('shows the masked email after verifying the token', async () => {
    render(<ResetPasswordPage />)
    expect(await screen.findByText(/us••@example\.com/i)).toBeInTheDocument()
  })

  it('shows an invalid-link message when verify fails', async () => {
    globalThis.fetch = createFetchMock(false)
    render(<ResetPasswordPage />)
    expect(await screen.findByText(/expired or invalid/i)).toBeInTheDocument()
  })

  it('does not submit when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText(/^new password$/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm/i), 'Different123!')
    await user.click(screen.getByRole('button', { name: /set new password/i }))

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // only the verify call
  })

  it('does not submit a password shorter than 8 characters', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText(/^new password$/i), 'Short1!')
    await user.type(screen.getByLabelText(/confirm/i), 'Short1!')
    await user.click(screen.getByRole('button', { name: /set new password/i }))

    expect(await screen.findByText(/minimum 8 characters/i)).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // only the verify call
  })

  it('submits the new password and shows success', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText(/^new password$/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm/i), 'NewPassword123!')
    await user.click(screen.getByRole('button', { name: /set new password/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API}/auth/reset-password`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"newPassword":"NewPassword123!"'),
        }),
      )
    })
    expect(await screen.findByText(/password has been changed successfully/i)).toBeInTheDocument()
    expect(await screen.findByText(/redirecting you to login/i)).toBeInTheDocument()
  })
})
