export function getSchoolId(): string {
  if (typeof window === 'undefined') return 'niangelos-main'
  try {
    const active = localStorage.getItem('niangelos_active_school')
    if (active) return active
    const stored = localStorage.getItem('user')
    if (stored) {
      const user = JSON.parse(stored)
      if (user.schoolId) return user.schoolId
    }
  } catch {}
  return 'niangelos-main'
}

// Base school id WITHOUT the "view as" override — used for login resolution,
// since the override is a post-login scoping tool, not a login credential.
export function getBaseSchoolId(): string {
  if (typeof window === 'undefined') return 'niangelos-main'
  try {
    const stored = localStorage.getItem('user')
    if (stored) {
      const user = JSON.parse(stored)
      if (user.schoolId) return user.schoolId
    }
  } catch {}
  return 'niangelos-main'
}

import { GRADE_GROUPS_KEY, type GradeGroupCombo } from './grade-groups'

export interface GradeItem {
  id: string
  name: string
  status: 'active' | 'inactive'
}

export const GRADES_SCHOOL_ID = 'niangelos-main'

export async function fetchGrades(): Promise<GradeItem[]> {
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    const res = await fetch(`${API}/users/schools/${getSchoolId()}/config?key=grades`, { credentials: 'include' })
    if (!res.ok) return []
    const data: any = await res.json()
    if (Array.isArray(data)) {
      const match = data.find((c: any) => c.key === 'grades')
      return match?.value || []
    }
    if (data && Array.isArray(data.value)) return data.value
    return []
  } catch {
    return []
  }
}

export async function fetchActiveGrades(): Promise<GradeItem[]> {
  const grades = await fetchGrades()
  return grades.filter(g => g.status !== 'inactive')
}

export async function fetchGradeGroups(): Promise<GradeGroupCombo[]> {
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    const res = await fetch(`${API}/users/schools/${getSchoolId()}/config?key=${GRADE_GROUPS_KEY}`, { credentials: 'include' })
    if (!res.ok) return []
    const data: any = await res.json()
    if (Array.isArray(data)) {
      const match = data.find((c: any) => c.key === GRADE_GROUPS_KEY)
      return match?.value || []
    }
    if (data && Array.isArray(data.value)) return data.value
    return []
  } catch {
    return []
  }
}

export async function saveGradeGroups(value: GradeGroupCombo[]): Promise<boolean> {
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    const res = await fetch(`${API}/users/schools/${getSchoolId()}/config`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: GRADE_GROUPS_KEY, value, description: 'Grade + Group mapping per level' }),
    })
    return res.ok
  } catch {
    return false
  }
}
