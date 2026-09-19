import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MarkClient } from '../mark-client'

const state = vi.hoisted(() => ({
  params: { sessionId: 'sess-1' as string | null, prefill: null as string | null, subjectItemId: null as string | null },
  twoStudents: false,
  saved: null as any[] | null,
  status: 'in_progress' as string,
}))

const TWO = [
  { student: { id: 's1', firstName: 'Mina', lastName: 'G' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' },
  { student: { id: 's2', firstName: 'John', lastName: 'D' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' },
]
const ONE = [TWO[0]]

const mockGet = vi.fn(async (url: string) => {
  if (url.startsWith('/attendance/sessions/')) {
    if (state.saved) return { id: 'sess-1', status: state.status, attendanceRecords: state.saved }
    return { id: 'sess-1', status: state.status, attendanceRecords: state.twoStudents ? TWO : ONE }
  }
  return []
})
const mockPost = vi.fn(async (url: string, body?: any) => {
  if (url.endsWith('/mark') && body?.records) {
    state.saved = body.records.map((r: any) => ({
      student: r.studentId === 's2' ? { id: 's2', firstName: 'John', lastName: 'D' } : { id: 's1', firstName: 'Mina', lastName: 'G' },
      status: r.status, behavior: 0, participation: 0, attendedLiturgy: false, note: '',
    }))
    return { ok: true }
  }
  return { session: { id: 'sess-1' } }
})
const mockPut = vi.fn(async () => ({ ok: true }))
vi.mock('@/lib/http-client', () => ({ http: { get: (...a: any[]) => mockGet(...a), post: (...a: any[]) => mockPost(...a), put: (...a: any[]) => mockPut(...a) } }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: (k: string) => (state.params as any)[k] ?? null }) }))

beforeEach(() => {
  state.params = { sessionId: 'sess-1', prefill: null, subjectItemId: null }
  state.twoStudents = false
  state.saved = null
  state.status = 'in_progress'
  mockGet.mockClear()
  mockPost.mockClear()
  mockPut.mockClear()
})

describe('MarkClient', () => {
  it('loads sessionId deep-link and shows status group with save bar', async () => {
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    expect(screen.getByText(/0\/1/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save & Finalize/i })).toBeInTheDocument()
  })

  it('prefill=present does not clobber edits on quiet reload after save', async () => {
    state.params.prefill = 'present'
    state.twoStudents = true
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    // Prefill applied once on initial load: both present.
    await waitFor(() => expect(screen.getByRole('button', { name: /Present - Mina G/i }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: /Present - John D/i }).getAttribute('aria-pressed')).toBe('true')

    // Change one record, then save.
    fireEvent.click(screen.getByRole('button', { name: /Absent - Mina G/i }))
    expect(screen.getByRole('button', { name: /Absent - Mina G/i }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('/mark'), expect.anything()))
    // Quiet reload after save must not force all-present again.
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.getByRole('button', { name: /Absent - Mina G/i }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: /Present - John D/i }).getAttribute('aria-pressed')).toBe('true')

    const payload = mockPost.mock.calls.find((c) => String(c[0]).endsWith('/mark'))?.[1]
    const statuses = Object.fromEntries(payload.records.map((r: any) => [r.studentId, r.status]))
    expect(statuses).toEqual({ s1: 'absent', s2: 'present' })
  })

  it('Save & Finalize persists marks, locks the session, and preserves marks on reload', async () => {
    state.twoStudents = true
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Present - Mina G/i }))
    fireEvent.click(screen.getByRole('button', { name: /Present - John D/i }))
    fireEvent.click(screen.getByRole('button', { name: /Save & Finalize/i }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('/mark'), expect.anything()))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/attendance/sessions/sess-1', { status: 'completed' }))
    // Quiet reload after finalize must preserve server truth.
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.getByRole('button', { name: /Present - Mina G/i }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: /Present - John D/i }).getAttribute('aria-pressed')).toBe('true')
  })

  it('completed session renders read-only with Re-open and finalize lock copy', async () => {
    state.status = 'completed'
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Re-open/i })).toBeInTheDocument())
    expect(screen.getByText(/finalized|locked|read-only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save & Finalize/i })).not.toBeInTheDocument()
    // No interactive status buttons in read-only mode.
    expect(screen.queryByRole('button', { name: /Present - Mina G/i })).not.toBeInTheDocument()
  })

  it('Re-open issues PUT in_progress and reloads the session', async () => {
    state.status = 'completed'
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Re-open/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Re-open/i }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/attendance/sessions/sess-1', { status: 'in_progress' }))
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('search filters students by name', async () => {
    state.twoStudents = true
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    expect(screen.getByRole('group', { name: /Status - John D/i })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: /Search student name/i }), { target: { value: 'john' } })
    expect(screen.queryByRole('group', { name: /Status - Mina G/i })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Status - John D/i })).toBeInTheDocument()
    expect(screen.getByText(/Showing 1 of 2/i)).toBeInTheDocument()
    // Clearing restores the full list.
    fireEvent.click(screen.getByRole('button', { name: /Clear search/i }))
    expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument()
  })

  it('unmarked-only toggle hides marked students', async () => {
    state.twoStudents = true
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Present - Mina G/i }))
    fireEvent.click(screen.getByRole('button', { name: /Unmarked \(1\)/i }))
    expect(screen.queryByRole('group', { name: /Status - Mina G/i })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Status - John D/i })).toBeInTheDocument()
  })

  it('sorts the roster alphabetically by student name', async () => {
    state.twoStudents = true
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    // DOM order follows the alphabetical roster (John D before Mina G).
    const cards = Array.from(document.querySelectorAll('[data-student-id]'))
    expect(cards.map((c) => c.getAttribute('data-student-id'))).toEqual(['s2', 's1'])
  })

  it('status controls render in compact 4-column layout', async () => {
    render(<MarkClient />)
    const group = await waitFor(() => screen.getByRole('group', { name: /Status - Mina G/i }))
    expect(group.className).toMatch(/grid-cols-4/)
  })

  it('mark-all confirm dialog marks all visible students', async () => {
    state.twoStudents = true
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /All Present/i }))
    // Confirm modal scopes to all visible students in this session.
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/all 2 students in this session/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Confirm/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Present - Mina G/i }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: /Present - John D/i }).getAttribute('aria-pressed')).toBe('true')
  })
})
