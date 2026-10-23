import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { InsightsClient } from '../insights-client'

const mockGet = vi.fn(async (url: string) => {
  if (url.endsWith('/attendance/stats')) return { totalSessions: 10, averageAttendanceRate: 90, distinctStudents: 6, cancelledSessions: 1, totalRecords: 8, presentCount: 5, lateCount: 1, absentCount: 2, excusedCount: 0, completedSessions: 3 }
  if (url.endsWith('/attendance/enrolled-count')) return { enrolledStudents: 42 }
  return []
})
vi.mock('@/lib/http-client', () => ({ http: { get: (...a: any[]) => mockGet(...a) } }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

beforeEach(() => { mockGet.mockClear() })

describe('Insights', () => {
  it('shows average rate', async () => { render(<InsightsClient />); await waitFor(()=>expect(screen.getByText(/90/)).toBeInTheDocument()) })
  it('student search input has an accessible name', async () => {
    render(<InsightsClient />)
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search student/i })).toBeInTheDocument())
  })

  it('shows the distinct-student headcount against enrollment, not a raw record count', async () => {
    render(<InsightsClient />)
    await waitFor(() => expect(screen.getByText(/of 42 enrolled/i)).toBeInTheDocument())
  })

  it('defaults to the current week and scopes every stats request to it', async () => {
    render(<InsightsClient />)
    await waitFor(() => expect(screen.getByText(/this week/i)).toBeInTheDocument())
    const statsCall = mockGet.mock.calls.find(c => String(c[0]).endsWith('/attendance/stats'))
    expect(statsCall?.[1]).toEqual(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }))
  })

  it('stepping to the previous week re-fetches with an earlier range and offers a way back', async () => {
    render(<InsightsClient />)
    await waitFor(() => expect(screen.getByText(/this week/i)).toBeInTheDocument())
    await waitFor(() => expect(mockGet.mock.calls.some(c => String(c[0]).endsWith('/attendance/stats'))).toBe(true))
    const statsCalls = () => mockGet.mock.calls.filter(c => String(c[0]).endsWith('/attendance/stats'))
    const initialRange = statsCalls().at(-1)?.[1]

    fireEvent.click(screen.getByRole('button', { name: /previous week/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /jump to this week/i })).toBeInTheDocument())
    await waitFor(() => expect(statsCalls().at(-1)?.[1]).not.toBe(initialRange))
    const newRange = statsCalls().at(-1)?.[1]
    expect(newRange.from < initialRange.from).toBe(true)
  })

  it('clicking the Absent card reveals the absentee drill-down', async () => {
    mockGet.mockImplementation(async (url: string) => {
      if (url.endsWith('/attendance/stats')) return { totalSessions: 1, averageAttendanceRate: 50, totalRecords: 2, presentCount: 1, lateCount: 0, absentCount: 1, excusedCount: 0, completedSessions: 1 }
      if (url.endsWith('/attendance/top-absentees')) return [{ studentId: 'st1', studentCode: 'S1', name: 'Mina G', absences: 2, lastAbsence: '2026-01-01', groupName: 'Group A' }]
      return []
    })
    render(<InsightsClient />)
    await waitFor(() => expect(screen.getByText('Absent')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Absent'))
    await waitFor(() => expect(screen.getByText('Mina G')).toBeInTheDocument())
  })
})
