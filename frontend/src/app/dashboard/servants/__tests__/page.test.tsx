import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { it, expect, vi, beforeEach } from 'vitest'
import ServantsPage from '../page'

vi.mock('next/image', () => ({
  default: (props: any) => {
    const { unoptimized, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />
  },
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  const iconNames = ['AlertTriangle', 'CalendarDays', 'Check', 'GraduationCap', 'LayoutGrid', 'Loader2', 'Pencil', 'Phone', 'Plus', 'Rows3', 'Search', 'Shield', 'Trash2', 'Upload', 'User', 'UserCheck', 'X']
  for (const name of iconNames) icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  return icons
})

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: (...a: any[]) => mockPost(...a), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/lib/school', () => ({
  getSchoolId: () => 'school-1',
}))

vi.mock('@/lib/grades', () => ({
  fetchGroups: vi.fn().mockResolvedValue([
    { id: 'group-1', name: 'Group A', status: 'active' },
    { id: 'group-2', name: 'Group B', status: 'active' },
  ]),
  fetchActiveGrades: vi.fn().mockResolvedValue([
    { id: 'g1', name: 'Grade 4', status: 'active', groupId: 'group-1', groupName: 'Group A' },
    { id: 'g2', name: 'Grade 5', status: 'active', groupId: 'group-2', groupName: 'Group B' },
  ]),
}))

const levels = [
  { id: 'level-1', name: 'Level 1', number: 1, status: 'active' },
]

const baseUser = {
  email: 'base@x.com',
  firstName: 'X',
  lastName: 'Y',
  isActive: true,
  schoolId: 'school-1',
  userRoles: [{ role: { id: 'r1', name: 'servant', displayName: 'Servant' } }],
}

const servants = [
  { id: 'u1', ...baseUser, firstName: 'Malak', lastName: 'Ahmed', email: 'malak@x.com', metadata: { groupId: 'group-1', grade: 'Grade 4' } },
  { id: 'u2', ...baseUser, firstName: 'John', lastName: 'Doe', email: 'john@x.com', metadata: { levelId: 'level-1', groupId: 'group-1' } },
]

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'u1', roles: ['super_admin'] }))
  mockGet.mockImplementation((path: string) => {
    if (path === '/servants') return Promise.resolve(servants)
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path.startsWith('/users/schools/me')) return Promise.resolve({})
    return Promise.resolve([])
  })
})

it('fills group when a grade is selected', async () => {
  render(<ServantsPage />)
  await userEvent.click(screen.getAllByText('Add Servant')[0])

  await userEvent.selectOptions(screen.getByLabelText('Grade'), 'Grade 5')

  const groupSelect = screen.getByLabelText('Group')
  expect(groupSelect).toHaveValue('group-2')
})

it('enables group select without a level (group-only assignment)', async () => {
  render(<ServantsPage />)
  await userEvent.click(screen.getByText('Add Servant'))
  const groupSelect = screen.getByLabelText('Group')
  expect(groupSelect).not.toBeDisabled()
  await userEvent.selectOptions(groupSelect, 'group-1')
  expect(groupSelect).toHaveValue('group-1')
})

it('sends grade + group in create metadata and renders grade badge on cards', async () => {
  render(<ServantsPage />)
  await userEvent.click(screen.getByText('Add Servant'))
  fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Malak' } })
  fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Ahmed' } })
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'malak@x.com' } })
  await userEvent.selectOptions(screen.getByLabelText('Grade'), 'Grade 4')
  await userEvent.click(within(screen.getByRole('dialog')).getByText('Add Servant'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/users', expect.objectContaining({ metadata: expect.objectContaining({ grade: 'Grade 4' }) })))
  expect(await screen.findByText('Grade 4', { selector: 'span' })).toBeInTheDocument()
})

it('selects multiple rows, shows toolbar, and bulk-deletes', async () => {
  render(<ServantsPage />)
  await userEvent.click(screen.getByRole('button', { name: 'Table' }))
  const table = await screen.findByRole('table')
  expect(table).toBeInTheDocument()
  const rowCbs = screen.getAllByRole('checkbox', { name: 'Select' })
  expect(rowCbs).toHaveLength(2)
  await userEvent.click(rowCbs[0])
  await userEvent.click(rowCbs[1])
  expect(screen.getByText('Delete selected (2)')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Delete selected (2)'))
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/users/bulk-delete', { ids: ['u1', 'u2'] }))
  await waitFor(() => expect(screen.queryByText('Delete selected (2)')).not.toBeInTheDocument())
})
