import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import { TodaysSessionCard } from '../dashboard-client'

const mockGet = vi.fn()
const mockPut = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: vi.fn(), put: (...a: any[]) => mockPut(...a), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('motion/react', () => ({
  motion: { div: ({ children }: any) => <div>{children}</div> },
}))

vi.mock('@/lib/school', () => ({
  getSchoolId: () => 'school-1',
}))

beforeEach(() => {
  mockGet.mockReset()
  mockPut.mockReset()
})

it('ends an active class from the dashboard card', async () => {
  mockGet.mockImplementation((path: string) => {
    if (path === '/attendance/sessions') {
      return Promise.resolve({
        data: [{ id: 'sess-1', status: 'in_progress', group: { name: 'Group A' }, level: { name: 'Level 1' } }],
      })
    }
    if (path === '/attendance/sessions/sess-1') {
      return Promise.resolve({ attendanceRecords: [] })
    }
    return Promise.resolve({})
  })

  render(<TodaysSessionCard lang="en" />)

  const endButton = await screen.findByRole('button', { name: /end class/i })
  fireEvent.click(endButton)

  await waitFor(() => {
    expect(mockPut).toHaveBeenCalledWith('/attendance/sessions/sess-1', { status: 'completed' })
  })
})
