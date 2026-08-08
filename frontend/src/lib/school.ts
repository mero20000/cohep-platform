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
