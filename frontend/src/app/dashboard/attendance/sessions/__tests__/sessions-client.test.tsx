import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SessionsPage from '../page'

const mockPost = vi.fn()

vi.mock('@/lib/http-client', () => ({
  http: {
    get: async (url: string) => {
      if (url.includes('/curriculum/levels') || url.includes('/students/groups')) return []
      if (url.includes('/attendance/student-search')) {
        return [
          {
            student: { id: 's1', studentCode: 'STU-1', firstName: 'Mina', lastName: 'G' },
            records: [{ status: 'present', recordedAt: '2026-09-10T00:00:00Z', attendanceSession: { id: 'sess-9', scheduledDate: '2026-09-10T00:00:00Z', status: 'in_progress' } }],
          },
        ]
      }
      return { data: [] }
    },
    post: (...a: any[]) => mockPost(...a),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

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
    expect(await screen.findByText('Level is required')).toBeInTheDocument()
    expect(screen.getByText('Group is required')).toBeInTheDocument()
    expect(screen.getByText('Date is required')).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })
})
