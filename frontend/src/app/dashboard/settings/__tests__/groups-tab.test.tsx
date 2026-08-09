import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GroupsTab } from '../_components/groups-tab'

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  for (const name of ['Plus', 'Pencil', 'Trash2', 'Loader2', 'Check', 'X']) {
    icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return icons
})

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, children, footer, title, description }: any) =>
    open ? (
      <div role="dialog" data-testid="modal">
        {title && <h2>{title}</h2>}
        {description && <p>{description}</p>}
        {children}
        {footer}
      </div>
    ) : null,
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm, confirmLabel, message }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{message}</p>
        <button onClick={onConfirm}>{confirmLabel || 'Delete'}</button>
      </div>
    ) : null,
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

const mockGroups = [
  { id: 'grp1', name: 'Group A', status: 'active', orderIndex: 0 },
  { id: 'grp2', name: 'Group B', status: 'inactive', orderIndex: 1 },
]

describe('GroupsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.get.mockImplementation((url: string) => {
      if (url === '/students/groups/all') return Promise.resolve(mockGroups)
      return Promise.reject(new Error(`Unhandled get: ${url}`))
    })
  })

  it('renders groups with name, description and status', async () => {
    render(<GroupsTab />)

    expect(await screen.findByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Group B')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows an empty state when there are no groups', async () => {
    mocks.get.mockImplementation((url: string) => {
      if (url === '/students/groups/all') return Promise.resolve([])
      return Promise.reject(new Error(`Unhandled get: ${url}`))
    })

    render(<GroupsTab />)
    expect(await screen.findByText('No groups yet. Click "Add Group" to create one.')).toBeInTheDocument()
  })

  it('create form has no level selector and creates by posting to /students/groups', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValue({ id: 'grp3', name: 'Group C', status: 'active' })
    render(<GroupsTab />)

    await user.click(await screen.findByText('Add Group'))

    expect(await screen.findByText('Add New Group')).toBeInTheDocument()
    expect(screen.queryByText('Level')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Level/)).not.toBeInTheDocument()

    await user.type(await screen.findByLabelText('Group Name *'), 'Group C')
    await user.type(await screen.findByLabelText('Arabic Name'), 'المجموعة ج')
    await user.type(await screen.findByLabelText('Description'), 'Teens group')
    await user.click(await screen.findByText('Create Group'))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        '/students/groups',
        { name: 'Group C', nameAr: 'المجموعة ج', description: 'Teens group' },
        { schoolId: 'niangelos-main' },
      )
    })
  })

  it('creates a group without optional fields when they are empty', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValue({ id: 'grp3', name: 'Group C', status: 'active' })
    render(<GroupsTab />)

    await user.click(await screen.findByText('Add Group'))
    await user.type(await screen.findByLabelText('Group Name *'), 'Group C')
    await user.click(await screen.findByText('Create Group'))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        '/students/groups',
        { name: 'Group C', nameAr: undefined, description: undefined },
        { schoolId: 'niangelos-main' },
      )
    })
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('success', 'Group created')
    })
  })
})