import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StudentsPage from '../page'

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: any) => {
    const { unoptimized, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', async () => (await import('@/test/lucide-mock')).lucideMock())

vi.mock('@/components/ui/pagination', () => ({
  Pagination: ({ page, totalPages, total, onPageChange }: any) => (
    <div data-testid="pagination">
      <span>Page {page} of {totalPages}</span>
      <span>Total: {total}</span>
      <button onClick={() => onPageChange(page + 1)}>Next</button>
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Prev</button>
    </div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}))

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

const API = 'http://localhost:3001/api'

const mockStudents = {
  data: [
    {
      id: '1',
      studentCode: 'STU-00001',
      firstName: 'Malak',
      lastName: 'Ahmed',
      firstNameAr: 'ملك',
      lastNameAr: 'أحمد',
      dateOfBirth: '2015-06-15T00:00:00Z',
      gender: 'female',
      churchName: 'St. Mary',
      gradeId: 'grade-1', grade: { id: 'grade-1', name: 'Grade 4' },
      photoUrl: null,
      levelId: 'level-1',
      groupId: 'group-1',
      status: 'active',
      enrollmentDate: '2026-01-01T00:00:00Z',
      level: { id: 'level-1', name: 'Level 1', number: 1 },
      group: { id: 'group-1', name: 'Group A' },
    },
    {
      id: '2',
      studentCode: 'STU-00002',
      firstName: 'John',
      lastName: 'Doe',
      firstNameAr: null,
      lastNameAr: null,
      dateOfBirth: '2014-03-20T00:00:00Z',
      gender: 'male',
      churchName: null,
      gradeId: 'grade-2', grade: { id: 'grade-2', name: 'Grade 6' },
      photoUrl: null,
      levelId: 'level-1',
      groupId: 'group-1',
      status: 'active',
      enrollmentDate: '2026-01-15T00:00:00Z',
      level: { id: 'level-1', name: 'Level 1', number: 1 },
      group: { id: 'group-1', name: 'Group A' },
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
}

const mockLevels = [
  { id: 'level-1', name: 'Level 1', number: 1, status: 'active' },
  { id: 'level-2', name: 'Level 2', number: 2, status: 'active' },
]

const mockGroups = [
  { id: 'group-1', name: 'Group A', status: 'active', orderIndex: 0 },
  { id: 'group-2', name: 'Group B', status: 'active', orderIndex: 1 },
]

const mockGrades = [
  { id: 'grade-1', name: 'Grade 4', status: 'active' },
  { id: 'grade-2', name: 'Grade 6', status: 'active' },
]

const mockChurches = [
  { id: 'church-1', name: 'St. Mary', city: 'Cairo' },
  { id: 'church-2', name: 'St. Mark', city: 'Alexandria' },
]

function createFetchMock(empty = false) {
  return vi.fn((url: string | URL | RequestInfo, options?: any) => {
    if (url.toString().startsWith(`${API}/students?page=1&limit=20`)) {
      const data = empty ? { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } : mockStudents
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response)
    }
    if (url.toString().startsWith(`${API}/students/groups/all`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(empty ? [] : mockGroups) } as Response)
    }
    if (url.toString().startsWith(`${API}/curriculum/levels`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(empty ? [] : mockLevels) } as Response)
    }
    if (url.toString().startsWith(`${API}/grades`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(empty ? [] : mockGrades) } as Response)
    }
    if (url.toString().startsWith(`${API}/churches`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(empty ? [] : mockChurches) } as Response)
    }
    if (url.toString().startsWith(`${API}/students?`) && url.toString().includes('search=')) {
      const searched = url.toString().includes('Malak')
        ? { data: [mockStudents.data[0]], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }
        : { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(searched) } as Response)
    }
    if (url.toString().startsWith(`${API}/students?limit=1000`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStudents) } as Response)
    }
    if (url.toString().includes('/students/') && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'new-1', ...JSON.parse(options.body), studentCode: 'STU-00003' }),
      } as Response)
    }
    if (url.toString().includes('/students/') && options?.method === 'PUT') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockStudents.data[0], ...JSON.parse(options.body) }) } as Response)
    }
    if (url.toString().includes('/students/') && options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response)
    }
    if (url.toString().startsWith(`${API}/users/schools/me`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(empty ? {} : { church: { name: 'St. Mark' } }) } as Response)
    }
    if (url.toString().startsWith(`${API}/students/stats`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 2, active: 2 }) } as Response)
    }
    if (url.toString().startsWith(`${API}/users?`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`))
  })
}

describe('StudentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'u1', roles: ['super_admin'] }))
    globalThis.fetch = createFetchMock()
  })

  describe('Initial Render', () => {
    it('renders the page title', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('Students')).toBeInTheDocument()
    })

    it('shows loading state initially', () => {
      render(<StudentsPage />)
      expect(screen.getByText('Students')).toBeInTheDocument()
      expect(screen.queryByText('Malak Ahmed')).not.toBeInTheDocument()
    })

    it('renders Add Student button', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('Add Student')).toBeInTheDocument()
    })

    it('renders Export and Import buttons', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('Export')).toBeInTheDocument()
      expect(await screen.findByText('Import')).toBeInTheDocument()
    })

    it('renders search input', async () => {
      render(<StudentsPage />)
      expect(await screen.findByPlaceholderText('Search by name or code...')).toBeInTheDocument()
    })

    it('renders filter dropdowns', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('All Levels')).toBeInTheDocument()
      expect(await screen.findByText('All Groups')).toBeInTheDocument()
      expect(await screen.findByText('All Status')).toBeInTheDocument()
    })
  })

  describe('Student List', () => {
    it('displays students after loading', async () => {
      render(<StudentsPage />)
      expect((await screen.findAllByText('Malak Ahmed')).length).toBeGreaterThan(0)
      expect((await screen.findAllByText('John Doe')).length).toBeGreaterThan(0)
    })

    it('shows student codes', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('STU-00001')).toBeInTheDocument()
      expect(await screen.findByText('STU-00002')).toBeInTheDocument()
    })

    it('shows student count', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('2 students enrolled')).toBeInTheDocument()
    })

    it('shows pagination', async () => {
      render(<StudentsPage />)
      expect(await screen.findByTestId('pagination')).toBeInTheDocument()
    })

    it('shows status badges', async () => {
      render(<StudentsPage />)
      const badges = await screen.findAllByTestId('badge')
      expect(badges.length).toBeGreaterThan(0)
      expect(badges[0]).toHaveTextContent('Active')
    })

    it('shows action buttons per student', async () => {
      render(<StudentsPage />)
      const eyeButtons = await screen.findAllByLabelText(/View/)
      const editButtons = await screen.findAllByLabelText(/Edit/)
      const deleteButtons = await screen.findAllByLabelText(/Delete/)
      expect(eyeButtons.length).toBe(4)
      expect(editButtons.length).toBe(4)
      expect(deleteButtons.length).toBe(4)
    })
  })

  describe('Search', () => {
    it('filters when typing search and pressing Enter', async () => {
      const user = userEvent.setup()
      render(<StudentsPage />)

      const searchInput = await screen.findByPlaceholderText('Search by name or code...')
      await user.type(searchInput, 'Malak')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        const calls = (fetch as any).mock.calls.filter(
          ([url]: string[]) => url.includes('search=Malak')
        )
        expect(calls.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Create Student', () => {
    it('opens add student modal on button click', async () => {
      const user = userEvent.setup()
      render(<StudentsPage />)

      await user.click(await screen.findByText('Add Student'))

      expect(await screen.findByText('Add New Student')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getAllByText('Add Student').length).toBe(2)
    })

    it('shows required form fields in modal', async () => {
      const user = userEvent.setup()
      render(<StudentsPage />)

      await user.click(await screen.findByText('Add Student'))

      expect(await screen.findByText('Name *')).toBeInTheDocument()
      expect(await screen.findByText('Date of Birth *')).toBeInTheDocument()
      expect(await screen.findByText('Gender *')).toBeInTheDocument()
      expect(await screen.findByText('Level *')).toBeInTheDocument()
      expect(screen.getAllByText('Group').length).toBeGreaterThan(0)
    })

    it('closes modal when clicking Cancel', async () => {
      const user = userEvent.setup()
      render(<StudentsPage />)

      await user.click(await screen.findByText('Add Student'))
      expect(await screen.findByText('Add New Student')).toBeInTheDocument()

      await user.click(screen.getByText('Cancel'))
      await waitFor(() => {
        expect(screen.queryByText('Add New Student')).not.toBeInTheDocument()
      })
    })

    it('shows validation error when submitting empty form', async () => {
      const user = userEvent.setup()
      render(<StudentsPage />)

      await user.click(await screen.findByText('Add Student'))
      await user.click(screen.getAllByText('Add Student')[1])

      expect(await screen.findByText('Please fill all required fields')).toBeInTheDocument()
    })
  })

  describe('Edit Student', () => {
    it('opens edit modal when clicking edit button', async () => {
      const user = userEvent.setup()
      render(<StudentsPage />)

      const editButtons = await screen.findAllByLabelText(/Edit/)
      await user.click(editButtons[0])

      expect(await screen.findByText('Edit Student')).toBeInTheDocument()
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })

  describe('Student Detail', () => {
    it('opens detail modal when clicking view', async () => {
      const user = userEvent.setup()
      render(<StudentsPage />)

      const eyeButtons = await screen.findAllByLabelText(/View/)
      await user.click(eyeButtons[0])

      expect(await screen.findByText('Student Details')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows empty message when no students', async () => {
      globalThis.fetch = createFetchMock(true)

      render(<StudentsPage />)
      expect(await screen.findByText('No students enrolled yet')).toBeInTheDocument()
      expect(await screen.findByText('Add first student')).toBeInTheDocument()
    })
  })

  describe('Filters', () => {
    it('renders level filter dropdown with options', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('All Levels')).toBeInTheDocument()
    })

    it('renders status filter dropdown', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('All Status')).toBeInTheDocument()
    })

    it('renders group filter with All Groups and lists groups', async () => {
      render(<StudentsPage />)
      expect(await screen.findByText('All Groups')).toBeInTheDocument()
      const groupSelect = screen.getByLabelText('Filter by group')
      expect(groupSelect).toBeEnabled()
      expect(await screen.findByRole('option', { name: 'Group A' })).toBeInTheDocument()
      expect(await screen.findByRole('option', { name: 'Group B' })).toBeInTheDocument()
    })
  })

  describe('Import', () => {
    it('opens import modal when clicking Import button', async () => {
      const user = userEvent.setup()
      render(<StudentsPage />)

      await user.click(await screen.findByText('Import'))

      expect(await screen.findByText('Import Students from CSV')).toBeInTheDocument()
    })
  })
})
