import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

let pathname = '/'
let standalone = true
const replace = vi.fn()
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ replace }) }))
vi.mock('@/lib/install-detect', () => ({ isStandalone: () => standalone }))

import StandaloneEntry from '../standalone-entry'

beforeEach(() => { replace.mockClear(); localStorage.clear(); pathname = '/'; standalone = true })

describe('StandaloneEntry', () => {
  it('sends a remembered student from the installed app home to their dashboard', () => {
    localStorage.setItem('student_portal_key', 'k1')
    render(<StandaloneEntry />)
    expect(replace).toHaveBeenCalledWith('/student-portal/k1')
  })
  it('does nothing in a normal browser tab', () => {
    standalone = false
    localStorage.setItem('student_portal_key', 'k1')
    render(<StandaloneEntry />)
    expect(replace).not.toHaveBeenCalled()
  })
  it('never overrides a staff or parent session', () => {
    localStorage.setItem('student_portal_key', 'k1')
    localStorage.setItem('user', '{}')
    render(<StandaloneEntry />)
    expect(replace).not.toHaveBeenCalled()
  })
  it('does nothing when no student is remembered or off the home page', () => {
    render(<StandaloneEntry />)
    pathname = '/dashboard'
    localStorage.setItem('student_portal_key', 'k1')
    render(<StandaloneEntry />)
    expect(replace).not.toHaveBeenCalled()
  })
})
