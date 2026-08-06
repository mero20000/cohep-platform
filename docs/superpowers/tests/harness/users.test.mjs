// Users/Schools module tests — users list, roles, permissions, schools CRUD, config, user CRUD, roles assign
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)
  const out = {}

  // U-1: users list
  const users = await api('GET', `/users?schoolId=${SCHOOL_ID}`)
  if (users.ok) pass('U-1 Users list read', `count=${Array.isArray(users.data) ? users.data.length : Array.isArray(users.data?.users) ? users.data.users.length : '?'}`)
  else fail('U-1 Users list read', `status=${users.status} ${JSON.stringify(users.data).slice(0, 250)}`)

  // U-2: roles
  const roles = await api('GET', '/users/roles')
  if (roles.ok) pass('U-2 Roles list read', 'ok')
  else fail('U-2 Roles list read', `status=${roles.status} ${JSON.stringify(roles.data).slice(0, 250)}`)

  // U-3: permissions
  const perms = await api('GET', '/users/permissions')
  if (perms.ok) pass('U-3 Permissions list read', 'ok')
  else fail('U-3 Permissions list read', `status=${perms.status} ${JSON.stringify(perms.data).slice(0, 250)}`)

  // U-4: schools list
  const schools = await api('GET', '/users/schools')
  if (schools.ok) pass('U-4 Schools list read', `count=${Array.isArray(schools.data) ? schools.data.length : Array.isArray(schools.data?.schools) ? schools.data.schools.length : '?'}`)
  else fail('U-4 Schools list read', `status=${schools.status} ${JSON.stringify(schools.data).slice(0, 250)}`)

  // U-5: schools/me
  const mySchool = await api('GET', '/users/schools/me')
  if (mySchool.ok) pass('U-5 Schools/me read', `id=${mySchool.data?.id ?? 'n/a'}`)
  else fail('U-5 Schools/me read', `status=${mySchool.status} ${JSON.stringify(mySchool.data).slice(0, 250)}`)

  // U-6: create school (super_admin) — tracked for cleanup
  const newSchool = await api('POST', '/users/schools', {
    name: `QA School ${tsSuffix}`,
    nameAr: `مدرسة QA-${tsSuffix}`,
    slug: `qa-school-${tsSuffix}`,
    timezone: 'Africa/Cairo',
    locale: 'en',
  })
  const schoolId2 = newSchool.data?.id ?? newSchool.data?.school?.id ?? null
  if (newSchool.ok && schoolId2) {
    track(schoolId2, `QA school`)
    out.schoolId2 = schoolId2
    pass('U-6 Create school', `id=${schoolId2}`)

    // U-7: get school
    const getSchool = await api('GET', `/users/schools/${schoolId2}`)
    if (getSchool.ok) pass('U-7 Get school read', `id=${schoolId2}`)
    else fail('U-7 Get school read', `status=${getSchool.status} ${JSON.stringify(getSchool.data).slice(0, 250)}`)

    // U-8: update school
    const updSchool = await api('PATCH', `/users/schools/${schoolId2}`, { address: 'QA address' })
    if (updSchool.ok) pass('U-8 Update school', 'address set')
    else fail('U-8 Update school', `status=${updSchool.status} ${JSON.stringify(updSchool.data).slice(0, 250)}`)

    // U-9: set config
    const setCfg = await api('POST', `/users/schools/${schoolId2}/config`, { key: 'qa-test-key', value: { enabled: true } })
    if (setCfg.ok) pass('U-9 Set school config', 'key saved')
    else fail('U-9 Set school config', `status=${setCfg.status} ${JSON.stringify(setCfg.data).slice(0, 250)}`)

    // U-10: get config
    const getCfg = await api('GET', `/users/schools/${schoolId2}/config?key=qa-test-key`)
    if (getCfg.ok) pass('U-10 Get school config', 'ok')
    else fail('U-10 Get school config', `status=${getCfg.status} ${JSON.stringify(getCfg.data).slice(0, 250)}`)
  } else {
    fail('U-6 Create school', `status=${newSchool.status} ${JSON.stringify(newSchool.data).slice(0, 250)}`)
  }

  // U-11: create user (servant role)
  const userEmail = `qa-user-${tsSuffix}@example.com`
  const newUser = await api('POST', '/users', {
    email: userEmail,
    firstName: 'QaUser',
    lastName: `Usr-${tsSuffix}`,
    password: 'QaUser123!',
    roleName: 'servant',
    schoolId: SCHOOL_ID,
  })
  const userId = newUser.data?.id ?? newUser.data?.user?.id ?? null
  if (newUser.ok && userId) {
    track(userId, `QA user ${userEmail}`)
    out.userId = userId
    pass('U-11 Create user', `id=${userId}`)

    // U-12: get user
    const getUser = await api('GET', `/users/${userId}`)
    if (getUser.ok) pass('U-12 Get user read', `id=${userId}`)
    else fail('U-12 Get user read', `status=${getUser.status} ${JSON.stringify(getUser.data).slice(0, 250)}`)

    // U-13: update user
    const updUser = await api('PATCH', `/users/${userId}`, { phone: '+15551234567' })
    if (updUser.ok) pass('U-13 Update user', 'phone set')
    else fail('U-13 Update user', `status=${updUser.status} ${JSON.stringify(updUser.data).slice(0, 250)}`)

    // U-14: assign role
    const assign = await api('POST', `/users/${userId}/roles/group_leader`)
    if (assign.ok) pass('U-14 Assign role', 'group_leader added')
    else fail('U-14 Assign role', `status=${assign.status} ${JSON.stringify(assign.data).slice(0, 250)}`)

    // U-15: remove role
    const remove = await api('DELETE', `/users/${userId}/roles/group_leader`)
    if (remove.ok) pass('U-15 Remove role', 'removed')
    else fail('U-15 Remove role', `status=${remove.status} ${JSON.stringify(remove.data).slice(0, 250)}`)
  } else {
    fail('U-11 Create user', `status=${newUser.status} ${JSON.stringify(newUser.data).slice(0, 250)}`)
  }

  return out
}
