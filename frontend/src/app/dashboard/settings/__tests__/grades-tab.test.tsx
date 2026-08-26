import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GradesTab } from '../_components/grades-tab'

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, children }: any) =>
    open ? <div role="dialog" data-testid="modal">{children}</div> : null,
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  for (const name of ['Plus', 'Pencil', 'Trash2', 'Loader2', 'GraduationCap', 'Search', 'X', 'CalendarDays']) {
    icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return icons
})

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

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/http-client', () => ({
  http: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}))

const mockGrades = [
  { id: 'g1', name: 'Grade 4', nameAr: 'الصف الرابع', status: 'active', groupId: 'grp1', groupName: 'Group A', studentCount: 12 },
  { id: 'g2', name: 'Grade 5', nameAr: null, status: 'inactive', groupId: 'grp2', groupName: 'Group B', studentCount: 0 },
]

const mockGroups = [
  { id: 'grp1', name: 'Group A', status: 'active' },
  { id: 'grp2', name: 'Group B', status: 'active' },
  { id: 'grp3', name: 'Group C', status: 'inactive' },
]

describe('GradesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.get.mockImplementation((url: string) => {
      if (url === '/grades') return Promise.resolve(mockGrades)
      if (url === '/students/groups/all') return Promise.resolve(mockGroups)
      return Promise.reject(new Error(`Unhandled get: ${url}`))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders grades with name, group and student count', async () => {
    render(<GradesTab />)

    expect(await screen.findByText('Grade 4')).toBeInTheDocument()
    expect(screen.getByText('Grade 5')).toBeInTheDocument()
    expect(screen.getByText('Group A', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('Group B', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Active', { selector: '[data-testid="badge"]' })).toBeInTheDocument()
    expect(screen.getByText('Inactive', { selector: '[data-testid="badge"]' })).toBeInTheDocument()
  })

  it('creates a grade and posts to /grades with the selected group', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValue({ id: 'g3', name: 'Grade 6', groupId: 'grp2', status: 'active' })
    render(<GradesTab />)

    await user.click(await screen.findByText('Add Grade'))
    await user.type(await screen.findByLabelText('Grade Name *'), 'Grade 6')
    await user.selectOptions(await screen.findByLabelText('Group *'), 'grp2')
    await user.click(screen.getAllByText('Add Grade')[1])

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/grades', { name: 'Grade 6', nameAr: undefined, groupId: 'grp2' }, { schoolId: 'niangelos-main' })
    })
    expect(await screen.findByText('Grade 6')).toBeInTheDocument()
  })

  it('warns before changing the group of an existing grade', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<GradesTab />)

    await user.click(await screen.findByLabelText('Edit Grade 5'))
    await user.selectOptions(await screen.findByLabelText('Group *'), 'grp1')
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
    })
    expect(mocks.patch).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('proceeds with the grade group change when confirmed', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocks.patch.mockResolvedValue({ id: 'g2', name: 'Grade 5', groupId: 'grp1', status: 'inactive' })
    render(<GradesTab />)

    await user.click(await screen.findByLabelText('Edit Grade 5'))
    await user.selectOptions(await screen.findByLabelText('Group *'), 'grp1')
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith('/grades/g2', { name: 'Grade 5', nameAr: undefined, groupId: 'grp1', status: 'inactive' })
    })
  })

  it('shows an empty state when there are no grades', async () => {
    mocks.get.mockImplementation((url: string) => {
      if (url === '/grades') return Promise.resolve([])
      if (url === '/students/groups/all') return Promise.resolve(mockGroups)
      return Promise.reject(new Error(`Unhandled get: ${url}`))
    })

    render(<GradesTab />)
    expect(await screen.findByText('No grades yet')).toBeInTheDocument()
  })
})
