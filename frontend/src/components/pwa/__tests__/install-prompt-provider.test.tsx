import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

vi.mock('@/lib/use-install-prompt', () => ({
  recordVisit: vi.fn(),
  useInstallPrompt: () => ({
    shouldShow: true,
    surface: 'android',
    promptInstall: vi.fn(),
    dismiss: vi.fn(),
    markInstalled: vi.fn(),
  }),
}))

vi.mock('@/components/pwa/install-app-modal', () => ({
  default: () => <div data-testid="install-modal" />,
}))

import InstallPromptProvider from '../install-prompt-provider'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

async function renderAt(path: string) {
  pathname = path
  render(<InstallPromptProvider />)
  await act(async () => { vi.advanceTimersByTime(3000) })
}

describe('InstallPromptProvider', () => {
  it('offers the install prompt on regular pages', async () => {
    await renderAt('/dashboard')
    expect(screen.queryByTestId('install-modal')).not.toBeNull()
  })

  it.each(['/student-portal', '/student-portal/login', '/student-portal/abc-123'])(
    'never offers the install prompt on %s',
    async (path) => {
      await renderAt(path)
      expect(screen.queryByTestId('install-modal')).toBeNull()
    },
  )

  it('does not treat look-alike paths as the student portal', async () => {
    await renderAt('/student-portals-info')
    expect(screen.queryByTestId('install-modal')).not.toBeNull()
  })
})
