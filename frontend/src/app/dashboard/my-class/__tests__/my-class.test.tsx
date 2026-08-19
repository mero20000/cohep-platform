import { render, screen, fireEvent, within } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import MyClassPage from '../page'

const mockGet = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard/my-class',
}))

vi.mock('@/lib/http-client', () => ({
  http: { get: (...args: any[]) => mockGet(...args) },
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('@/lib/asset-url', () => ({ assetUrl: (u?: string | null) => u ?? '' }))

describe('MyClassPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGet.mockReset()
  })

  it('shows an empty state when there is no class data', async () => {
    mockGet.mockResolvedValue({
      servant: { id: 'u1' },
      nextSession: null,
      todayLesson: null,
      roster: [],
    })
    render(<MyClassPage />)
    expect(await screen.findByText('No class yet')).toBeInTheDocument()
  })

  it('renders today lesson and roster with follow-up badges', async () => {
    mockGet.mockResolvedValue({
      servant: { id: 'u1', firstName: 'S', lastName: 'T' },
      nextSession: { id: 'n1', scheduledDate: new Date().toISOString(), levelName: 'Level 3', groupName: 'Group A' },
      todayLesson: { lessonId: 'l1', title: 'Kyrie Eleison', titleCoptic: 'ⲕⲩⲣⲓⲉ', levelName: 'Level 3', subjectName: 'Tasbeha', scheduledDate: new Date().toISOString() },
      roster: [
        { studentId: 's1', firstName: 'Mina', lastName: 'A', attendanceRate: 80, lastAttendanceStatus: 'present', likelyAbsent: false, needsFollowUp: true, followUpReasons: ['overdue_review'], notes: [] },
        { studentId: 's2', firstName: 'John', lastName: 'B', attendanceRate: 40, lastAttendanceStatus: 'absent', likelyAbsent: true, needsFollowUp: true, followUpReasons: ['absent_3plus'], notes: [{ note: 'Seems tired', isPrivate: true, createdAt: new Date().toISOString() }] },
      ],
    })
    render(<MyClassPage />)

    expect(await screen.findByText('Kyrie Eleison')).toBeInTheDocument()
    expect(screen.getByText('Mina A')).toBeInTheDocument()
    expect(screen.getByText('John B')).toBeInTheDocument()
    // follow-up chip and likely-absent badge visible
    expect(screen.getAllByText('Follow up').length).toBeGreaterThan(0)
    expect(screen.getByText('Likely absent')).toBeInTheDocument()
  })

  it('expands a student row to show notes', async () => {
    mockGet.mockResolvedValue({
      servant: { id: 'u1' },
      nextSession: null,
      todayLesson: null,
      roster: [
        { studentId: 's2', firstName: 'John', lastName: 'B', attendanceRate: 40, lastAttendanceStatus: 'absent', likelyAbsent: true, needsFollowUp: false, followUpReasons: [], notes: [{ note: 'Seems tired', isPrivate: true, createdAt: new Date().toISOString() }] },
      ],
    })
    render(<MyClassPage />)
    const row = await screen.findByText('John B')
    fireEvent.click(row)
    expect(screen.getByText('Seems tired')).toBeInTheDocument()
  })
})