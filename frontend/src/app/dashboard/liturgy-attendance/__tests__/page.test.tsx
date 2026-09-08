import { render, screen, fireEvent } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import LiturgyAttendancePage from '../page'

const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('@/lib/http-client', () => ({
  http: { get: (...args: any[]) => mockGet(...args), post: (...args: any[]) => mockPost(...args) },
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

describe('LiturgyAttendancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockReset()
    mockPost.mockReset()
  })

  it('loads the roster for the selected date', async () => {
    mockGet.mockResolvedValue({
      date: '2026-08-30T00:00:00.000Z',
      students: [
        { studentId: 's1', firstName: 'Mina', lastName: 'A', status: 'present' },
      ],
    })
    render(<LiturgyAttendancePage />)
    expect(await screen.findByText('Mina A')).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledWith('/servants/liturgy-session', expect.objectContaining({ date: expect.any(String) }))
  })

  it('saves with the selected date', async () => {
    mockGet.mockResolvedValue({
      date: new Date().toISOString(),
      students: [{ studentId: 's1', firstName: 'Mina', lastName: 'A', status: null }],
    })
    mockPost.mockResolvedValue({ success: true, recorded: 1 })
    render(<LiturgyAttendancePage />)
    await screen.findByText('Mina A')
    fireEvent.click(screen.getByTitle('Present'))
    fireEvent.click(await screen.findByText('Save Attendance'))
    const [, body] = mockPost.mock.calls[0]
    expect(body).toMatchObject({ date: expect.any(String) })
  })

  it('filters the roster by recorded status', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    mockGet.mockResolvedValue({
      date: new Date().toISOString(),
      students: [
        { studentId: 's1', firstName: 'Mina', lastName: 'A', status: 'present' },
        { studentId: 's2', firstName: 'John', lastName: 'B', status: null },
      ],
    })
    render(<LiturgyAttendancePage />)
    expect(await screen.findByText('Mina A')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /not recorded|غير مسجل/i }))
    expect(screen.queryByText('Mina A')).not.toBeInTheDocument()
    expect(screen.getByText('John B')).toBeInTheDocument()
  })

  it('marks all present with one tap', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    mockGet.mockResolvedValue({
      date: new Date().toISOString(),
      students: [
        { studentId: 's1', firstName: 'Mina', lastName: 'A', status: null },
        { studentId: 's2', firstName: 'John', lastName: 'B', status: null },
      ],
    })
    mockPost.mockResolvedValue({ success: true, recorded: 2 })
    render(<LiturgyAttendancePage />)
    await user.click(await screen.findByRole('button', { name: /mark all present|تحديد الكل حاضر/i }))
    await user.click(await screen.findByText('Save Attendance'))
    const [, body] = mockPost.mock.calls[0] as any
    expect(body.records).toHaveLength(2)
    expect(body.records.every((r: any) => r.status === 'present')).toBe(true)
  })
})
