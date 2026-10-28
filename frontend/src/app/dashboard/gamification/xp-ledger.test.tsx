import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { XpLedger } from './xp-ledger'

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: mockToast }) }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/http-client', () => ({
  http: {
    get: (...a: any[]) => mocks.get(...a),
    patch: (...a: any[]) => mocks.patch(...a),
    delete: (...a: any[]) => mocks.delete(...a),
  },
}))

const item = (id: string, over: any = {}) => ({
  id, amount: 10, balanceAfter: 10, type: 'attendance_xp', description: null, referenceType: null, referenceId: null,
  createdAt: '2026-02-01T10:00:00Z', createdByName: null, flag: null, ...over,
})
const ledger = (items: any[], total = items.length) => ({ totalXp: 80, level: 1, total, items })

const rowOf = (text: RegExp) => screen.getByText(text).closest('li') as HTMLElement

describe('XpLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue(ledger([
      item('dup', { amount: 30, type: 'assessment', description: 'Assessment mark: 8/10', flag: 'archived_attempt', createdByName: 'Mina S' }),
      item('gone', { amount: 20, type: 'assessment', description: 'Old test', flag: 'missing_attempt' }),
      item('ok', { amount: 50, type: 'badge_award' }),
    ]))
    mocks.patch.mockResolvedValue({})
    mocks.delete.mockResolvedValue({})
  })

  it('shows the total, each entry, who awarded it, and flags XP from archived or missing attempts', async () => {
    render(<XpLedger studentId="stu-1" />)

    expect(await screen.findByText('Assessment mark: 8/10')).toBeTruthy()
    expect(screen.getByText('80')).toBeTruthy()
    expect(screen.getByText('From an archived attempt')).toBeTruthy()
    expect(screen.getByText('Attempt no longer exists')).toBeTruthy()
    expect(screen.getByText(/Mina S/)).toBeTruthy()
    expect(screen.getByText('+30')).toBeTruthy()
    expect(mocks.get).toHaveBeenCalledWith('/gamification/students/stu-1/xp-ledger', { skip: '0', take: '50' })
  })

  it('corrects one award with a reason, reloads, and tells the parent to refresh', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    render(<XpLedger studentId="stu-1" onChanged={onChanged} />)
    await screen.findByText('Assessment mark: 8/10')

    const row = rowOf(/Assessment mark: 8\/10/)
    await user.click(within(row).getByRole('button', { name: 'Correct this award' }))
    const amount = within(row).getByLabelText('Correct amount') as HTMLInputElement
    expect(amount.value).toBe('30')
    await user.clear(amount)
    await user.type(amount, '10')
    await user.type(within(row).getByLabelText(/Reason/), 'Marked twice')
    await user.click(within(row).getByRole('button', { name: 'Save correction' }))

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(
      '/gamification/students/stu-1/xp/transactions/dup',
      { amount: 10, reason: 'Marked twice' },
    ))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(mockToast).toHaveBeenCalledWith('success', 'XP award corrected')
    expect(mocks.get.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('removes one award, saying how much XP goes, with the reason as a query parameter', async () => {
    const user = userEvent.setup()
    render(<XpLedger studentId="stu-1" />)
    await screen.findByText('Assessment mark: 8/10')

    const row = rowOf(/Assessment mark: 8\/10/)
    await user.click(within(row).getByRole('button', { name: 'Remove this award' }))
    expect(within(row).getByText('This removes +30 XP from the student.')).toBeTruthy()
    await user.type(within(row).getByLabelText(/Reason/), 'Duplicate of the completed one')
    await user.click(within(row).getByRole('button', { name: 'Remove award' }))

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith(
      '/gamification/students/stu-1/xp/transactions/dup',
      { reason: 'Duplicate of the completed one' },
    ))
    expect(mockToast).toHaveBeenCalledWith('success', 'XP award removed')
  })

  it('will not send a change without a reason, or a zero or fractional amount', async () => {
    const user = userEvent.setup()
    render(<XpLedger studentId="stu-1" />)
    await screen.findByText('Assessment mark: 8/10')
    const row = rowOf(/Assessment mark: 8\/10/)

    await user.click(within(row).getByRole('button', { name: 'Correct this award' }))
    await user.click(within(row).getByRole('button', { name: 'Save correction' }))
    expect(await screen.findByText(/reason of at least 3 characters/)).toBeTruthy()

    await user.type(within(row).getByLabelText(/Reason/), 'because')
    const amount = within(row).getByLabelText('Correct amount')
    await user.clear(amount)
    await user.type(amount, '0')
    await user.click(within(row).getByRole('button', { name: 'Save correction' }))
    expect(await screen.findByText(/whole number other than zero/)).toBeTruthy()

    await user.clear(amount)
    await user.type(amount, '2.5')
    await user.click(within(row).getByRole('button', { name: 'Save correction' }))
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('shows the server\'s reason when a change is refused, and keeps the panel open', async () => {
    const user = userEvent.setup()
    mocks.delete.mockRejectedValueOnce({ response: { data: { message: 'This would take the student below zero XP.' } } })
    render(<XpLedger studentId="stu-1" />)
    await screen.findByText('Old test')
    const row = rowOf(/Old test/)

    await user.click(within(row).getByRole('button', { name: 'Remove this award' }))
    await user.type(within(row).getByLabelText(/Reason/), 'stale test data')
    await user.click(within(row).getByRole('button', { name: 'Remove award' }))

    expect(await screen.findByText('This would take the student below zero XP.')).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Remove award' })).toBeTruthy()
    expect(mockToast).not.toHaveBeenCalledWith('success', expect.anything())
  })

  it('loads the next page after the entries already shown', async () => {
    const user = userEvent.setup()
    mocks.get
      .mockResolvedValueOnce(ledger([item('a'), item('b')], 3))
      .mockResolvedValueOnce(ledger([item('c', { description: 'third entry' })], 3))
    render(<XpLedger studentId="stu-1" />)

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('third entry')).toBeTruthy()
    expect(mocks.get).toHaveBeenLastCalledWith('/gamification/students/stu-1/xp-ledger', { skip: '2', take: '50' })
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('says so when there is no XP, and offers a retry when loading fails', async () => {
    mocks.get.mockResolvedValueOnce(ledger([]))
    const { unmount } = render(<XpLedger studentId="stu-1" />)
    expect(await screen.findByText('No XP yet.')).toBeTruthy()
    unmount()

    mocks.get.mockRejectedValueOnce(new Error('offline'))
    render(<XpLedger studentId="stu-1" />)
    expect(await screen.findByText('offline')).toBeTruthy()
    mocks.get.mockResolvedValueOnce(ledger([item('x', { description: 'back again' })]))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('back again')).toBeTruthy()
  })
})
