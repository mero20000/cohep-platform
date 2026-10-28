import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PendingReviewPage from '../page'

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, children, footer, title }: any) => (open ? <div role="dialog" aria-label={title}>{children}{footer}</div> : null),
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm, title, message }: any) =>
    open ? <div role="dialog" aria-label={title}><p>{message}</p><button onClick={onConfirm}>{`confirm: ${title}`}</button></div> : null,
}))

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: mockToast }) }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/export-pending-review', () => ({ exportPendingReviewXlsx: vi.fn(), exportMarkedXlsx: vi.fn() }))
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
    await user.click(screen.getByText('confirm: Accept auto scores?'))

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

  describe('Marked tab', () => {
    const marked = (id: string, over: any = {}) => ({
      status: 'marked',
      submissionId: id,
      at: '2026-02-01T10:00:00Z',
      score: 8, maxScore: 10, percentage: 80, feedback: null,
      submittedAt: '2026-02-01T08:00:00Z', isLate: false,
      recording: null, notes: null,
      by: { id: 'u1', name: 'Mina Servant', isAdmin: false },
      student: { id: `stu-${id}`, firstName: 'Done', lastName: id, studentCode: 'S9', groupName: 'Group 1B', gradeName: 'Grade 6' },
      assessment: { id: 'a1', title: 'Quiz', titleAr: null, totalPoints: 10 },
      ...over,
    })
    const returned = (id: string, over: any = {}) =>
      marked(id, {
        status: 'returned', score: null, percentage: null, feedback: 'Please redo question 2',
        by: { id: 'u2', name: 'Amir Admin', isAdmin: true },
        recording: { url: 'https://cdn/old.webm', type: 'audio/webm', durationSeconds: 9 },
        ...over,
      })

    const serve = (items: any[]) =>
      mocks.get.mockImplementation(async (path: string) =>
        path === '/assessments/marked' ? { days: 90, truncated: false, items } : [item('one')])

    const openMarked = async () => {
      const user = userEvent.setup()
      render(<PendingReviewPage />)
      await screen.findByText(/Robin one/)
      await user.click(screen.getByRole('tab', { name: /Marked/ }))
      return user
    }

    beforeEach(() => {
      serve([
        marked('s1'),
        marked('a1', { by: { id: 'u2', name: 'Amir Admin', isAdmin: true }, feedback: 'Marked on behalf', score: 4, percentage: 40 }),
      ])
    })

    it('lists marked work with who marked it and their role', async () => {
      await openMarked()

      expect(await screen.findByText(/Done s1/)).toBeTruthy()
      expect(screen.getByText(/Marked by Mina Servant/)).toBeTruthy()
      expect(screen.getByText(/Marked by Amir Admin/)).toBeTruthy()
      expect(screen.getByText('Admin')).toBeTruthy()
      expect(screen.getByText('Servant')).toBeTruthy()
      expect(screen.getByText('“Marked on behalf”')).toBeTruthy()
      expect(screen.getByText('8 / 10')).toBeTruthy()
    })

    it('keeps the student recording and notes playable on marked work', async () => {
      serve([marked('rec', { recording: { url: 'https://cdn/kept.webm', type: 'audio/webm', durationSeconds: 20 }, notes: 'Noisy room' })])
      await openMarked()

      const row = (await screen.findByText(/Done rec/)).closest('div.p-4') as HTMLElement
      expect(within(row).getByTestId('player').getAttribute('src')).toBe('https://cdn/kept.webm')
      expect(within(row).getByText('Noisy room')).toBeTruthy()
    })

    it('shows returned work with its own status, the reason and the earlier recording, and no score', async () => {
      serve([marked('s1'), returned('r1')])
      await openMarked()

      const row = (await screen.findByText(/Done r1/)).closest('div.p-4') as HTMLElement
      expect(within(row).getByText('Returned')).toBeTruthy()
      expect(within(row).getByText(/Returned by Amir Admin/)).toBeTruthy()
      expect(within(row).getByText('Reason: Please redo question 2')).toBeTruthy()
      expect(within(row).getByText('With student')).toBeTruthy()
      expect(within(row).queryByText(/\/ 10/)).toBeNull()
      expect(within(row).getByTestId('player').getAttribute('src')).toBe('https://cdn/old.webm')
    })

    it('filters between marked and returned work', async () => {
      serve([marked('s1'), returned('r1')])
      const user = await openMarked()
      await screen.findByText(/Done s1/)

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'returned')
      expect(screen.queryByText(/Done s1/)).toBeNull()
      expect(screen.getByText(/Done r1/)).toBeTruthy()

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'marked')
      expect(screen.getByText(/Done s1/)).toBeTruthy()
      expect(screen.queryByText(/Done r1/)).toBeNull()
    })

    it('filters by whether an admin or a servant marked it', async () => {
      const user = await openMarked()
      await screen.findByText(/Done s1/)

      await user.selectOptions(screen.getByLabelText('Filter by marker role'), 'admin')
      expect(screen.queryByText(/Done s1/)).toBeNull()
      expect(screen.getByText(/Done a1/)).toBeTruthy()

      await user.selectOptions(screen.getByLabelText('Filter by marker role'), 'servant')
      expect(screen.getByText(/Done s1/)).toBeTruthy()
      expect(screen.queryByText(/Done a1/)).toBeNull()
    })

    it('shows an empty state when nothing has been marked yet', async () => {
      serve([])
      await openMarked()
      expect(await screen.findByText('Nothing has been marked yet')).toBeTruthy()
    })

    it('is available to a servant, who still gets no turnaround tab', async () => {
      perm.role = 'servant'
      render(<PendingReviewPage />)
      await screen.findByText(/Robin one/)
      expect(screen.getByRole('tab', { name: /Marked/ })).toBeTruthy()
      expect(screen.queryByRole('tab', { name: /Turnaround/ })).toBeNull()
    })
  })

  describe('Data check tab', () => {
    const rec = (id: string, over: any = {}) => ({
      id, status: 'assigned', attemptNumber: 1, createdAt: '2026-01-01T00:00:00Z', submittedAt: null,
      type: 'assigned', hasRecording: false, score: null, maxScore: null, ...over,
    })
    const finding = (over: any = {}) => ({
      kind: 'duplicate', assessmentId: 'a1', studentId: 'stu-32',
      student: { id: 'stu-32', name: 'Robin Amir', studentCode: 'STU-00032', levelName: 'Level 1', groupName: 'Group 1B' },
      assessment: { id: 'a1', title: 'Hymn quiz', levelName: 'Level 1', groupName: null },
      keep: rec('done', { status: 'completed', score: 8, maxScore: 10 }),
      archive: [rec('pending', { createdAt: '2026-02-01T00:00:00Z' })],
      reason: null, fixable: true, ...over,
    })
    const report = (findings: any[]) => ({
      scanned: 12,
      counts: {
        duplicate: findings.filter(f => f.kind === 'duplicate').length,
        notAssigned: findings.filter(f => f.kind === 'not_assigned' && f.fixable).length,
        reviewOnly: findings.filter(f => !f.fixable).length,
      },
      truncated: false,
      findings,
    })
    const serve = (findings: any[]) =>
      mocks.get.mockImplementation(async (path: string) =>
        path === '/assessments/integrity' ? report(findings) : [item('one')])

    const openIntegrity = async () => {
      const user = userEvent.setup()
      render(<PendingReviewPage />)
      await screen.findByText(/Robin one/)
      await user.click(screen.getByRole('tab', { name: /Data check/ }))
      return user
    }

    it('shows a student who has the same assessment done and pending, and what a fix would keep and archive', async () => {
      serve([finding()])
      await openIntegrity()

      expect(await screen.findByText('Hymn quiz')).toBeTruthy()
      expect(screen.getByText('Duplicate')).toBeTruthy()
      expect(screen.getByText(/Keep: Completed 8\/10/)).toBeTruthy()
      expect(screen.getByText(/Archive: Pending \(not started\)/)).toBeTruthy()
      expect(screen.getByText('12 records scanned')).toBeTruthy()
    })

    it('scans one student by code', async () => {
      serve([finding()])
      const user = await openIntegrity()
      await screen.findByText('Hymn quiz')

      await user.type(screen.getByLabelText('Student code'), 'STU-00032')
      await user.click(screen.getByRole('button', { name: 'Scan' }))

      await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
        '/assessments/integrity',
        { schoolId: 'school-1', studentCode: 'STU-00032' },
      ))
    })

    it('fixes the selected findings after confirming, then scans again', async () => {
      const notAssigned = finding({
        kind: 'not_assigned', assessmentId: 'old', assessment: { id: 'old', title: 'Old test', levelName: 'Level 9', groupName: null },
        keep: rec('stale'), archive: [], reason: 'level',
      })
      serve([finding(), notAssigned])
      mocks.post.mockResolvedValue({ fixed: 2, failed: 0, results: [] })
      const user = await openIntegrity()
      await screen.findByText('Hymn quiz')
      expect(screen.getByText(/The assessment is for Level 9, but the student is in Level 1/)).toBeTruthy()

      await user.click(screen.getByLabelText(/Select all that can be fixed/))
      await user.click(screen.getByRole('button', { name: /Fix selected \(2\)/ }))
      await user.click(screen.getByText('confirm: Fix selected records?'))

      await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
        '/assessments/integrity/fix',
        { items: [
          { kind: 'duplicate', assessmentId: 'a1', studentId: 'stu-32' },
          { kind: 'not_assigned', assessmentId: 'old', studentId: 'stu-32' },
        ] },
        { schoolId: 'school-1' },
      ))
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith('success', 'Fixed 2'))
      const scans = mocks.get.mock.calls.filter((c: any[]) => c[0] === '/assessments/integrity')
      expect(scans.length).toBeGreaterThanOrEqual(2)
    })

    it('does not offer to fix a record that carries real work', async () => {
      serve([finding({ kind: 'not_assigned', fixable: false, reason: 'group', archive: [], keep: rec('worked', { status: 'completed', score: 5, maxScore: 10 }) })])
      await openIntegrity()

      expect(await screen.findByText('Needs manual review')).toBeTruthy()
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(screen.queryByLabelText(/Select all that can be fixed/)).toBeNull()
    })

    it('explains a gender mismatch in plain words', async () => {
      serve([finding({
        kind: 'not_assigned', reason: 'gender', archive: [], keep: rec('stale'),
        student: { id: 'stu-32', name: 'Robin Amir', studentCode: 'STU-00032', levelName: 'Level 1', groupName: 'Group 1B', gender: 'male' },
        assessment: { id: 'a1', title: 'Girls quiz', levelName: 'Level 1', groupName: null, gender: 'female' },
      })])
      await openIntegrity()

      expect(await screen.findByText('The assessment is for girls only, but the student is a boy.')).toBeTruthy()
    })

    it('says so when everything is consistent', async () => {
      serve([])
      await openIntegrity()
      expect(await screen.findByText('No problems found')).toBeTruthy()
    })

    it('reports a failed fix without leaving the page', async () => {
      serve([finding()])
      mocks.post.mockRejectedValueOnce(new Error('nope'))
      const user = await openIntegrity()
      await screen.findByText('Hymn quiz')

      await user.click(screen.getByLabelText(/Select all that can be fixed/))
      await user.click(screen.getByRole('button', { name: /Fix selected/ }))
      await user.click(screen.getByText('confirm: Fix selected records?'))

      await waitFor(() => expect(mockToast).toHaveBeenCalledWith('error', 'The fix failed'))
      expect(screen.getByText('Hymn quiz')).toBeTruthy()
    })

    it('is admin only', async () => {
      perm.role = 'servant'
      render(<PendingReviewPage />)
      await screen.findByText(/Robin one/)
      expect(screen.queryByRole('tab', { name: /Data check/ })).toBeNull()
    })
  })

  describe('Delete and reset', () => {
    it('lets an admin delete a pending submission after confirming, then removes it from the queue', async () => {
      const user = userEvent.setup()
      render(<PendingReviewPage />)
      const row = (await screen.findByText(/Robin one/)).closest('div.p-4') as HTMLElement

      await user.click(within(row).getByRole('button', { name: 'Delete submission and reset' }))
      expect(await screen.findByText(/removed from the queue and their assessment reset/)).toBeTruthy()
      expect(mocks.post).not.toHaveBeenCalled()

      await user.click(screen.getByText('confirm: Delete this submission?'))

      await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
        '/assessments/pending-review/one/reset',
        undefined,
        { schoolId: 'school-1' },
      ))
      await waitFor(() => expect(screen.queryByText(/Robin one/)).toBeNull())
      expect(mockToast).toHaveBeenCalledWith('success', expect.stringMatching(/can submit again/))
    })

    it('keeps the row and reports an error when the reset fails', async () => {
      const user = userEvent.setup()
      mocks.post.mockRejectedValueOnce(new Error('nope'))
      render(<PendingReviewPage />)
      const row = (await screen.findByText(/Robin one/)).closest('div.p-4') as HTMLElement

      await user.click(within(row).getByRole('button', { name: 'Delete submission and reset' }))
      await user.click(screen.getByText('confirm: Delete this submission?'))

      await waitFor(() => expect(mockToast).toHaveBeenCalledWith('error', 'Could not reset the submission'))
      // The row stays in the queue and the dialog stays open so the admin can retry.
      expect(document.body.contains(row)).toBe(true)
      expect(screen.getByText('confirm: Delete this submission?')).toBeTruthy()
    })

    it('does not offer delete to a servant', async () => {
      perm.role = 'servant'
      render(<PendingReviewPage />)
      await screen.findByText(/Robin one/)
      expect(screen.queryByRole('button', { name: 'Delete submission and reset' })).toBeNull()
    })
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
