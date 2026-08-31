import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StudentSubjectItemsPanel } from '../student-subject-items'

vi.mock('lucide-react', async () => (await import('@/test/lucide-mock')).lucideMock())

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/http-client', () => ({
  http: { get: mocks.get, post: mocks.post },
}))

const row = (overrides: Record<string, unknown> = {}) => ({
  subjectItem: { id: 'item1', name: 'Coptic Hymns' },
  status: 'not_started',
  passedAt: null,
  passedBy: null,
  passedByUser: null,
  history: [],
  ...overrides,
})

const setServantRole = () => {
  localStorage.setItem('user', JSON.stringify({ id: 'u1', roles: ['servant'] }))
}

describe('StudentSubjectItemsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.get.mockResolvedValue([row()])
    mocks.post.mockResolvedValue({ passed: true })
  })

  it('renders items and toggles passed status optimistically', async () => {
    setServantRole()
    const user = userEvent.setup()
    render(<StudentSubjectItemsPanel studentId="123" lang="en" />)

    expect(await screen.findByText('Coptic Hymns')).toBeInTheDocument()

    await user.click(screen.getByText('Mark Passed'))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/students/123/subject-items/item1/pass', {})
    })
    expect(await screen.findByText('Passed ✓')).toBeInTheDocument()
  })

  it('hides toggle button for parents (read-only)', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'p1', roles: ['parent'] }))
    render(<StudentSubjectItemsPanel studentId="123" lang="en" />)

    expect(await screen.findByText('Coptic Hymns')).toBeInTheDocument()
    expect(screen.queryByText('Mark Passed')).not.toBeInTheDocument()
  })

  it('reverts optimistic update on error', async () => {
    setServantRole()
    const user = userEvent.setup()
    mocks.post.mockRejectedValue(new Error('forbidden'))
    render(<StudentSubjectItemsPanel studentId="123" lang="en" />)

    await user.click(await screen.findByText('Mark Passed'))

    expect(await screen.findByText('Mark Passed')).toBeInTheDocument()
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('error', 'forbidden'))
  })

  it('shows previously passed hint for not_started item with history', async () => {
    setServantRole()
    mocks.get.mockResolvedValue([row({ history: [{}, {}] })])
    render(<StudentSubjectItemsPanel studentId="123" lang="en" />)

    expect(await screen.findByText('previously passed (2)')).toBeInTheDocument()
  })
})
