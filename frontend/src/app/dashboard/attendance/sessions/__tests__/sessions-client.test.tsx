import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SessionsPage from '../page'

const mockPost = vi.fn()

vi.mock('@/lib/http-client', () => ({
  http: {
    get: async (url: string) => {
      if (url.includes('/curriculum/levels') || url.includes('/students/groups')) return []
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
