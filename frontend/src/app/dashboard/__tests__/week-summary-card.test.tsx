import { render, screen } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import { WeekSummaryCard } from '../dashboard-client'

const mockGet = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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
})

it('renders the week summary counts', () => {
  render(
    <WeekSummaryCard
      lang="en"
      thisWeek={{ present: 2, late: 1, absent: 1, excused: 1, total: 5, attendanceRate: 60 }}
    />,
  )
  expect(screen.getByText('This Week Summary')).toBeTruthy()
  expect(screen.getByText('Present')).toBeTruthy()
  expect(screen.getByText('Late')).toBeTruthy()
  expect(screen.getByText('Absent')).toBeTruthy()
  expect(screen.getByText('Excused')).toBeTruthy()
  expect(screen.getByText('Attendance Rate: 60%')).toBeTruthy()
})

it('renders nothing when thisWeek is missing', () => {
  const { container } = render(<WeekSummaryCard lang="en" thisWeek={null} />)
  expect(container).toBeEmptyDOMElement()
})
