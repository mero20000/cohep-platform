import { render, screen, fireEvent } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import BriefingPage from '../page'

const mockGet = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard/briefing',
}))

vi.mock('@/lib/http-client', () => ({
  http: { get: (...args: any[]) => mockGet(...args) },
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('@/lib/asset-url', () => ({ assetUrl: (u?: string | null) => u ?? '' }))

describe('BriefingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockReset()
  })

  it('renders coptic banner, next session, next lesson, and follow-up checklist', async () => {
    mockGet.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      coptic: {
        coptic: { month: 4, day: 5, year: 1742, monthName: 'Kiahk', monthNameAr: 'كيهك' },
        season: 'kiahk',
        seasonLabel: { en: 'Month of Kiahk', ar: 'شهر كيهك' },
        feastFast: { key: 'nativity_fast', en: 'Nativity Fast (Advent)', ar: 'صوم الميلاد' },
      },
      nextSession: {
        id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'),
        levelName: 'Level 3', groupName: 'Group A',
      },
      nextLesson: {
        lessonId: 'l1', title: 'Kyrie Eleison', titleCoptic: 'ⲕⲩⲣⲓⲉ',
        levelName: 'Level 3', subjectName: 'Tasbeha', scheduledDate: new Date().toISOString(),
      },
      roster: [
        { studentId: 's1', firstName: 'Mina', lastName: 'A', attendanceRate: 40, lastAttendanceStatus: 'absent', likelyAbsent: true, needsFollowUp: true, followUpReasons: ['absent_3plus'], notes: [{ note: 'Seems tired', isPrivate: true, createdAt: new Date().toISOString() }] },
      ],
    })
    render(<BriefingPage />)

    expect(await screen.findByText(/5 Kiahk 1742/)).toBeInTheDocument()
    expect(screen.getByText('Nativity Fast (Advent)')).toBeInTheDocument()
    expect(screen.getByText('Kyrie Eleison')).toBeInTheDocument()
    expect(screen.getByText(/Group A/)).toBeInTheDocument()
    expect(screen.getByText('Mina A')).toBeInTheDocument()
    expect(screen.getByText('Missed 3+')).toBeInTheDocument()
  })

  it('renders every allocated lesson of the coming class, not just the first', async () => {
    mockGet.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      coptic: {
        coptic: { month: 4, day: 5, year: 1742, monthName: 'Kiahk', monthNameAr: 'كيهك' },
        season: 'kiahk', seasonLabel: { en: 'Month of Kiahk', ar: 'شهر كيهك' }, feastFast: null,
      },
      nextSession: null,
      nextLesson: {
        lessonId: 'l1', title: 'Ⲱⲥⲡⲉⲣⲏⲛ', levelName: 'Level 1', subjectName: 'Coptic Hymns',
      },
      nextLessons: [
        { lessonId: 'l1', title: 'Ⲱⲥⲡⲉⲣⲏⲛ', levelName: 'Level 1', subjectName: 'Coptic Hymns' },
        { lessonId: 'l2', title: 'Coptic letter that doesn’t exist in English', levelName: 'Level 1', subjectName: 'Coptic Language' },
        { lessonId: 'l3', title: 'Coptic Rites (8)', levelName: 'Level 1', subjectName: 'Coptic Rites' },
      ],
      roster: [],
    })
    render(<BriefingPage />)

    expect(await screen.findByText('Ⲱⲥⲡⲉⲣⲏⲛ')).toBeInTheDocument()
    expect(screen.getByText('Coptic letter that doesn’t exist in English')).toBeInTheDocument()
    expect(screen.getByText('Coptic Rites (8)')).toBeInTheDocument()
    expect(screen.queryByText('No lesson scheduled yet.')).not.toBeInTheDocument()
  })

  it('shows the subject item reference recording when attached', async () => {
    mockGet.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      coptic: {
        coptic: { month: 4, day: 5, year: 1742, monthName: 'Kiahk', monthNameAr: 'كيهك' },
        season: 'kiahk', seasonLabel: { en: 'Month of Kiahk', ar: 'شهر كيهك' }, feastFast: null,
      },
      nextSession: null,
      nextLesson: null,
      nextLessons: [
        { lessonId: 'l1', title: 'Ⲱⲥⲡⲉⲣⲏⲛ', levelName: 'Level 1', subjectName: 'Coptic Hymns', recordingUrl: '/uploads/ref.mp3' },
      ],
      roster: [],
    })
    render(<BriefingPage />)

    expect(await screen.findByText('Reference recording')).toBeInTheDocument()
    expect(screen.getByText('Ⲱⲥⲡⲉⲣⲏⲛ')).toBeInTheDocument()
  })

  it('shows all-caught-up when nothing is flagged', async () => {
    mockGet.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      coptic: {
        coptic: { month: 2, day: 5, year: 1742, monthName: 'Paopi', monthNameAr: 'بابه' },
        season: 'regular', seasonLabel: { en: 'Ordinary Time', ar: 'زمن عادي' }, feastFast: null,
      },
      nextSession: null,
      nextLesson: null,
      roster: [],
    })
    render(<BriefingPage />)
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText('No lesson scheduled yet.')).toBeInTheDocument()
  })

  it('shows an error state and recovers on retry', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    render(<BriefingPage />)
    expect(await screen.findByText('Retry')).toBeInTheDocument()
    mockGet.mockResolvedValueOnce({
      generatedAt: new Date().toISOString(),
      coptic: {
        coptic: { month: 2, day: 5, year: 1742, monthName: 'Paopi', monthNameAr: 'بابه' },
        season: 'regular', seasonLabel: { en: 'Ordinary Time', ar: 'زمن عادي' }, feastFast: null,
      },
      nextSession: null,
      nextLesson: null,
      roster: [],
    })
    fireEvent.click(screen.getByText('Retry'))
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
  })
})