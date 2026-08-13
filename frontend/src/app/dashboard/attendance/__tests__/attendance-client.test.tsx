import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AttendanceClient } from '../attendance-client'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockToast = vi.fn()

vi.mock('@/lib/http-client', () => ({
  http: {
    get: (...a: any[]) => mockGet(...a),
    post: (...a: any[]) => mockPost(...a),
    put: (...a: any[]) => mockPut(...a),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => null }) }))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/stat-card', () => ({
  StatCard: ({ label, value }: any) => <div>{label}: {value}</div>,
}))

vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: () => <div />,
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}))

vi.mock('@/components/qr/qr-scanner', () => ({
  QrScanner: () => null,
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  const iconNames = [
    'Calendar', 'Clock', 'CheckCircle2', 'XCircle', 'AlertCircle', 'Minus',
    'Plus', 'Search', 'Loader2', 'FileText', 'BarChart3', 'Users',
    'ArrowLeft', 'Save', 'UserCheck', 'UserX', 'X', 'Trash2', 'RotateCcw', 'Play', 'QrCode',
  ]
  for (const name of iconNames) icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  return icons
})

const groups = [
  { id: 'group-1', name: 'Group A', levelId: 'level-1', status: 'active' },
  { id: 'group-2', name: 'Group B', levelId: 'level-1', status: 'active' },
]
const levels = [{ id: 'level-1', name: 'Level 1', number: 1, status: 'active' }]

const session = {
  id: 'sess-1',
  scheduledDate: '2026-01-05',
  scheduledTime: '10:00',
  status: 'in_progress',
  level: { id: 'level-1', name: 'Level 1', number: 1 },
  group: { id: 'group-1', name: 'Group A' },
  servant: { id: 'u1', firstName: 'X', lastName: 'Y' },
}

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockPut.mockReset()
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'u1', metadata: { groupId: 'group-1' } }))
  mockGet.mockImplementation((path: string) => {
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path === '/students/groups/all') return Promise.resolve(groups)
    if (path === '/attendance/sessions') return Promise.resolve({ data: [session] })
    if (path.startsWith('/attendance/sessions/')) {
      return Promise.resolve({ ...session, attendanceRecords: [] })
    }
    return Promise.resolve([])
  })
})

it('shows the assigned group as the dropdown default and updates on change', async () => {
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  expect(row).toBeInTheDocument()
  fireEvent.click(row)
  const groupSelect = await screen.findByLabelText('Group')
  expect(groupSelect).toHaveValue('group-1')
  fireEvent.change(groupSelect, { target: { value: 'group-2' } })
  await waitFor(() => {
    expect(mockPut).toHaveBeenCalledWith('/attendance/sessions/sess-1', { groupId: 'group-2' })
  })
})

it('defaults the select to the assigned group when the session has no group', async () => {
  mockGet.mockImplementation((path: string) => {
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path === '/students/groups/all') return Promise.resolve(groups)
    if (path === '/attendance/sessions') return Promise.resolve({ data: [{ ...session, group: null }] })
    if (path.startsWith('/attendance/sessions/')) {
      return Promise.resolve({ ...session, group: null, attendanceRecords: [] })
    }
    return Promise.resolve([])
  })
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  const groupSelect = await screen.findByLabelText('Group')
  expect(groupSelect).toHaveValue('group-1')
})

it('shows the assigned hint when the assigned group differs from the session group', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 'u1', metadata: { groupId: 'group-2' } }))
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  await screen.findByLabelText('Group')
  await waitFor(() => {
    expect(screen.getByText('Assigned: Group B')).toBeTruthy()
  })
})

it('renders read-only group text for completed sessions', async () => {
  mockGet.mockImplementation((path: string) => {
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path === '/students/groups/all') return Promise.resolve(groups)
    if (path === '/attendance/sessions') return Promise.resolve({ data: [{ ...session, status: 'completed' }] })
    if (path.startsWith('/attendance/sessions/')) {
      return Promise.resolve({ ...session, status: 'completed', attendanceRecords: [] })
    }
    return Promise.resolve([])
  })
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  await waitFor(() => {
    expect(screen.getByText('Group A')).toBeTruthy()
  })
  expect(screen.queryByLabelText('Group')).toBeNull()
})

it('shows an error toast when the group update fails', async () => {
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  const groupSelect = await screen.findByLabelText('Group')
  mockPut.mockRejectedValueOnce(new Error('boom'))
  fireEvent.change(groupSelect, { target: { value: 'group-2' } })
  await waitFor(() => {
    expect(mockToast).toHaveBeenCalledWith('error', expect.anything())
  })
})

it('never renders a blank select when the session group is not in the groups list', async () => {
  mockGet.mockImplementation((path: string) => {
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path === '/students/groups/all') return Promise.resolve([{ id: 'group-2', name: 'Group B', levelId: 'level-1', status: 'active' }])
    if (path === '/attendance/sessions') return Promise.resolve({ data: [session] })
    if (path.startsWith('/attendance/sessions/')) {
      return Promise.resolve({ ...session, attendanceRecords: [] })
    }
    return Promise.resolve([])
  })
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  const groupSelect = await screen.findByLabelText('Group')
  expect(groupSelect).toHaveValue('group-1')
  expect(screen.getByRole('option', { name: 'Group A' })).toBeTruthy()
})
