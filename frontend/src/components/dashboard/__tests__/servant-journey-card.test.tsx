import { describe, it, expect, vi, beforeEach } from 'vitest'
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

beforeEach(() => mockGet.mockReset())

it('computes years from dateJoined', async () => {
  mockGet.mockResolvedValue({
    userId: 'u1',
    dateJoined: '2020-01-15',
    yearsOfService: 2, // stale cached value — must not be displayed
    totalStudents: 5,
    totalHymns: 3,
  })
  renderWithClient(<ServantJourneyCard />)
  const expected = Math.floor((Date.now() - new Date('2020-01-15').getTime()) / (365.25 * 24 * 3600 * 1000))
  await waitFor(() => {
    expect(screen.getByText(String(expected))).toBeTruthy()
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