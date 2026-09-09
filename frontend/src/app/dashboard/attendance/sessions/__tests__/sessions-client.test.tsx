import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SessionsPage from '../page'

vi.mock('@/lib/http-client', () => ({
  http: {
    get: async (url: string) => {
      if (url.includes('/curriculum/levels') || url.includes('/students/groups')) return []
      return { data: [] }
    },
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

describe('Sessions manage', () => {
  it('renders manage heading', () => { render(<SessionsPage /> as any); expect(screen.getByText(/Manage sessions|إدارة الجلسات/i)).toBeInTheDocument() })
})
