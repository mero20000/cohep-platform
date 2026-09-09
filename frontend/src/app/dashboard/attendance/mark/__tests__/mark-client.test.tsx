import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MarkClient } from '../mark-client'

const state = vi.hoisted(() => ({
  params: { sessionId: 'sess-1' as string | null, prefill: null as string | null, subjectItemId: null as string | null },
  twoStudents: false,
  saved: null as any[] | null,
}))

const TWO = [
  { student: { id: 's1', firstName: 'Mina', lastName: 'G' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' },
  { student: { id: 's2', firstName: 'John', lastName: 'D' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' },
]
const ONE = [TWO[0]]

const mockGet = vi.fn(async (url: string) => {
  if (url.startsWith('/attendance/sessions/')) {
    if (state.saved) return { id: 'sess-1', status: 'in_progress', attendanceRecords: state.saved }
    return { id: 'sess-1', status: 'in_progress', attendanceRecords: state.twoStudents ? TWO : ONE }
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
vi.mock('@/lib/http-client', () => ({ http: { get: (...a: any[]) => mockGet(...a), post: (...a: any[]) => mockPost(...a), put: vi.fn() } }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: (k: string) => (state.params as any)[k] ?? null }) }))

beforeEach(() => {
  state.params = { sessionId: 'sess-1', prefill: null, subjectItemId: null }
  state.twoStudents = false
  state.saved = null
  mockGet.mockClear()
  mockPost.mockClear()
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
})
