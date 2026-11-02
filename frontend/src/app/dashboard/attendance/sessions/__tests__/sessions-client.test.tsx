import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SessionsPage from '../page'

const mockPost = vi.fn()
const mockPush = vi.fn()
const state = vi.hoisted(() => ({ sessions: [] as any[], groups: [] as any[], search: {} as Record<string, string> }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (...a: any[]) => mockPush(...a) }),
  useSearchParams: () => ({ get: (k: string) => state.search[k] ?? null }),
}))

vi.mock('@/lib/http-client', () => ({
  http: {
    get: async (url: string) => {
      if (url.includes('/students/groups')) return state.groups
      if (url.includes('/curriculum/levels') || url.includes('/grades')) return []
      if (url.includes('/attendance/student-search')) {
        return [
          {
            student: { id: 's1', studentCode: 'STU-1', firstName: 'Mina', lastName: 'G' },
            records: [{ status: 'present', recordedAt: '2026-09-10T00:00:00Z', attendanceSession: { id: 'sess-9', scheduledDate: '2026-09-10T00:00:00Z', status: 'in_progress' } }],
          },
        ]
      }
      return { data: state.sessions }
    },
    post: (...a: any[]) => mockPost(...a),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ id, value, onChange, error }: any) => (
    <>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
      {error && <p>{error}</p>}
    </>
  ),
}))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

beforeEach(() => {
  state.sessions = []; state.groups = []; state.search = {}
  mockPost.mockReset(); mockPush.mockReset()
  localStorage.setItem('user', JSON.stringify({ id: 'u1', roles: ['admin'] }))
})

const future = new Date(Date.now() + 5 * 86400000).toISOString()
const past = '2026-01-04T00:00:00.000Z'
const base = { servant: { id: 'u1', firstName: 'A', lastName: 'B' }, level: null, grade: null }

describe('Sessions manage', () => {
  it('renders manage heading', () => { render(<SessionsPage /> as any); expect(screen.getByText(/Manage sessions|إدارة الجلسات/i)).toBeInTheDocument() })

  it('finds a student and links to their session marking view', async () => {
    render(<SessionsPage /> as any)
    fireEvent.change(screen.getByRole('searchbox', { name: /Find a student/i }), { target: { value: 'Mina' } })
    await waitFor(() => expect(screen.getByText('Mina G')).toBeInTheDocument())
    const markLink = screen.getByRole('link', { name: /^Mark$/i })
    expect(markLink.getAttribute('href')).toBe('/dashboard/attendance/mark?sessionId=sess-9')
    expect(screen.getByRole('link', { name: /^File$/i }).getAttribute('href')).toBe('/dashboard/students?studentId=s1')
  })

  it('shows inline errors and blocks submit when required fields are empty', async () => {
    mockPost.mockClear()
    render(<SessionsPage /> as any)
    fireEvent.click(screen.getByRole('button', { name: /New Session/i }))
    await screen.findByText(/New Attendance Session/i)
    fireEvent.click(screen.getByRole('button', { name: /^Create Session$/i }))
    expect(await screen.findByText('Date is required')).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })
  describe('session types', () => {
    const openCreate = async () => {
      render(<SessionsPage /> as any)
      fireEvent.click(screen.getByRole('button', { name: /New Session/i }))
      await screen.findByText(/New Attendance Session/i)
    }

    it('create dialog starts with a Session type drop-down (Class / Liturgy / Event)', async () => {
      await openCreate()
      const select = screen.getByLabelText(/Session type/i) as HTMLSelectElement
      expect(Array.from(select.options).map(o => o.textContent)).toEqual(['Class', 'Liturgy', 'Event'])
      expect(select.value).toBe('class')
    })

    it('group staff cannot pick Event', async () => {
      localStorage.setItem('user', JSON.stringify({ id: 'u1', roles: ['servant'] }))
      await openCreate()
      const select = screen.getByLabelText(/Session type/i) as HTMLSelectElement
      expect(Array.from(select.options).map(o => o.textContent)).toEqual(['Class', 'Liturgy'])
    })

    it('an event needs a title and an audience; nothing is posted until valid', async () => {
      state.groups = [{ id: 'g1', name: 'Group A' }, { id: 'g2', name: 'Group B' }]
      await openCreate()
      fireEvent.change(screen.getByLabelText(/Session type/i), { target: { value: 'event' } })
      fireEvent.click(screen.getByRole('button', { name: /^Create Session$/i }))
      expect(await screen.findByText('An event needs a title')).toBeInTheDocument()
      expect(screen.getByText('Choose at least one group, or all groups')).toBeInTheDocument()
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('creates a multi-group event with its audience', async () => {
      state.groups = [{ id: 'g1', name: 'Group A' }, { id: 'g2', name: 'Group B' }]
      mockPost.mockResolvedValue({ id: 'ev1' })
      await openCreate()
      fireEvent.change(screen.getByLabelText(/Session type/i), { target: { value: 'event' } })
      fireEvent.change(screen.getByLabelText(/Event title/i), { target: { value: 'Picnic' } })
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Group A' }))
      fireEvent.click(screen.getByRole('checkbox', { name: 'Group B' }))
      fireEvent.change(document.getElementById('session-form-date') as HTMLInputElement, { target: { value: '2026-12-20' } })
      fireEvent.click(screen.getByRole('button', { name: /^Create Session$/i }))
      await waitFor(() => expect(mockPost).toHaveBeenCalled())
      const [url, body] = mockPost.mock.calls[0]
      expect(url).toBe('/attendance/sessions')
      expect(body).toMatchObject({ type: 'event', title: 'Picnic', scheduledDate: '2026-12-20' })
      expect(body.targets.map((t: any) => t.groupId)).toEqual(['g1', 'g2'])
      expect(body.allGroups).toBeUndefined()
      expect(body.startNow).toBeUndefined()
    })

    it('"All groups" sends allGroups and no group list; "Start now" opens the session for marking', async () => {
      mockPost.mockResolvedValue({ id: 'lit9' })
      await openCreate()
      fireEvent.change(screen.getByLabelText(/Session type/i), { target: { value: 'liturgy' } })
      fireEvent.click(screen.getByRole('checkbox', { name: /All groups/i }))
      fireEvent.click(screen.getByRole('checkbox', { name: /Start now/i }))
      fireEvent.click(screen.getByRole('button', { name: /^Create Session$/i }))
      await waitFor(() => expect(mockPost).toHaveBeenCalled())
      const body = mockPost.mock.calls[0][1]
      expect(body).toMatchObject({ type: 'liturgy', allGroups: true, startNow: true })
      expect(body.targets).toBeUndefined()
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/attendance/mark?sessionId=lit9'))
    })

    it('opens the existing liturgy when one already exists for that group and day (409)', async () => {
      mockPost.mockRejectedValue(Object.assign(new Error('exists'), { status: 409, body: { existingSessionId: 'old1' } }))
      state.search = { new: 'liturgy' }
      render(<SessionsPage /> as any)
      await screen.findByText(/New Attendance Session/i)
      fireEvent.click(screen.getByRole('checkbox', { name: /All groups/i }))
      fireEvent.click(screen.getByRole('button', { name: /^Create Session$/i }))
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/attendance/mark?sessionId=old1'))
    })

    it('?new=liturgy opens the dialog preset to Liturgy with Start now ticked', async () => {
      state.search = { new: 'liturgy' }
      render(<SessionsPage /> as any)
      await screen.findByText(/New Attendance Session/i)
      expect((screen.getByLabelText(/Session type/i) as HTMLSelectElement).value).toBe('liturgy')
      expect((screen.getByRole('checkbox', { name: /Start now/i }) as HTMLInputElement).checked).toBe(true)
    })

    it('lists all types with badges, filters by type chip, and treats legacy "recorded" as completed', async () => {
      state.sessions = [
        { id: 'c1', type: 'class', status: 'scheduled', scheduledDate: past, group: { id: 'g1', name: 'Class Group' }, ...base },
        { id: 'l1', type: 'liturgy', status: 'recorded', scheduledDate: past, group: { id: 'g1', name: 'Group A' }, targets: [{ groupId: 'g1', group: { name: 'Group A' } }], ...base },
        { id: 'e1', type: 'event', title: 'Picnic', location: 'Park', status: 'scheduled', scheduledDate: past, group: null, allGroups: true, ...base },
      ]
      render(<SessionsPage /> as any)
      await screen.findByText('Picnic')
      expect(screen.getByText('Class Group')).toBeInTheDocument()
      expect(screen.getByText(/All groups · Park/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('tab', { name: /Liturgy/ }))
      expect(screen.queryByText('Picnic')).not.toBeInTheDocument()
      expect(screen.queryByText('Class Group')).not.toBeInTheDocument()
      // legacy liturgy shows as Completed and can be re-opened
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: /Re-open session/i })).toBeInTheDocument()
    })

    it('a future liturgy/event cannot be recorded yet, but a future class still can', async () => {
      state.sessions = [
        { id: 'c1', type: 'class', status: 'scheduled', scheduledDate: future, group: { id: 'g1', name: 'Class Group' }, ...base },
        { id: 'e1', type: 'event', title: 'Future Event', status: 'scheduled', scheduledDate: future, group: null, allGroups: true, ...base },
      ]
      render(<SessionsPage /> as any)
      await screen.findByText('Future Event')
      expect(screen.getAllByRole('link', { name: /^Record$/i })).toHaveLength(1) // the class
      expect(screen.getByText(/^Opens /)).toBeInTheDocument()
    })
  })
})
