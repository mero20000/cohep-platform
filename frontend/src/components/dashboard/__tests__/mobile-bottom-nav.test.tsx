import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Home, Calendar, Users, ClipboardCheck, Sun } from 'lucide-react'
import { MobileBottomNav } from '../mobile-bottom-nav'

const pathname = '/dashboard/attendance/sessions'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const items = [
  { href: '/dashboard', name: 'Dashboard', nameAr: 'لوحة', icon: Home },
  { href: '/dashboard/attendance/mark', name: 'Attendance', nameAr: 'الحضور', icon: Calendar, activePrefix: '/dashboard/attendance' },
  { href: '/dashboard/students', name: 'Students', nameAr: 'الطلاب', icon: Users },
  { href: '/dashboard/assessments', name: 'Assessments', nameAr: 'التقييمات', icon: ClipboardCheck, badge: 12 },
  { href: '/dashboard/briefing', name: 'This Sunday', nameAr: 'أحد', icon: Sun },
]

describe('MobileBottomNav', () => {
  it('keeps Attendance active on sibling attendance routes', () => {
    render(<MobileBottomNav items={items} lang="en" />)
    expect(screen.getByRole('link', { name: /Attendance/ })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a capped pending badge', () => {
    render(<MobileBottomNav items={items} lang="en" />)
    expect(screen.getByLabelText('12 pending')).toHaveTextContent('9+')
  })

  it('shows 4 items plus More when a menu handler is provided', () => {
    const onMore = vi.fn()
    render(<MobileBottomNav items={items} lang="en" onMore={onMore} />)
    expect(screen.getAllByRole('link')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(onMore).toHaveBeenCalled()
  })
})
