#!/usr/bin/env node
// QA Test Harness — Full Platform Endpoint Validation (Production)
// Usage: node harness/run-tests.mjs [module]
//   module: auth|students|student-portal|servants|curriculum|hymn-learning|attendance|assessments|gamification|announcements|reports|dashboard|parents|notifications|users|admin|churches|newsletter|upload|all

const API = process.env.QA_API || 'https://niangelos-backend.onrender.com/api'
const EMAIL = process.env.QA_EMAIL || 'admin@niangelos.app'
const PASSWORD = process.env.QA_PASSWORD || 'Admin123!'

const RESULTS = []
const TRACKED = [] // { id, label }

let TOKEN = ''
let SCHOOL_ID = ''
let SCHOOL_SLUG = ''
let MIN_SPACING = Number(process.env.QA_SPACING || 350) // ms between requests (throttle: 200 req/60s)
let lastReq = 0

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function throttle() {
  const now = Date.now()
  const wait = lastReq ? Math.max(0, MIN_SPACING - (now - lastReq)) : 0
  if (wait > 0) await sleep(wait)
  lastReq = Date.now()
}

async function api(method, path, body, extraHeaders = {}) {
  await throttle()
  const headers = { ...extraHeaders }
  if (!headers['Content-Type'] && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`
  const url = path.startsWith('http') ? path : `${API}${path}`

  let res
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch(url, {
      method,
      headers,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (res.status !== 429) break
    const retryAfter = Number(res.headers.get('retry-after') || 1)
    await sleep((retryAfter || 1) * 1000 + 500)
  }
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, ok: res.ok, data }
}

// Login as a specific user (returns fresh token) — used by parents/portal/hymn tests
async function loginAs(email, password, schoolIdentifier) {
  const body = { email, password }
  if (schoolIdentifier || SCHOOL_SLUG) body.schoolIdentifier = schoolIdentifier || SCHOOL_SLUG
  const res = await api('POST', '/auth/login', body)
  if (!res.ok) return { token: null, user: null, error: res.data }
  return { token: res.data.accessToken, user: res.data.user, refreshToken: res.data.refreshToken }
}

// Issue a request authenticated as an arbitrary token (e.g. a parent user)
async function apiAs(token, method, path, body) {
  const prev = TOKEN
  TOKEN = token
  try {
    return await api(method, path, body)
  } finally {
    TOKEN = prev
  }
}

function track(id, label) {
  if (id) TRACKED.push({ id, label })
}

function pass(name, detail = '') {
  RESULTS.push({ status: 'PASS', name, detail })
  console.log(`  ✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  RESULTS.push({ status: 'FAIL', name, detail })
  console.log(`  ❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function section(title) {
  console.log(`\n━━━ ${title} ━━━`)
}

async function main() {
  const login = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
  if (!login.ok) {
    console.error('❌ Login failed:', JSON.stringify(login.data))
    process.exit(1)
  }
  TOKEN = login.data.accessToken
  SCHOOL_ID = login.data.user.schoolId
  console.log(`✅ Logged in as ${login.data.user.email} (roles: ${login.data.user.roles.join(', ')})`)
  console.log(`   schoolId: ${SCHOOL_ID}`)

  // Resolve shared fixtures
  const levelsRes = await api('GET', `/curriculum/levels?schoolId=${SCHOOL_ID}`)
  const levels = (levelsRes.data?.levels ?? levelsRes.data ?? []).filter(Boolean)
  const level = levels[0] || null
  const subjectRes = await api('GET', `/curriculum/subjects?schoolId=${SCHOOL_ID}`)
  const subjects = (subjectRes.data?.subjects ?? subjectRes.data ?? []).filter(Boolean)
  const subject = subjects[0] || null
  const yearsRes = await api('GET', `/curriculum/academic-years?schoolId=${SCHOOL_ID}`)
  const years = (yearsRes.data?.academicYears ?? yearsRes.data ?? []).filter(Boolean)
  const year = years.find(y => y.isCurrent) || years[0] || null
  const groupsRes = await api('GET', `/students/groups/all?schoolId=${SCHOOL_ID}`)
  const groupLevels = (groupsRes.data?.groups ?? groupsRes.data ?? []).filter(Boolean)
  const groups = groupLevels.flatMap(l => (l.groups ?? [])).filter(Boolean)
  const group = groups[0] || null
  const groupLevel = group ? groupLevels.find(l => l.id === group.levelId) || null : null
  const studentsRes = await api('GET', `/students?schoolId=${SCHOOL_ID}&limit=3`)
  const students = (studentsRes.data?.students ?? studentsRes.data?.data ?? studentsRes.data ?? []).filter(Boolean)
  const mySchoolRes = await api('GET', '/users/schools/me')
  const schoolSlug = mySchoolRes.data?.slug ?? ''
  SCHOOL_SLUG = schoolSlug

  const fx = {
    levels, level, subjects, subject, years, year, groups, group, groupLevel, students,
    firstStudent: students[0] || null,
    ownerId: login.data.user.id,
    loginAs,
    apiAs,
    schoolSlug,
  }
  console.log(`   fixtures: level=${level?.number ?? 'NONE'} subject=${subject?.name ?? 'NONE'} year=${year?.name ?? 'NONE'} group=${group?.name ?? 'NONE'} students=${students.length}`)

  const modules = [
    { key: 'auth', name: 'Module: Auth', file: './auth.test.mjs' },
    { key: 'students', name: 'Module: Students', file: './students.test.mjs' },
    { key: 'student-portal', name: 'Module: Student Portal', file: './student-portal.test.mjs' },
    { key: 'curriculum', name: 'Module: Curriculum', file: './curriculum.test.mjs' },
    { key: 'hymn-learning', name: 'Module: Hymn Learning', file: './hymn-learning.test.mjs' },
    { key: 'attendance', name: 'Module: Attendance', file: './attendance.test.mjs' },
    { key: 'assessments', name: 'Module: Assessments', file: './assessments.test.mjs' },
    { key: 'gamification', name: 'Module: Gamification', file: './gamification.test.mjs' },
    { key: 'announcements', name: 'Module: Announcements', file: './announcements.test.mjs' },
    { key: 'reports', name: 'Module: Reports', file: './reports.test.mjs' },
    { key: 'dashboard', name: 'Module: Dashboard', file: './dashboard.test.mjs' },
    { key: 'parents', name: 'Module: Parents', file: './parents.test.mjs' },
    { key: 'servants', name: 'Module: Servants', file: './servants.test.mjs' },
    { key: 'notifications', name: 'Module: Notifications', file: './notifications.test.mjs' },
    { key: 'users', name: 'Module: Users/Schools', file: './users.test.mjs' },
    { key: 'admin', name: 'Module: Admin', file: './admin.test.mjs' },
    { key: 'churches', name: 'Module: Churches', file: './churches.test.mjs' },
    { key: 'newsletter', name: 'Module: Newsletter', file: './newsletter.test.mjs' },
    { key: 'upload', name: 'Module: Upload', file: './upload.test.mjs' },
  ]

  const modFilter = process.argv[2] || 'all'
  const selected = modFilter === 'all' ? modules : modules.filter(m => m.key === modFilter || m.file.includes(modFilter))
  if (selected.length === 0) {
    console.log(`Unknown module: ${modFilter}. Options: all, ${modules.map(m => m.key).join(', ')}`)
    process.exit(1)
  }

  for (const m of selected) {
    section(m.name)
    const mod = await import(m.file)
    try {
      await mod.default({ api, track, pass, fail, fx, SCHOOL_ID, TOKEN })
    } catch (e) {
      fail(m.key, `uncaught: ${e?.stack ?? e?.message ?? String(e)}`)
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  const passed = RESULTS.filter(r => r.status === 'PASS').length
  const failed = RESULTS.filter(r => r.status === 'FAIL').length
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${RESULTS.length} total`)
  console.log(`Tracked records: ${TRACKED.length}`)

  const { writeFileSync, mkdirSync } = await import('fs')
  const { join } = await import('path')
  const dir = join(new URL('.', import.meta.url).pathname, '..', 'results')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'results-latest.json'), JSON.stringify({ runAt: new Date().toISOString(), results: RESULTS, tracked: TRACKED }, null, 2))
  console.log('Results written to docs/superpowers/tests/results/results-latest.json')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
