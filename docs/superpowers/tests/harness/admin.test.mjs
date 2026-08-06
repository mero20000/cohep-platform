// Admin module tests — pending-registrations, approve/reject, reset-password
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)

  // AD-1: pending registrations list
  const pending = await api('GET', '/admin/pending-registrations')
  if (pending.ok) {
    pass('AD-1 Pending registrations list', `count=${Array.isArray(pending.data) ? pending.data.length : '?'}`)
    // Use the QA registered school from auth module (fx.authRegisteredSchoolId) if present
    const regSchoolId = fx.authRegisteredSchoolId
    if (regSchoolId) {
      // AD-2: reject the QA registration (cleanup path)
      const reject = await api('POST', `/admin/pending-registrations/${regSchoolId}/reject`)
      if (reject.ok) pass('AD-2 Reject pending registration', `school=${regSchoolId}`)
      else fail('AD-2 Reject pending registration', `status=${reject.status} ${JSON.stringify(reject.data).slice(0, 250)}`)
    } else {
      fail('AD-2 Reject pending registration', 'no QA registered school available (auth module ran?)')
    }
  } else {
    fail('AD-1 Pending registrations list', `status=${pending.status} ${JSON.stringify(pending.data).slice(0, 250)}`)
  }

  // AD-3: reset-password on a throwaway user
  const userEmail = `qa-adminpw-${tsSuffix}@example.com`
  const create = await api('POST', '/users', {
    email: userEmail,
    firstName: 'Qa',
    lastName: 'AdminPw',
    password: 'QaOldPass123!',
    roleName: 'servant',
    schoolId: SCHOOL_ID,
  })
  const userId = create.data?.id ?? create.data?.user?.id ?? null
  if (create.ok && userId) {
    track(userId, `QA throwaway user (reset-password) ${userEmail}`)
    const reset = await api('POST', '/admin/reset-password', { email: userEmail, newPassword: 'QaReset123!' })
    if (reset.ok) {
      pass('AD-3 Reset password', 'password reset')
      const relogin = await fx.loginAs(userEmail, 'QaReset123!')
      if (relogin.token) pass('AD-3b Login with reset password', 'confirmed')
      else fail('AD-3b Login with reset password', JSON.stringify(relogin.error).slice(0, 200))
    } else {
      fail('AD-3 Reset password', `status=${reset.status} ${JSON.stringify(reset.data).slice(0, 250)}`)
    }
  } else {
    fail('AD-3 Reset password', `create throwaway failed: ${create.status} ${JSON.stringify(create.data).slice(0, 250)}`)
  }

  return {}
}
