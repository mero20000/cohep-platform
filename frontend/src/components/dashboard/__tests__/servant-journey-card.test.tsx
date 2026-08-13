import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServantJourneyCard } from '../servant-journey-card'

const mockGet = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a) },
}))

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mockGet.mockReset()
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
