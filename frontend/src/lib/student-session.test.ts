import { describe, it, expect, beforeEach } from 'vitest'
import { getSavedStudentKey, saveStudentKey, clearStudentSession, isStudentPortalPath } from './student-session'

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

describe('student session', () => {
  it('saves and reads the key', () => {
    expect(getSavedStudentKey()).toBeNull()
    saveStudentKey('abc-123')
    expect(getSavedStudentKey()).toBe('abc-123')
  })
  it('ignores an empty key', () => {
    saveStudentKey('')
    expect(getSavedStudentKey()).toBeNull()
  })
  it('sign-out clears the key and the session token', () => {
    saveStudentKey('abc-123')
    sessionStorage.setItem('student_portal_token', 't')
    clearStudentSession()
    expect(getSavedStudentKey()).toBeNull()
    expect(sessionStorage.getItem('student_portal_token')).toBeNull()
  })
  it('recognises only student portal paths', () => {
    expect(isStudentPortalPath('/student-portal')).toBe(true)
    expect(isStudentPortalPath('/student-portal/login')).toBe(true)
    expect(isStudentPortalPath('/student-portals-info')).toBe(false)
    expect(isStudentPortalPath('/portal')).toBe(false)
    expect(isStudentPortalPath(null)).toBe(false)
  })
})
