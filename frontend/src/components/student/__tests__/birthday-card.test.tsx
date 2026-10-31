import { it, expect, vi, beforeEach, describe } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudentBirthdayCard } from '../birthday-card'
import { studentBirthdayCopy } from '@/lib/student-birthday-message'

vi.mock('@/lib/asset-url', () => ({ assetUrl: (u?: string | null) => u ?? '' }))

const school = { name: 'NiAngelos School', logoUrl: '/s.png', churchName: 'St Mark Church', churchLogoUrl: '/c.png' }
const today = { daysSince: 0, turningAge: 10, year: 2026 }

beforeEach(() => { localStorage.clear() })

describe('StudentBirthdayCard', () => {
  it('renders nothing when it is not the birthday week', () => {
    const { container } = render(<StudentBirthdayCard birthday={null} studentId="s1" firstName="Mina" school={school} />)
    expect(container.textContent).toBe('')
  })

  it('opens by itself on the birthday with the standard message signed by school and church', () => {
    render(<StudentBirthdayCard birthday={today} studentId="s1" firstName="Mina" school={school} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Happy birthday, Mina! 🎂')).toBeInTheDocument()
    expect(screen.getByText("You're 10 today.")).toBeInTheDocument()
    expect(screen.getByText(/We thank God for you and pray for a blessed year ahead/)).toBeInTheDocument()
    expect(screen.getByText('NiAngelos School')).toBeInTheDocument()
    expect(screen.getByText('St Mark Church')).toBeInTheDocument()
    expect(document.querySelectorAll('img')).toHaveLength(2)
  })

  it('is never signed by an individual servant', () => {
    render(<StudentBirthdayCard birthday={today} studentId="s1" firstName="Mina" school={school} />)
    expect(screen.getByRole('dialog').textContent).not.toMatch(/—/)
  })

  it('closes, remembers it was seen, and stays reachable as a banner', () => {
    const { unmount } = render(<StudentBirthdayCard birthday={today} studentId="s1" firstName="Mina" school={school} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thank you' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /Your birthday card/ })).toBeInTheDocument()
    unmount()

    // Next visit the same day: no automatic pop-up, banner only.
    render(<StudentBirthdayCard birthday={today} studentId="s1" firstName="Mina" school={school} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Your birthday card/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes with Escape', () => {
    render(<StudentBirthdayCard birthday={today} studentId="s1" firstName="Mina" school={school} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('only shows the banner (no auto pop-up) in the week after, with past-tense wording', () => {
    render(<StudentBirthdayCard birthday={{ daysSince: 3, turningAge: 10, year: 2026 }} studentId="s1" firstName="Mina" school={school} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Your birthday card/ }))
    expect(screen.getByText('You turned 10 this week.')).toBeInTheDocument()
  })

  it('shows again next year even if last year was seen', () => {
    localStorage.setItem('niangelos_birthday_seen_s1_2026', '1')
    render(<StudentBirthdayCard birthday={{ daysSince: 0, turningAge: 11, year: 2027 }} studentId="s1" firstName="Mina" school={school} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('works with no logos and no school record', () => {
    render(<StudentBirthdayCard birthday={today} studentId="s1" firstName="Mina" school={null} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.querySelectorAll('img')).toHaveLength(0)
  })
})

describe('studentBirthdayCopy', () => {
  it('falls back to a friendly word when the name is missing', () => {
    expect(studentBirthdayCopy({ name: '  ', age: 9, daysSince: 0 }).headline).toBe('Happy birthday, friend! 🎂')
  })
})
