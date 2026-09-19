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

const hookMocks = vi.hoisted(() => ({
  allocations: vi.fn(),
  lessons: vi.fn(),
}))
hookMocks.allocations.mockReturnValue({ data: allocations, isLoading: false })
hookMocks.lessons.mockReturnValue({ data: lessons, isLoading: false })
vi.mock('@/components/curriculum/hooks', () => ({
  useAcademicYearsQuery: () => ({ data: [{ id: 'ay1', isCurrent: true }], isLoading: false }),
  useAllAllocationsQuery: (...a: any[]) => hookMocks.allocations(...a),
  useLessonsQuery: (...a: any[]) => hookMocks.lessons(...a),
  useLevelsQuery: () => ({ data: levels, isLoading: false }),
}))

beforeEach(() => {
  mockGet.mockReset()
  hookMocks.allocations.mockReturnValue({ data: allocations, isLoading: false })
  hookMocks.lessons.mockReturnValue({ data: lessons, isLoading: false })
})

it('shows an All tab plus a tab per configured level in admin mode', () => {
  render(<NextSessionCard lang="en" />)
  // All view was restored (feb9c34) — it is the only way back once a level is picked.
  expect(screen.getByRole('button', { name: 'All' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Level 1' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Level 2' })).toBeTruthy()
  // First level auto-selected: shows Level 1 items only.
  expect(screen.getByText('Item One')).toBeTruthy()
})

it('prefers the attendance session curriculum item over the allocation item', () => {
  hookMocks.allocations.mockReturnValue({
    data: [
      { id: 'a1', scheduledDate: new Date().toISOString(), level: { number: 1, name: 'Level 1' }, lesson: { id: 'les1' } },
    ],
    isLoading: false,
  })
  hookMocks.lessons.mockReturnValue({
    data: [{ id: 'les1', title: 'Lesson Title', subjectItem: { name: 'Alloc Hymn' }, subject: { name: 'Hymns' } }],
    isLoading: false,
  })
  render(
    <NextSessionCard
      lang="en"
      assigned={{ levelId: 'l1' }}
      sessions={[
        { id: 's1', levelNumber: 1, scheduledDate: new Date().toISOString(), subjectItem: { id: 'si-9', name: 'Session Hymn' } },
      ]}
    />,
  )
  expect(screen.getByText('Session Hymn')).toBeTruthy()
  expect(screen.queryByText('Alloc Hymn')).toBeNull()
})

it('themes rows with the admin-configured subject color', () => {
  hookMocks.lessons.mockReturnValue({
    data: [{ id: 'les1', title: 'Item One', subjectItem: { name: 'Hymn' }, subject: { name: 'Hymns', color: '#D4AF37' } }],
    isLoading: false,
  })
  const { container } = render(<NextSessionCard lang="en" />)
  expect(screen.getByText('Hymn')).toBeTruthy()
  const dot = container.querySelector('span span[style]') as HTMLElement
  expect(dot.style.backgroundColor).toBe('rgb(212, 175, 55)')
})

it('falls back to blue for missing or invalid subject colors', () => {
  hookMocks.lessons.mockReturnValue({
    data: [{ id: 'les1', title: 'Item One', subjectItem: { name: 'Hymn' }, subject: { name: 'Hymns', color: 'not-a-color' } }],
    isLoading: false,
  })
  const { container } = render(<NextSessionCard lang="en" />)
  const dot = container.querySelector('span span[style]') as HTMLElement
  expect(dot.style.backgroundColor).toBe('rgb(59, 130, 246)')
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