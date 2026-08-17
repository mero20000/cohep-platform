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
