import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PendingReviewPage from '../page'

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, children, footer, title }: any) => (open ? <div role="dialog" aria-label={title}>{children}{footer}</div> : null),
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm, title }: any) =>
    open ? <div role="dialog" aria-label={title}><button onClick={onConfirm}>confirm-bulk</button></div> : null,
}))

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: mockToast }) }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/export-pending-review', () => ({ exportPendingReviewXlsx: vi.fn() }))
vi.mock('@/components/audio-player', () => ({
  AudioPlayer: ({ src }: any) => <audio data-testid="player" src={src} />,
}))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))

const perm = vi.hoisted(() => ({ role: 'super_admin' }))
vi.mock('@/lib/use-permission', () => ({
  usePermission: () => ({ role: perm.role, can: () => true, isSuperAdmin: perm.role === 'super_admin' }),
}))

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mocks.get(...a), post: (...a: any[]) => mocks.post(...a) },
}))

const item = (id: string, over: any = {}) => ({
  submissionId: id,
  submittedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  isLate: false,
  attemptNumber: 1,
  student: { id: `stu-${id}`, firstName: 'Robin', lastName: id, studentCode: 'S1', levelName: 'L1', groupName: 'Group 1B', gradeName: 'Grade 6' },
  assessment: {
    id: 'a1', title: 'Quiz', titleAr: null, type: 'quiz', dueDate: null, totalPoints: 10,
    referenceRecordingUrl: null, referenceRecordingName: null,
  },
  recording: null,
  notes: null,
  extraAnswers: [],
  hasEssay: false,
  autoScore: 7,
  answers: [{ questionId: 'q1', questionText: 'Pick one', type: 'multiple_choice', points: 10, correctAnswer: 'B', answer: 'B', awarded: 7 }],
  ...over,
})

describe('PendingReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    perm.role = 'super_admin'
    mocks.get.mockResolvedValue([item('one'), item('two', { hasEssay: true })])
    mocks.post.mockResolvedValue({})
  })

  it('lists pending submissions and flags how long each has waited', async () => {
    render(<PendingReviewPage />)
    expect(await screen.findByText(/Robin one/)).toBeTruthy()
    expect(screen.getByText(/Robin two/)).toBeTruthy()
    expect(screen.getAllByText(/4 d waiting/).length).toBe(2)
  })

  it('marks on behalf of a servant with the typed score', async () => {
    const user = userEvent.setup()
    render(<PendingReviewPage />)
    const row = (await screen.findByText(/Robin one/)).closest('div.p-4') as HTMLElement
    await user.type(within(row).getByLabelText('Score'), '9')
    await user.click(within(row).getByRole('button', { name: 'Mark' }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
      '/assessments/a1/students/stu-one/mark',
      { score: 9, maxScore: 10, feedback: '' },
    ))
    await waitFor(() => expect(screen.queryByText(/Robin one/)).toBeNull())
  })

  it('bulk-accepts auto scores only for submissions without essays', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValue({ accepted: 1, failed: 0, results: [{ submissionId: 'one', ok: true }] })
    render(<PendingReviewPage />)
    await screen.findByText(/Robin one/)

    const essayRow = screen.getByText(/Robin two/).closest('div.p-4') as HTMLElement
    expect((within(essayRow).getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)

    await user.click(screen.getByLabelText(/Select all that can be auto-accepted/))
    await user.click(screen.getByRole('button', { name: /Accept auto scores \(1\)/ }))
    await user.click(screen.getByText('confirm-bulk'))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
      '/assessments/pending-review/accept-auto',
      { submissionIds: ['one'] },
      { schoolId: 'school-1' },
    ))
    await waitFor(() => expect(screen.queryByText(/Robin one/)).toBeNull())
    expect(screen.getByText(/Robin two/)).toBeTruthy()
  })

  it('shows the student recording inline, plays the reference alongside, and keeps it out of bulk accept', async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue([
      item('rec', {
        recording: { url: 'https://cdn/student.webm', type: 'audio/webm', durationSeconds: 30 },
        notes: 'Noisy room, sorry',
        assessment: {
          id: 'a1', title: 'Hymn', titleAr: null, type: 'oral', dueDate: null, totalPoints: 10,
          referenceRecordingUrl: 'https://cdn/ref.mp3', referenceRecordingName: 'Reference',
        },
      }),
    ])
    render(<PendingReviewPage />)
    const row = (await screen.findByText(/Robin rec/)).closest('div.p-4') as HTMLElement

    expect(within(row).getAllByTestId('player').map(p => p.getAttribute('src'))).toEqual(['https://cdn/student.webm'])
    expect((within(row).getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
    expect(within(row).queryByRole('button', { name: /Accept auto score/ })).toBeNull()

    await user.click(within(row).getByRole('button', { name: 'Show answers' }))
    expect(within(row).getByText('Noisy room, sorry')).toBeTruthy()
    expect(within(row).getAllByTestId('player').map(p => p.getAttribute('src')))
      .toEqual(['https://cdn/student.webm', 'https://cdn/student.webm', 'https://cdn/ref.mp3'])
  })

  it('lets a marker score an oral submission that has no questions in review mode', async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue([
      item('oral', {
        answers: [],
        autoScore: 0,
        recording: { url: 'https://cdn/oral.webm', type: 'audio/webm', durationSeconds: 12 },
      }),
    ])
    render(<PendingReviewPage />)
    await screen.findByText(/Robin oral/)

    await user.click(screen.getByRole('button', { name: 'Review mode' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('player').getAttribute('src')).toBe('https://cdn/oral.webm')

    const overall = within(dialog).getByLabelText('Recording or overall score')
    await user.clear(overall)
    await user.type(overall, '8')
    await user.click(within(dialog).getByRole('button', { name: 'Save & next' }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
      '/assessments/a1/students/stu-oral/mark',
      { score: 8, maxScore: 10, feedback: '', extraScore: 8 },
    ))
  })

  it('refuses an overall score above what the assessment allows', async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue([item('oral', { answers: [], autoScore: 0 })])
    render(<PendingReviewPage />)
    await screen.findByText(/Robin oral/)
    await user.click(screen.getByRole('button', { name: 'Review mode' }))
    const dialog = await screen.findByRole('dialog')

    const overall = within(dialog).getByLabelText('Recording or overall score')
    await user.clear(overall)
    await user.type(overall, '11')

    expect((within(dialog).getByRole('button', { name: 'Save & next' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('hides bulk actions and the turnaround tab from a servant', async () => {
    perm.role = 'servant'
    render(<PendingReviewPage />)
    await screen.findByText(/Robin one/)
    expect(screen.queryByRole('tab', { name: /Turnaround/ })).toBeNull()
    expect(screen.queryByLabelText(/Select all that can be auto-accepted/)).toBeNull()
    expect(screen.getByText(/from your group/)).toBeTruthy()
  })

  it('offers a retry when the queue fails to load', async () => {
    mocks.get.mockRejectedValueOnce(new Error('boom'))
    render(<PendingReviewPage />)
    expect(await screen.findByText(/Could not load the review queue/)).toBeTruthy()
    mocks.get.mockResolvedValue([item('one')])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/Robin one/)).toBeTruthy()
  })
})
