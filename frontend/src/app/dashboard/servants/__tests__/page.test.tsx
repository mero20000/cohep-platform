import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  const iconNames = ['AlertTriangle', 'Check', 'GraduationCap', 'LayoutGrid', 'Loader2', 'Pencil', 'Phone', 'Plus', 'Rows3', 'Search', 'Shield', 'Trash2', 'Upload', 'User', 'UserCheck', 'X']
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
  fetchGradeGroups: vi.fn().mockResolvedValue([
    { id: 'c1', levelId: 'level-1', gradeName: 'Grade 4', groupId: 'group-1', groupName: 'Group A', status: 'active' },
    { id: 'c2', levelId: 'level-1', gradeName: 'Grade 5', groupId: 'group-2', groupName: 'Group B', status: 'active' },
  ]),
}))

const levels = [
  { id: 'level-1', name: 'Level 1', number: 1, status: 'active', groups: [
    { id: 'group-1', name: 'Group A', levelId: 'level-1', status: 'active' },
    { id: 'group-2', name: 'Group B', levelId: 'level-1', status: 'active' },
  ]},
]

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'u1', roles: ['super_admin'] }))
  mockGet.mockImplementation((path: string) => {
    if (path === '/servants') return Promise.resolve([])
    if (path === '/students/groups/all') return Promise.resolve(levels)
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