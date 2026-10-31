import { it, expect, vi, beforeEach, describe } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BirthdaysSection } from '../birthdays-section'

const mockGet = vi.fn()
const mockPut = vi.fn()
vi.mock('@/lib/http-client', () => ({ http: { get: (...a: any[]) => mockGet(...a), put: (...a: any[]) => mockPut(...a) } }))
vi.mock('@/lib/asset-url', () => ({ assetUrl: (u?: string | null) => u ?? '' }))

const signoff = { servantName: 'Mariam Samir', school: 'NiAngelos School', church: 'St Mark Church' }
const b = (over: any = {}) => ({
  studentId: 's1', firstName: 'Mina', lastName: 'Adel', birthdayDate: '2026-11-01', daysAway: 0, turningAge: 10,
  recipientPhone: '+201000000001', recipientKind: 'student', missedThreeWeeks: false, sessionsAttended: 0, hymnsLearned: 0,
  greeted: null, ...over,
})

beforeEach(() => { mockGet.mockReset(); mockPut.mockReset() })

describe('BirthdaysSection', () => {
  it('renders nothing when there are no birthdays or the request fails', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [] })
    const { container } = render(<BirthdaysSection lang="en" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')

    mockGet.mockRejectedValue(new Error('down'))
    const second = render(<BirthdaysSection lang="en" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(second.container.textContent).toBe('')
  })

  it('lists today and upcoming birthdays with age and a greeted counter', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [b(), b({ studentId: 's2', firstName: 'John', daysAway: 3, birthdayDate: '2026-11-04', greeted: { note: null, at: 'x' } })] })
    render(<BirthdaysSection lang="en" />)
    expect(await screen.findByText('Mina Adel')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getAllByText('Turns 10')).toHaveLength(2)
    expect(screen.getByText('1 of 2 greeted')).toBeInTheDocument()
  })

  it('hides a passed birthday once greeted but keeps an ungreeted one', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [
      b({ studentId: 'old-done', firstName: 'Done', daysAway: -3, greeted: { note: null, at: 'x' } }),
      b({ studentId: 'old-open', firstName: 'Open', daysAway: -3 }),
    ] })
    render(<BirthdaysSection lang="en" />)
    expect(await screen.findByText('Open Adel')).toBeInTheDocument()
    expect(screen.queryByText('Done Adel')).toBeNull()
    expect(screen.getByText('3 days ago')).toBeInTheDocument()
  })

  it('opens a signed, editable message and links WhatsApp to the student number', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [b()] })
    render(<BirthdaysSection lang="en" />)
    fireEvent.click(await screen.findByText('Mina Adel'))
    const box = screen.getByLabelText(/Message \(you can edit it\)/) as HTMLTextAreaElement
    expect(box.value).toContain('Happy birthday, Mina! 🎂')
    expect(box.value).toContain('— Mariam Samir\nNiAngelos School\nSt Mark Church')
    expect(screen.getByText("Goes to Mina's own number.")).toBeInTheDocument()

    fireEvent.change(box, { target: { value: 'Custom hello' } })
    const link = screen.getByRole('link', { name: /Open WhatsApp/ }) as HTMLAnchorElement
    expect(link.href).toBe(`https://wa.me/201000000001?text=${encodeURIComponent('Custom hello')}`)
  })

  it('preselects "We miss you" after 3 missed weeks and explains a parent number', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [b({ missedThreeWeeks: true, recipientKind: 'parent' })] })
    render(<BirthdaysSection lang="en" />)
    fireEvent.click(await screen.findByText('Mina Adel'))
    expect(screen.getByRole('button', { name: 'We miss you' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText(/Message \(you can edit it\)/) as HTMLTextAreaElement).value).toContain("We've missed you")
    expect(screen.getByText(/Goes to the parent's number, written to Mina/)).toBeInTheDocument()
  })

  it('falls back to the WhatsApp contact picker when the number has no country code, and warns', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [b({ recipientPhone: '01000000001', recipientKind: 'parent' })] })
    render(<BirthdaysSection lang="en" />)
    fireEvent.click(await screen.findByText('Mina Adel'))
    expect((screen.getByRole('link', { name: /Open WhatsApp/ }) as HTMLAnchorElement).href).toMatch(/^https:\/\/wa\.me\/\?text=/)
    expect(screen.getByText(/no country code/)).toBeInTheDocument()
  })

  it('disables Personal until there is something to celebrate, and fills it with real numbers', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [b()] })
    const first = render(<BirthdaysSection lang="en" />)
    fireEvent.click(await screen.findByText('Mina Adel'))
    expect((screen.getByRole('button', { name: 'Personal' }) as HTMLButtonElement).disabled).toBe(true)
    first.unmount()

    mockGet.mockResolvedValue({ signoff, birthdays: [b({ hymnsLearned: 12, sessionsAttended: 40 })] })
    render(<BirthdaysSection lang="en" />)
    fireEvent.click(await screen.findByText('Mina Adel'))
    fireEvent.click(screen.getByRole('button', { name: 'Personal' }))
    expect((screen.getByLabelText(/Message \(you can edit it\)/) as HTMLTextAreaElement).value).toContain("you've learned 12 hymns and joined us for 40 sessions")
  })

  it('marks the student as greeted and reflects it', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [b()] })
    mockPut.mockResolvedValue({ greeted: { note: null, at: '2026-11-01T08:00:00Z' } })
    render(<BirthdaysSection lang="en" />)
    fireEvent.click(await screen.findByText('Mina Adel'))
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/dashboard/birthdays/s1/greeted', { done: true }, undefined))
    expect(await screen.findByText('1 of 1 greeted')).toBeInTheDocument()
  })

  it('shows an error if saving fails', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [b()] })
    mockPut.mockImplementation(() => Promise.reject(new Error('boom')))
    render(<BirthdaysSection lang="en" />)
    fireEvent.click(await screen.findByText('Mina Adel'))
    fireEvent.click(screen.getByRole('checkbox'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('says so when no phone number is saved', async () => {
    mockGet.mockResolvedValue({ signoff, birthdays: [b({ recipientPhone: null, recipientKind: null })] })
    render(<BirthdaysSection lang="en" />)
    fireEvent.click(await screen.findByText('Mina Adel'))
    expect(screen.getByText(/No phone number saved/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Call/ })).toBeNull()
  })

  describe('dashboard use', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => b({
      studentId: `s${i}`, firstName: `Kid${i}`, daysAway: 1, birthdayDate: '2026-11-02',
      levelId: i % 2 ? 'l2' : 'l1', levelName: i % 2 ? 'Level 2' : 'Level 1',
    }))

    it('asks for the whole school only when told to, and sends the scope when greeting', async () => {
      mockGet.mockResolvedValue({ signoff, birthdays: [b()] })
      mockPut.mockResolvedValue({ greeted: { note: null, at: 'x', by: 'Amir Adly' } })
      render(<BirthdaysSection lang="en" scope="school" className="" />)
      fireEvent.click(await screen.findByText('Mina Adel'))
      expect(mockGet).toHaveBeenCalledWith('/dashboard/birthdays', { scope: 'school' })
      fireEvent.click(screen.getByRole('checkbox'))
      await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/dashboard/birthdays/s1/greeted', { done: true }, { scope: 'school' }))
      expect(await screen.findByText('Greeted by Amir Adly')).toBeInTheDocument()
    })

    it('class scope sends no scope parameter', async () => {
      mockGet.mockResolvedValue({ signoff, birthdays: [b()] })
      render(<BirthdaysSection lang="en" />)
      await screen.findByText('Mina Adel')
      expect(mockGet).toHaveBeenCalledWith('/dashboard/birthdays', undefined)
    })

    it('limits a long school list to 8 and expands on request', async () => {
      mockGet.mockResolvedValue({ signoff, birthdays: many(12) })
      render(<BirthdaysSection lang="en" scope="school" />)
      await screen.findByText('Kid0 Adel')
      expect(screen.queryByText('Kid11 Adel')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Show all 12' }))
      expect(screen.getByText('Kid11 Adel')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
      expect(screen.queryByText('Kid11 Adel')).toBeNull()
    })

    it('filters the school list by level', async () => {
      mockGet.mockResolvedValue({ signoff, birthdays: many(4) })
      render(<BirthdaysSection lang="en" scope="school" />)
      await screen.findByText('Kid0 Adel')
      fireEvent.click(screen.getByRole('button', { name: 'Level 2' }))
      expect(screen.queryByText('Kid0 Adel')).toBeNull()
      expect(screen.getByText('Kid1 Adel')).toBeInTheDocument()
      expect(screen.getByText('Kid3 Adel')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'All levels' }))
      expect(screen.getByText('Kid0 Adel')).toBeInTheDocument()
    })

    it('does not show level filters in the class view', async () => {
      mockGet.mockResolvedValue({ signoff, birthdays: many(4) })
      render(<BirthdaysSection lang="en" />)
      await screen.findByText('Kid0 Adel')
      expect(screen.queryByRole('button', { name: 'All levels' })).toBeNull()
    })

    it('warns when someone already greeted the student, but still allows sending', async () => {
      mockGet.mockResolvedValue({ signoff, birthdays: [b({ greeted: { note: null, at: 'x', by: 'Mariam Samir' } })] })
      render(<BirthdaysSection lang="en" />)
      expect(await screen.findByText('Greeted by Mariam Samir')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Mina Adel'))
      expect(screen.getByRole('note').textContent).toBe('Mariam Samir already greeted Mina. You can still send another.')
      expect(screen.getByRole('link', { name: /Open WhatsApp/ })).toBeInTheDocument()
    })

    it('renders nothing (no gap) when the request returns nothing usable', async () => {
      mockGet.mockResolvedValue(undefined)
      const { container } = render(<BirthdaysSection lang="en" scope="school" />)
      await waitFor(() => expect(mockGet).toHaveBeenCalled())
      expect(container.textContent).toBe('')
    })
  })
})
