import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StudentFormModal } from '../student-form-modal'
import type { Level, ChurchItem, Student } from '../student-types'

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: any) => {
    const { unoptimized, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  for (const name of ['X', 'Loader2', 'Camera', 'User']) {
    icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return icons
})

vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ id, value, onChange, max, className }: any) => (
    <input id={id} data-testid={`date-${id}`} value={value} onChange={(e: any) => onChange(e.target.value)} max={max} className={className} />
  ),
}))

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/lib/use-permission', () => ({
  usePermission: () => ({
    can: () => false,
    role: 'guest',
    isSuperAdmin: false,
    category: 'guest',
  }),
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/http-client', () => ({
  http: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    patch: mocks.patch,
    delete: mocks.delete,
    upload: mocks.upload,
  },
}))

const activeLevels: Level[] = [
  { id: 'level-1', name: 'Level 1', number: 1, status: 'active' },
  { id: 'level-2', name: 'Level 2', number: 2, status: 'active' },
]

const churches: ChurchItem[] = []

const gradeOptions = [
  { id: 'grade-1', name: 'Grade 4', status: 'active', groupId: 'group-1', groupName: 'Group A' },
  { id: 'grade-2', name: 'Grade 5', status: 'active', groupId: 'group-2', groupName: 'Group B' },
]

const baseProps = {
  student: null,
  activeLevels,
  churches,
  gradeOptions,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  currentPage: 1,
  onOptimisticAdd: vi.fn(),
  lang: 'en' as const,
}

const validStudent = (overrides: Record<string, unknown> = {}) => ({
  id: 'stu-1',
  studentCode: 'STU-00001',
  firstName: 'Malak',
  lastName: 'Ahmed',
  firstNameAr: 'ملك',
  lastNameAr: 'أحمد',
  dateOfBirth: '2015-06-15T00:00:00Z',
  gender: 'female',
  churchName: 'St. Mary',
  gradeId: 'grade-1',
  grade: { id: 'grade-1', name: 'Grade 4' },
  photoUrl: null,
  levelId: 'level-1',
  groupId: 'group-1',
  status: 'active',
  enrollmentDate: '2026-01-01T00:00:00Z',
  level: { id: 'level-1', name: 'Level 1', number: 1 },
  group: { id: 'group-1', name: 'Group A' },
  ...overrides,
} as Student)

describe('StudentFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.post.mockResolvedValue({ ...validStudent(), id: 'new-1' })
  })

  it('shows Level and Grade selects and a read-only group display (no group dropdown)', async () => {
    render(<StudentFormModal {...baseProps} />)

    expect(await screen.findByText('Add New Student')).toBeInTheDocument()

    const levelSelect = screen.getByLabelText('Level *')
    expect(levelSelect.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'Level 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Level 2' })).toBeInTheDocument()

    const gradeSelect = screen.getByLabelText('Grade')
    expect(gradeSelect.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'Grade 4' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Grade 5' })).toBeInTheDocument()

    const groupEl = document.getElementById('sf-group')
    expect(groupEl).not.toBeNull()
    expect(groupEl?.tagName).toBe('DIV')
    expect(screen.queryByRole('combobox', { name: 'Group' })).not.toBeInTheDocument()
  })

  it('submits a new student posting gradeId (no schoolGrade or groupId)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    const onOptimisticAdd = vi.fn()
    render(
      <StudentFormModal
        {...baseProps}
        onClose={onClose}
        onSuccess={onSuccess}
        onOptimisticAdd={onOptimisticAdd}
      />,
    )

    await user.type(await screen.findByLabelText('Name *'), 'John Omar')
    await user.type(await screen.findByLabelText('Date of Birth *'), '2015-06-15')
    await user.selectOptions(screen.getByLabelText('Level *'), 'level-2')
    await user.selectOptions(screen.getByLabelText('Grade'), 'grade-2')

    await user.click(screen.getByText('Add Student'))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledTimes(1)
    })
    const [url, body, opts] = mocks.post.mock.calls[0]
    expect(url).toBe('/students')
    expect(opts).toEqual({ schoolId: 'niangelos-main' })
    expect(body).toMatchObject({
      firstName: 'John',
      lastName: 'Omar',
      dateOfBirth: '2015-06-15',
      levelId: 'level-2',
      gradeId: 'grade-2',
    })
    expect(body).not.toHaveProperty('schoolGrade')
    expect(body).not.toHaveProperty('groupId')
    expect(body).not.toHaveProperty('groupName')
    expect(onOptimisticAdd).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith(1)
  })

  it('pre-fills the form when editing an existing student and PUTs with gradeId', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    mocks.put.mockResolvedValue(validStudent())
    render(
      <StudentFormModal
        {...baseProps}
        student={validStudent()}
        currentPage={3}
        onSuccess={onSuccess}
      />,
    )

    expect(await screen.findByText('Edit Student')).toBeInTheDocument()
    expect((screen.getByLabelText('Name *') as HTMLInputElement).value).toBe('Malak Ahmed')
    expect((screen.getByLabelText('Level *') as HTMLSelectElement).value).toBe('level-1')
    expect((screen.getByLabelText('Grade') as HTMLSelectElement).value).toBe('grade-1')
    expect(document.getElementById('sf-group')?.textContent).toContain('Group A')

    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(mocks.put).toHaveBeenCalledTimes(1)
    })
    const [url, body, opts] = mocks.put.mock.calls[0]
    expect(url).toBe('/students/stu-1')
    expect(opts).toEqual({ schoolId: 'niangelos-main' })
    expect(body).toMatchObject({ firstName: 'Malak', lastName: 'Ahmed', gradeId: 'grade-1', levelId: 'level-1' })
    expect(body).not.toHaveProperty('schoolGrade')
    expect(body).not.toHaveProperty('groupId')
    expect(onSuccess).toHaveBeenCalledWith(3)
  })

  it('shows validation error when submitting empty form', async () => {
    const user = userEvent.setup()
    render(<StudentFormModal {...baseProps} />)

    await user.click(await screen.findByText('Add Student'))

    expect(await screen.findByText('Please fill all required fields')).toBeInTheDocument()
    expect(mocks.post).not.toHaveBeenCalled()
  })
})