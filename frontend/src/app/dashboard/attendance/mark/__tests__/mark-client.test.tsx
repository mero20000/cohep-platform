import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MarkClient } from '../mark-client'

const mockGet = vi.fn(async (url:string) => {
  if (url.startsWith('/attendance/sessions/')) return { id: 'sess-1', status: 'in_progress', attendanceRecords: [{ student: { id: 's1', firstName: 'Mina', lastName: 'G' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' }] }
  return []
})
vi.mock('@/lib/http-client', () => ({ http: { get: (...a:any[])=>mockGet(...a), post: vi.fn(), put: vi.fn() } }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: (k:string)=> k==='sessionId' ? 'sess-1' : null }) }))

describe('MarkClient', () => {
  it('loads sessionId deep-link and shows status group with save bar', async () => {
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    expect(screen.getByText(/0\/1/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save & Finalize/i })).toBeInTheDocument()
  })
})
