import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServantJourneyCard } from '../servant-journey-card'

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: (...a: any[]) => mockPost(...a) },
}))

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-13T00:00:00Z').getTime())
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('computes years from dateJoined', async () => {
  mockGet.mockResolvedValue({
    userId: 'u1',
    dateJoined: '2020-01-15',
    yearsOfService: 2, // stale cached value — must not be displayed
    totalStudents: 5,
    totalHymns: 3,
  })
  renderWithClient(<ServantJourneyCard />)
  await waitFor(() => {
    expect(screen.getByText('6')).toBeTruthy()
  })
})

it('falls back to cached yearsOfService when dateJoined is null', async () => {
  mockGet.mockResolvedValue({
    userId: 'u1',
    dateJoined: null,
    yearsOfService: 4,
    totalStudents: 5,
    totalHymns: 3,
  })
  renderWithClient(<ServantJourneyCard />)
  await waitFor(() => {
    expect(screen.getByText('4')).toBeTruthy()
  })
})

it('shows how close the next milestone is', async () => {
  mockGet.mockResolvedValue({
    userId: 'u1', dateJoined: '2020-01-15', yearsOfService: 6, totalStudents: 90, totalHymns: 3,
    nextMilestone: { type: 'students_taught', current: 90, target: 100, remaining: 10, label: '100th student taught', labelAr: 'الطالب رقم 100' },
  })
  renderWithClient(<ServantJourneyCard />)
  await waitFor(() => expect(screen.getByText(/100th student taught/)).toBeTruthy())
  expect(screen.getByText('10 to go')).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('90')
})

it('celebrates unseen milestones and marks them seen when dismissed', async () => {
  mockPost.mockResolvedValue({ marked: 1 })
  mockGet.mockResolvedValue({
    userId: 'u1', dateJoined: '2020-01-15', yearsOfService: 6, totalStudents: 50, totalHymns: 3,
    nextMilestone: null,
    newMilestones: [{ type: 'students_taught', threshold: 50, label: '50th student taught', reachedAt: '2026-08-12' }],
  })
  renderWithClient(<ServantJourneyCard />)
  await waitFor(() => expect(screen.getByText('50th student taught')).toBeTruthy())
  fireEvent.click(screen.getByLabelText('Dismiss'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/servants/milestones/seen'))
})

it('shows nothing celebratory when there are no new milestones', async () => {
  mockGet.mockResolvedValue({ userId: 'u1', dateJoined: null, yearsOfService: 4, totalStudents: 5, totalHymns: 3, nextMilestone: null, newMilestones: [] })
  renderWithClient(<ServantJourneyCard />)
  await waitFor(() => expect(screen.getByText('4')).toBeTruthy())
  expect(screen.queryByRole('status')).toBeNull()
})
