import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AssessmentsPage from '../page'

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, children, footer }: any) => (open ? <div role="dialog">{children}{footer}</div> : null),
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, children }: any) => (open ? <div role="dialog">{children}</div> : null),
}))

vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value, onChange }: any) => (
    <input aria-label="Due Date" value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value)} />
  ),
}))

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('@/lib/school', () => ({
  getSchoolId: () => 'school-1',
}))

vi.mock('@/lib/grades', () => ({
  fetchActiveGrades: vi.fn().mockResolvedValue([]),
}))

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/http-client', () => ({
  http: {
    get: (...a: any[]) => mocks.get(...a),
    post: (...a: any[]) => mocks.post(...a),
    put: (...a: any[]) => mocks.put(...a),
    patch: (...a: any[]) => mocks.patch(...a),
    delete: (...a: any[]) => mocks.delete(...a),
  },
}))

const levels = [{ id: 'l1', name: 'Level 1', number: 1, status: 'active' }]
const subjects = [{ id: 's1', name: 'Coptic Hymns' }]
const years = [{ id: 'y1', name: '2025/2026', isCurrent: true }]
const items = [
  { id: 'i1', name: 'Lesson One', recordingUrl: 'https://cdn/rec1.mp3', recordingMeta: { originalName: 'hymn-one.mp3' } },
  { id: 'i2', name: 'Lesson Two', recordingUrl: 'https://cdn/rec2.mp3', recordingMeta: {} },
  { id: 'i3', name: 'No Recording', recordingUrl: null },
]

// Flat, school-wide groups list — the current backend /students/groups/all contract
const flatGroups = [
  { id: 'g1', name: 'Group A', status: 'active' },
  { id: 'g2', name: 'Group B', status: 'inactive' },
]

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  localStorage.clear()
  mocks.get.mockImplementation((path: string, params?: any) => {
    if (path === '/assessments') {
      return Promise.resolve({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    }
    if (path === '/assessments/stats') return Promise.resolve({ total: 0, byStatus: [], grading: null })
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path === '/curriculum/subjects') return Promise.resolve(subjects)
    if (path === '/curriculum/academic-years') return Promise.resolve(years)
    if (path === '/students/groups/all') return Promise.resolve(flatGroups)
    if (typeof path === 'string' && path.startsWith('/curriculum/subjects/') && path.endsWith('/items')) {
      return Promise.resolve(items)
    }
    return Promise.resolve([])
  })
  mocks.post.mockResolvedValue({ id: 'new' })
  mocks.put.mockResolvedValue({})
  mocks.delete.mockResolvedValue({})
})

describe('Assessment reference recording picker', () => {
  it('loads subject recordings, lets the user pick one, and includes referenceRecordingUrl in the create payload', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    // Open the create form
    await user.click(await screen.findByText('New Assessment'))
    const dialog = await screen.findByRole('dialog')
    const form = within(dialog)

    // Fill required fields
    await user.type(form.getByLabelText(/Title/), 'Midterm Hymn Test')
    await user.selectOptions(form.getByLabelText(/Level/), 'l1')
    await user.selectOptions(form.getByLabelText(/Subject/), 's1')
    await user.type(form.getByLabelText(/Total Points/), '100')
    await user.type(form.getByLabelText(/Passing Points/), '60')

    // Subject change triggers the items fetch; the picker should populate
    const referenceSelect = await form.findByLabelText(/Reference recording/)
    await waitFor(() => {
      expect(form.getByText('Lesson One (hymn-one.mp3)')).toBeInTheDocument()
    })

    // The "No Recording" item (null url) must NOT be an option
    expect(form.queryByText('No Recording')).not.toBeInTheDocument()

    await user.selectOptions(referenceSelect, 'https://cdn/rec1.mp3')

    // An audio preview should appear once a recording is chosen
    await waitFor(() => {
      const audio = dialog.querySelector('audio')
      expect(audio).toBeTruthy()
      expect(audio?.getAttribute('src')).toBe('https://cdn/rec1.mp3')
    })

    // Submit
    await user.click(form.getByRole('button', { name: /Create Assessment/ }))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalled()
    })

    const createCall = mocks.post.mock.calls.find((c) => c[0] === '/assessments')
    expect(createCall).toBeTruthy()
    expect(createCall![1]).toMatchObject({
      referenceRecordingUrl: 'https://cdn/rec1.mp3',
      referenceRecordingName: 'Lesson One (hymn-one.mp3)',
    })
  })

  it('populates the group dropdown from the flat school-wide groups list', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    await user.click(await screen.findByText('New Assessment'))
    const dialog = await screen.findByRole('dialog')
    const form = within(dialog)

    await user.selectOptions(form.getByLabelText(/Level/), 'l1')

    await waitFor(() => {
      expect(form.getByText('Group A')).toBeInTheDocument()
    })
    expect(form.queryByText('Group B')).not.toBeInTheDocument()
  })
  it('submits the four settings in the create body', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    await user.click(await screen.findByText('New Assessment'))
    const dialog = await screen.findByRole('dialog')
    const form = within(dialog)

    await user.type(form.getByLabelText(/Title/), 'Retry Quiz')
    await user.selectOptions(form.getByLabelText(/Level/), 'l1')
    await user.selectOptions(form.getByLabelText(/Subject/), 's1')
    await user.type(form.getByLabelText(/Total Points/), '100')
    await user.type(form.getByLabelText(/Passing Points/), '60')

    // Max attempts is only offered once retry is on
    expect(form.queryByLabelText(/Max attempts/)).not.toBeInTheDocument()
    await user.click(form.getByLabelText(/Allow retry/))
    const max = form.getByLabelText(/Max attempts/)
    expect(max).toHaveAccessibleDescription(/Includes the first try: 3 means the first try plus 2 retries/)
    await user.clear(max)
    await user.type(max, '4')
    await user.click(form.getByLabelText(/Require recording/))

    await user.click(form.getByRole('button', { name: /Create Assessment/ }))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalled()
    })
    const createCall = mocks.post.mock.calls.find((c) => c[0] === '/assessments')
    expect(createCall![1]).toMatchObject({
      requireReview: false,
      requireRecording: true,
      allowRetry: true,
      maxAttempts: 4,
    })
    expect(createCall![1]).not.toHaveProperty('reviewTouched')
    expect(createCall![1].durationMinutes).toBeUndefined()
  })

  it('sends allowRecording true by default and false when the box is unchecked', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    await user.click(await screen.findByText('New Assessment'))
    const form = within(await screen.findByRole('dialog'))

    await user.type(form.getByLabelText(/Title/), 'Quiz')
    await user.selectOptions(form.getByLabelText(/Level/), 'l1')
    await user.selectOptions(form.getByLabelText(/Subject/), 's1')
    await user.type(form.getByLabelText(/Total Points/), '100')
    await user.type(form.getByLabelText(/Passing Points/), '60')

    const allow = form.getByLabelText(/Allow voice recording/)
    expect(allow).toBeChecked()
    expect(allow).toBeEnabled()
    expect(allow).toHaveAccessibleDescription(/Students can attach a recording\. Turn off to hide recording completely\./)
    await user.click(allow)
    expect(allow).not.toBeChecked()

    await user.click(form.getByRole('button', { name: /Create Assessment/ }))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalled()
    })
    const createCall = mocks.post.mock.calls.find((c) => c[0] === '/assessments')
    expect(createCall![1]).toMatchObject({ requireRecording: false, allowRecording: false })
  })

  it('shows Allow voice recording checked and disabled, with the reason, while Require recording is on', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    await user.click(await screen.findByText('New Assessment'))
    const form = within(await screen.findByRole('dialog'))

    // Turn recording off first: the lock is display-only and must not overwrite this choice
    await user.click(form.getByLabelText(/Allow voice recording/))
    await user.click(form.getByLabelText(/Require recording/))

    const allow = form.getByLabelText(/Allow voice recording/)
    expect(allow).toBeChecked()
    expect(allow).toBeDisabled()
    const hint = form.getByText('A required recording is always allowed.')
    expect(allow.getAttribute('aria-describedby')).toBe(hint.id)
    expect(allow).toHaveAccessibleDescription(hint.textContent!)

    await user.click(form.getByLabelText(/Require recording/))
    expect(form.getByLabelText(/Allow voice recording/)).not.toBeChecked()
    expect(form.getByLabelText(/Allow voice recording/)).toBeEnabled()
  })

  it('sends allowRecording true when Require recording is on', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    await user.click(await screen.findByText('New Assessment'))
    const form = within(await screen.findByRole('dialog'))

    await user.type(form.getByLabelText(/Title/), 'Quiz')
    await user.selectOptions(form.getByLabelText(/Level/), 'l1')
    await user.selectOptions(form.getByLabelText(/Subject/), 's1')
    await user.type(form.getByLabelText(/Total Points/), '100')
    await user.type(form.getByLabelText(/Passing Points/), '60')
    await user.click(form.getByLabelText(/Allow voice recording/))
    await user.click(form.getByLabelText(/Require recording/))
    await user.click(form.getByRole('button', { name: /Create Assessment/ }))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalled()
    })
    const createCall = mocks.post.mock.calls.find((c) => c[0] === '/assessments')
    expect(createCall![1]).toMatchObject({ requireRecording: true, allowRecording: true })
  })

  it('disables Require review and Allow retry when an essay question exists', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    await user.click(await screen.findByText('New Assessment'))
    const dialog = await screen.findByRole('dialog')
    const form = within(dialog)

    expect(form.getByLabelText(/Require review/)).toBeEnabled()
    expect(form.getByLabelText(/Allow retry/)).toBeEnabled()

    await user.click(form.getByRole('button', { name: /Add Question/ }))
    await user.selectOptions(form.getAllByLabelText('Type').at(-1)!, 'essay')

    const review = form.getByLabelText(/Require review/)
    const retry = form.getByLabelText(/Allow retry/)
    expect(review).toBeDisabled()
    expect(review).toBeChecked()
    expect(retry).toBeDisabled()
    expect(retry).not.toBeChecked()
    const reviewHint = form.getByText('Essay questions always need a teacher review.')
    const retryHint = form.getByText('Retries are not available when the assessment has an essay question.')
    expect(review).toHaveAccessibleDescription(reviewHint.textContent!)
    expect(retry).toHaveAccessibleDescription(retryHint.textContent!)
    expect(review.getAttribute('aria-describedby')).toBe(reviewHint.id)
    expect(retry.getAttribute('aria-describedby')).toBe(retryHint.id)
  })

  it('follows the type default for Require review until the user touches it', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    await user.click(await screen.findByText('New Assessment'))
    const form = within(await screen.findByRole('dialog'))

    expect(form.getByLabelText(/Require review/)).not.toBeChecked()
    await user.selectOptions(form.getByLabelText('Type'), 'exam')
    expect(form.getByLabelText(/Require review/)).toBeChecked()

    await user.click(form.getByLabelText(/Require review/))
    await user.selectOptions(form.getByLabelText('Type'), 'quiz')
    expect(form.getByLabelText(/Require review/)).not.toBeChecked()
    await user.click(form.getByLabelText(/Require review/))
    await user.selectOptions(form.getByLabelText('Type'), 'exam')
    expect(form.getByLabelText(/Require review/)).toBeChecked()
  })

  it('Copy opens the create form prefilled and posts without ids', async () => {
    const detail = {
      id: 'a1',
      title: 'Midterm',
      description: '',
      type: 'quiz',
      status: 'published',
      totalPoints: 10,
      passingScore: 6,
      dueDate: '2026-12-01T00:00:00.000Z',
      levelId: 'l1',
      groupId: null,
      subjectId: 's1',
      metadata: {},
      level: { id: 'l1', name: 'Level 1', number: 1 },
      subject: { id: 's1', name: 'Coptic Hymns' },
      _count: { questions: 1, submissions: 3 },
      questions: [
        { id: 'q1', questionText: 'Pick one', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 10, orderIndex: 0 },
      ],
    }
    const base = mocks.get.getMockImplementation()!
    mocks.get.mockImplementation((path: string, params?: any) => {
      if (path === '/assessments') {
        return Promise.resolve({ data: [{ ...detail, questions: undefined }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })
      }
      if (path === '/assessments/a1') return Promise.resolve(detail)
      return base(path, params)
    })
    const user = userEvent.setup()
    render(<AssessmentsPage />)

    await user.click(await screen.findByRole('button', { name: 'Copy Midterm' }))
    const dialog = await screen.findByRole('dialog')
    const form = within(dialog)
    expect(form.getByLabelText(/Title/)).toHaveValue('Copy of Midterm')
    expect(form.getByRole('button', { name: /Create Assessment/ })).toBeInTheDocument()

    await user.click(form.getByRole('button', { name: /Create Assessment/ }))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalled()
    })
    const createCall = mocks.post.mock.calls.find((c) => c[0] === '/assessments')
    expect(createCall).toBeTruthy()
    const body = createCall![1]
    expect(body.title).toBe('Copy of Midterm')
    expect(body.questions).toHaveLength(1)
    expect(body.questions[0].id).toBeUndefined()
    expect(body.dueDate).toBeUndefined()
    expect(body.status).toBe('draft')
    expect(mocks.put).not.toHaveBeenCalled()
  })
})

describe('Assessment gender audience', () => {
  const fillRequired = async (user: ReturnType<typeof userEvent.setup>, form: ReturnType<typeof within>) => {
    await user.type(form.getByLabelText(/Title/), 'Hymn quiz')
    await user.selectOptions(form.getByLabelText(/Level/), 'l1')
    await user.selectOptions(form.getByLabelText(/Subject/), 's1')
    await user.type(form.getByLabelText(/Total Points/), '10')
    await user.type(form.getByLabelText(/Passing Points/), '6')
  }

  const createPayload = () => mocks.post.mock.calls.find((c) => c[0] === '/assessments')![1]

  const row = (over: any = {}) => ({
    id: 'a1', title: 'Girls hymn quiz', status: 'draft', type: 'quiz', totalPoints: 10, passingScore: 6,
    levelId: 'l1', subjectId: 's1', level: { id: 'l1', name: 'Level 1', number: 1 }, subject: { id: 's1', name: 'Coptic Hymns' },
    group: null, questions: [{ id: 'q1', questionText: 'Q', type: 'short_answer', correctAnswer: 'x', points: 10, orderIndex: 0 }],
    metadata: {}, _count: { questions: 1, submissions: 0 }, ...over,
  })

  const serveList = (assessments: any[]) =>
    mocks.get.mockImplementation((path: string) => {
      if (path === '/assessments') return Promise.resolve({ data: assessments, pagination: { page: 1, limit: 20, total: assessments.length, totalPages: 1 } })
      if (path === '/assessments/stats') return Promise.resolve({ total: 0, byStatus: [], grading: null })
      if (path === '/curriculum/levels') return Promise.resolve(levels)
      if (path === '/curriculum/subjects') return Promise.resolve(subjects)
      if (path === '/curriculum/academic-years') return Promise.resolve(years)
      if (path === '/students/groups/all') return Promise.resolve(flatGroups)
      if (typeof path === 'string' && path.startsWith('/curriculum/subjects/') && path.endsWith('/items')) return Promise.resolve(items)
      return Promise.resolve([])
    })

  it('offers everyone by default and sends it when the assessment is created', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)
    await user.click(await screen.findByText('New Assessment'))
    const form = within(await screen.findByRole('dialog'))

    expect((form.getByLabelText('Gender') as HTMLSelectElement).value).toBe('all')
    expect(form.getByRole('option', { name: 'All (boys and girls)' })).toBeInTheDocument()

    await fillRequired(user, form)
    await user.click(form.getByRole('button', { name: /Create Assessment/ }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalled())
    expect(createPayload()).toMatchObject({ gender: 'all', levelId: 'l1' })
  })

  it('narrows the audience to girls, alongside the level', async () => {
    const user = userEvent.setup()
    render(<AssessmentsPage />)
    await user.click(await screen.findByText('New Assessment'))
    const form = within(await screen.findByRole('dialog'))

    await fillRequired(user, form)
    await user.selectOptions(form.getByLabelText('Gender'), 'female')
    await user.click(form.getByRole('button', { name: /Create Assessment/ }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalled())
    expect(createPayload()).toMatchObject({ gender: 'female', levelId: 'l1' })
  })

  it('labels a boys-only or girls-only assessment in the list but not an everyone one', async () => {
    serveList([
      row({ id: 'a1', title: 'Girls hymn quiz', metadata: { gender: 'female' } }),
      row({ id: 'a2', title: 'Boys hymn quiz', metadata: { gender: 'male' } }),
      row({ id: 'a3', title: 'Open hymn quiz', metadata: { gender: 'all' } }),
      row({ id: 'a4', title: 'Old hymn quiz', metadata: null }),
    ])
    render(<AssessmentsPage />)

    await screen.findByText('Girls hymn quiz')
    expect(screen.getAllByText('Girls only')).toHaveLength(1)
    expect(screen.getAllByText('Boys only')).toHaveLength(1)
  })

  it('opens an existing assessment with its audience selected, and treats one with none recorded as everyone', async () => {
    const user = userEvent.setup()
    serveList([
      row({ id: 'a1', title: 'Girls hymn quiz', metadata: { gender: 'female' } }),
      row({ id: 'a4', title: 'Old hymn quiz', metadata: {} }),
    ])
    render(<AssessmentsPage />)

    await user.click(await screen.findByRole('button', { name: 'Edit Girls hymn quiz' }))
    let form = within(await screen.findByRole('dialog'))
    await waitFor(() => expect((form.getByLabelText('Gender') as HTMLSelectElement).value).toBe('female'))
    await user.click(form.getByRole('button', { name: /Cancel/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Edit Old hymn quiz' }))
    form = within(await screen.findByRole('dialog'))
    await waitFor(() => expect((form.getByLabelText('Gender') as HTMLSelectElement).value).toBe('all'))
  })

  it('saves a changed audience on an existing assessment', async () => {
    const user = userEvent.setup()
    serveList([row({ id: 'a1', title: 'Girls hymn quiz', metadata: { gender: 'female' } })])
    render(<AssessmentsPage />)

    await user.click(await screen.findByRole('button', { name: 'Edit Girls hymn quiz' }))
    const form = within(await screen.findByRole('dialog'))
    await waitFor(() => expect((form.getByLabelText('Gender') as HTMLSelectElement).value).toBe('female'))
    await user.selectOptions(form.getByLabelText('Gender'), 'all')
    await user.click(form.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() => expect(mocks.put).toHaveBeenCalled())
    expect(mocks.put.mock.calls[0][0]).toBe('/assessments/a1')
    expect(mocks.put.mock.calls[0][1]).toMatchObject({ gender: 'all' })
  })
})
