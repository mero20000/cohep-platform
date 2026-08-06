// Auth module tests — register, login, refresh, logout, me, change-password
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)
  const email = `qa-auth-${tsSuffix}@example.com`

  // AUTH1: public register (new church → pending school). Response is { message, pending }.
  const reg = await api('POST', '/auth/register', {
    email,
    password: 'QaPass123!',
    firstName: 'QaAuth',
    lastName: `Reg-${tsSuffix}`,
    churchName: `QA Church ${tsSuffix}`,
    country: 'Egypt',
    city: 'Cairo',
    educationLanguage: 'en',
    mobileNumber: `+2010${String(ts).slice(-9)}`,
  })
  if (reg.ok && reg.data?.pending) {
    pass('AUTH1 Register new church', `pending=yes message="${String(reg.data.message).slice(0, 60)}"`)
    fx.authRegisteredEmail = email
    // Find the pending school id via admin pending-registrations (match by QA user email)
    const pendingList = await api('GET', '/admin/pending-registrations')
    const pend = Array.isArray(pendingList.data) ? pendingList.data : []
    const match = pend.find(p => (p.users ?? []).some(u => u.email === email))
    if (match?.id) {
      track(match.id, `QA pending school (auth register ${email})`)
      fx.authRegisteredSchoolId = match.id
      console.log(`     → tracked pending school id=${match.id}`)
    } else {
      console.log('     → could not locate pending school in admin list (may be listed under another admin filter)')
    }
    console.log('     → response:', JSON.stringify(reg.data).slice(0, 200))
  } else {
    fail('AUTH1 Register new church', `status=${reg.status} ${JSON.stringify(reg.data).slice(0, 300)}`)
  }

  // AUTH2: login (main admin already logged in; verify a fresh login works)
  const login = await fx.loginAs('admin@niangelos.app', 'Admin123!')
  if (login.token) pass('AUTH2 Login admin', 'token issued')
  else fail('AUTH2 Login admin', JSON.stringify(login.error).slice(0, 200))

  // AUTH3: refresh token
  if (login.refreshToken) {
    const refresh = await api('POST', '/auth/refresh', { refreshToken: login.refreshToken })
    if (refresh.ok && refresh.data?.accessToken) pass('AUTH3 Refresh token', 'new accessToken issued')
    else fail('AUTH3 Refresh token', `status=${refresh.status} ${JSON.stringify(refresh.data).slice(0, 200)}`)
  } else {
    fail('AUTH3 Refresh token', 'no refreshToken from login')
  }

  // AUTH4: logout
  if (login.refreshToken) {
    const logout = await api('POST', '/auth/logout', { refreshToken: login.refreshToken })
    if (logout.ok) pass('AUTH4 Logout', `status=${logout.status}`)
    else fail('AUTH4 Logout', `status=${logout.status} ${JSON.stringify(logout.data).slice(0, 200)}`)
  } else {
    fail('AUTH4 Logout', 'no refreshToken available')
  }

  // AUTH5: me (GET)
  const me = await api('GET', '/auth/me')
  if (me.ok && me.data?.id) pass('AUTH5 Get me', `id=${me.data.id}`)
  else fail('AUTH5 Get me', `status=${me.status} ${JSON.stringify(me.data).slice(0, 200)}`)

  // AUTH6: update profile (PATCH me)
  const upd = await api('PATCH', '/auth/me', { phone: '+15550009999' })
  if (upd.ok) pass('AUTH6 Update profile', 'phone set')
  else fail('AUTH6 Update profile', `status=${upd.status} ${JSON.stringify(upd.data).slice(0, 200)}`)

  // AUTH7: change-password on a throwaway user (never on the real admin)
  const throwawayEmail = `qa-changepw-${tsSuffix}@example.com`
  const create = await api('POST', '/users', {
    email: throwawayEmail,
    firstName: 'Qa',
    lastName: 'Changepw',
    password: 'QaOldPass123!',
    roleName: 'servant',
    schoolId: SCHOOL_ID,
  })
  const throwawayId = create.data?.id ?? create.data?.user?.id ?? null
  if (create.ok && throwawayId) {
    track(throwawayId, `QA throwaway user (change-password) ${throwawayEmail}`)
    const tp = await fx.loginAs(throwawayEmail, 'QaOldPass123!')
    if (tp.token) {
      const change = await fx.apiAs(tp.token, 'POST', '/auth/change-password', {
        currentPassword: 'QaOldPass123!',
        newPassword: 'QaNewPass456!',
      })
      if (change.ok) {
        pass('AUTH7 Change password', 'new password accepted')
        const relogin = await fx.loginAs(throwawayEmail, 'QaNewPass456!')
        if (relogin.token) pass('AUTH7b Login with new password', 'confirmed')
        else fail('AUTH7b Login with new password', JSON.stringify(relogin.error).slice(0, 200))
      } else {
        fail('AUTH7 Change password', `status=${change.status} ${JSON.stringify(change.data).slice(0, 250)}`)
      }
    } else {
      fail('AUTH7 Change password', `login as throwaway failed: ${JSON.stringify(tp.error).slice(0, 200)}`)
    }
  } else {
    fail('AUTH7 Change password', `create throwaway user failed: ${create.status} ${JSON.stringify(create.data).slice(0, 250)}`)
  }

  return { registeredEmail: email }
}
