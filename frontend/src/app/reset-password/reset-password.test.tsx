import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResetPasswordPage from './page'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=valid-token'),
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
  for (const name of ['Cross', 'Loader2', 'AlertCircle', 'CheckCircle2', 'Eye', 'EyeOff']) {
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
        json: () => Promise.resolve({ email: 'us••@example.com' }),
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
    expect(await screen.findByText(/invalid or expired/i)).toBeInTheDocument()
  })

  it('does not submit when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText(/new password/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm/i), 'Different123!')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // only the verify call
  })

  it('submits the new password and shows success', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText(/new password/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm/i), 'NewPassword123!')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API}/auth/reset-password`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"newPassword":"NewPassword123!"'),
        }),
      )
    })
    expect(await screen.findByText(/password reset successfully/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument()
  })
})
