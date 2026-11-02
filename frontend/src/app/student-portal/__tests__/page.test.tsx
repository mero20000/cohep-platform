import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

import StudentPortalIndex from '../page'

beforeEach(() => { replace.mockClear(); localStorage.clear() })

describe('/student-portal entry', () => {
  it('goes to login when no student is remembered', () => {
    render(<StudentPortalIndex />)
    expect(replace).toHaveBeenCalledWith('/student-portal/login')
  })
  it('goes straight to the dashboard of the remembered student', () => {
    localStorage.setItem('student_portal_key', 'key 1/2')
    render(<StudentPortalIndex />)
    expect(replace).toHaveBeenCalledWith('/student-portal/key%201%2F2')
  })
})
