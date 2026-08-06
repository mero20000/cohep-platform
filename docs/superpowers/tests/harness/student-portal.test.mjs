// Student Portal tests — code-based login (no JWT) and portal data read
export default async function ({ api, track, pass, fail, fx, SCHOOL_ID }) {
  const ts = Date.now()
  const tsSuffix = String(ts).slice(-6)

  // Use an existing student (created in students module or seed). Portal is public.
  const student = fx.firstStudent
  const studentCode = student?.studentCode
  if (!studentCode) {
    fail('PORTAL1 Student portal login', 'no student code available (need a student fixture)')
    return {}
  }

  // PORTAL1: portal login by student code
  const login = await api('POST', '/student-portal/login', { studentCode })
  if (login.ok) {
    const hasStudent = login.data?.student || login.data?.id || login.data?.studentId
    pass('PORTAL1 Student portal login', `code=${studentCode} student=${hasStudent ? 'yes' : 'no'}`)
    console.log('     → response keys:', Object.keys(login.data ?? {}).slice(0, 10).join(','))
  } else {
    fail('PORTAL1 Student portal login', `status=${login.status} ${JSON.stringify(login.data).slice(0, 250)}`)
  }

  // PORTAL2: get portal data by code (GET :studentCode)
  const get = await api('GET', `/student-portal/${studentCode}`)
  if (get.ok) {
    pass('PORTAL2 Get portal data by code', `keys=${Object.keys(get.data ?? {}).slice(0, 8).join(',')}`)
  } else {
    fail('PORTAL2 Get portal data by code', `status=${get.status} ${JSON.stringify(get.data).slice(0, 250)}`)
  }

  return {}
}
