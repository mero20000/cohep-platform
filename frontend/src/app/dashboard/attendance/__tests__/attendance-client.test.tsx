import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { buildMarkRedirect } from '../page'
import { MarkClient } from '../mark/mark-client'

const state = vi.hoisted(() => ({
  params: { sessionId: 'sess-1' as string | null, prefill: 'present' as string | null, subjectItemId: 'item-9' as string | null },
}))

const mockGet = vi.fn(async (url: string) => {
  if (url.startsWith('/attendance/sessions/')) {
    return {
      id: 'sess-1',
      status: 'in_progress',
      attendanceRecords: [
        { student: { id: 's1', firstName: 'Mina', lastName: 'G' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' },
      ],
    }
  }
  return []
})

vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: vi.fn(), put: vi.fn() },
}))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (k: string) => (state.params as any)[k] ?? null }),
}))

beforeEach(() => {
  state.params = { sessionId: 'sess-1', prefill: 'present', subjectItemId: 'item-9' }
  mockGet.mockClear()
})

describe('legacy attendance route compat', () => {
  it('redirect preserves the full deep-link query (sessionId, prefill, subjectItemId)', () => {
    expect(
      buildMarkRedirect({ sessionId: 'sess-1', prefill: 'present', subjectItemId: 'item-9' }),
    ).toBe('/dashboard/attendance/mark?sessionId=sess-1&prefill=present&subjectItemId=item-9')
  })

  it('?sessionId=sess-1&prefill=present lands on Mark pre-marked present', async () => {
    render(<MarkClient />)
    await waitFor(() =>
      expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Present - Mina G/i }).getAttribute('aria-pressed'),
      ).toBe('true'),
    )
  })
})
