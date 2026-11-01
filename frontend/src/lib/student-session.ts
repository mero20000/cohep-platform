/**
 * Remembers which student signed in on this device.
 *
 * The portal's access key is the student's only credential and used to live
 * only in the URL, so reopening the app (or a fresh tab) had nothing to sign in
 * with. It is saved ONLY on an explicit sign-in at /student-portal/login, never
 * when merely opening a shared link, so a parent opening a child's link does
 * not turn their phone into that child's device. Sign-out clears it.
 */
const KEY = 'student_portal_key'

export function getSavedStudentKey(): string | null {
  try { return localStorage.getItem(KEY) || null } catch { return null }
}

export function saveStudentKey(key: string): void {
  try { if (key) localStorage.setItem(KEY, key) } catch { /* storage unavailable */ }
}

/** Full student sign-out: forget the key and drop the short-lived session token. */
export function clearStudentSession(): void {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
  try { sessionStorage.removeItem('student_portal_token') } catch { /* noop */ }
}

/** The student portal is a browser experience: no install prompt, manifest or SW caching. */
export function isStudentPortalPath(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === '/student-portal' || pathname.startsWith('/student-portal/'))
}
