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
