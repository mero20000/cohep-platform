import { render, screen, fireEvent } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import { NextSessionCard } from '../dashboard-client'

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

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('motion/react', () => ({
  motion: { div: ({ children }: any) => <div>{children}</div> },
}))

vi.mock('@/lib/school', () => ({
  getSchoolId: () => 'school-1',
}))

const levels = [
  { id: 'l1', number: 1, name: 'Level 1' },
  { id: 'l2', number: 2, name: 'Level 2' },
]

const allocations = [
  { id: 'a1', scheduledDate: null, level: { number: 1, name: 'Level 1' }, lesson: { id: 'les1' } },
  { id: 'a2', scheduledDate: null, level: { number: 2, name: 'Level 2' }, lesson: { id: 'les2' } },
]

const lessons = [
  { id: 'les1', title: 'Item One', subject: { name: 'Hymns' } },
  { id: 'les2', title: 'Item Two', subject: { name: 'Hymns' } },
]

vi.mock('@/components/curriculum/hooks', () => ({
  useAcademicYearsQuery: () => ({ data: [{ id: 'ay1', isCurrent: true }], isLoading: false }),
  useAllAllocationsQuery: () => ({ data: allocations, isLoading: false }),
  useLessonsQuery: () => ({ data: lessons, isLoading: false }),
  useLevelsQuery: () => ({ data: levels, isLoading: false }),
}))

beforeEach(() => {
  mockGet.mockReset()
})

it('shows an All tab plus a tab per configured level in admin mode', () => {
  render(<NextSessionCard lang="en" />)
  expect(screen.getByRole('button', { name: 'All' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Level 1' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Level 2' })).toBeTruthy()
  // All view lists the digest for the relevant day (upstream card redesign:
  // one day's items rather than every level's full list).
  expect(screen.getAllByText(/Item One|Item Two/).length).toBeGreaterThan(0)
})

it('filters items to the selected level tab', () => {
  render(<NextSessionCard lang="en" />)
  fireEvent.click(screen.getByRole('button', { name: 'Level 1' }))
  expect(screen.getByText('Item One')).toBeTruthy()
  expect(screen.queryByText('Item Two')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Level 2' }))
  expect(screen.getByText('Item Two')).toBeTruthy()
  expect(screen.queryByText('Item One')).toBeNull()
})