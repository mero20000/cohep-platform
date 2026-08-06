// Frontend-Scenario QA Harness
// Replicates EXACT API requests the dashboard/portal frontend makes,
// exercising every filter combination, against production.
import fs from 'node:fs'

const API = 'https://niangelos-backend.onrender.com/api'
const SCHOOL_ID = '7f1cacca-65f0-4759-a735-ea3f022171c6'
const EMAIL = 'admin@niangelos.app'
const PASS = 'Admin123!'
const SPACING = 220

let token = ''
let lastReq = 0
const results = []
const tracked = []

async function api(method, path, { body, params = {} } = {}) {
  const now = Date.now()
  const wait = lastReq + SPACING - now
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastReq = Date.now()
  let url = `${API}${path}`
  const qs = new URLSearchParams(params).toString()
  if (qs) url += (url.includes('?') ? '&' : '?') + qs
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

async function login() {
  const r = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASS, schoolIdentifier: 'niangelos-main' } })
  token = r.data?.data?.accessToken || r.data?.accessToken || ''
  return token
}

let passed = 0, failed = 0
const fail = (id, name, status, data) => {
  failed++
  const msg = typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200)
  results.push({ status: 'FAIL', name, detail: `${id} status=${status} ${msg}` })
}
const pass = (id, name, detail) => { passed++; results.push({ status: 'PASS', name, detail }) }

function assertStatus(id, name, r, expected = 200, note = '') {
  if (r.status !== expected) fail(id, name, r.status, r.data)
  else pass(id, name, `${note}status=${r.status}`)
}

async function main() {
  await login()
  if (!token) { console.error('LOGIN FAILED'); process.exit(1) }
  console.log('Logged in as admin.\n')

  // ── Reference data (what every filter page starts from) ──────────────────
  const levels = (await api('GET', '/curriculum/levels', { params: { schoolId: SCHOOL_ID } })).data
  const activeLevels = levels.filter(l => l.status !== 'inactive')
  const groupsAll = (await api('GET', '/students/groups/all', { params: { schoolId: SCHOOL_ID } })).data
  const levelGroups = Object.fromEntries(groupsAll.map(l => [l.id, l.groups]))
  console.log(`Levels: ${levels.length} (active: ${activeLevels.length}) | Groups per level: ${groupsAll.map(l => `${l.name}:${l.groups.length}`).join(', ')}`)

  // ── SCENARIO A: Students page — group dropdown cascade per level ─────────
  console.log('\n── A: Students page filter combinations ──')
  for (const lvl of activeLevels) {
    const g = levelGroups[lvl.id] || []
    const r = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID, levelId: lvl.id } })
    if (r.status === 200) {
      const total = r.data.pagination?.total
      const emptyGroups = g.filter(x => x.status !== 'inactive').length === 0
      // The exact frontend behavior: group dropdown would be EMPTY
      if (emptyGroups && total > 0) fail(`A-${lvl.number}`, `Students page - Level ${lvl.name}`, 200, `HAS ${total} students but NO groups => cannot filter/assign group (group menu empty)` )
      else if (emptyGroups) pass(`A-${lvl.number}`, `Students page - Level ${lvl.name}`, `no groups (menu empty, correct) total=${total}`)
      else pass(`A-${lvl.number}`, `Students page - Level ${lvl.name}`, `groups=${g.filter(x=>x.status!=='inactive').length} total=${total}`)
    } else fail(`A-${lvl.number}`, `Students page - Level ${lvl.name}`, r.status, r.data)
  }

  // Level+Group combined filter (frontend: only possible for levels WITH groups)
  for (const lvl of activeLevels) {
    const active = (levelGroups[lvl.id] || []).filter(g => g.status !== 'inactive')
    for (const grp of active.slice(0, 2)) {
      const r = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID, levelId: lvl.id, groupId: grp.id } })
      assertStatus(`A-g-${lvl.name}-${grp.name}`, `Students level+group filter ${lvl.name}/${grp.name}`, r)
    }
  }

  // Status filter
  for (const st of ['active', 'inactive', 'graduated']) {
    const r = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID, status: st } })
    assertStatus(`A-st-${st}`, `Students status=${st} filter`, r)
  }

  // Gender + Grade + Church + Search
  for (const gender of ['male', 'female']) {
    const r = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID, gender } })
    assertStatus(`A-gn-${gender}`, `Students gender=${gender} filter`, r)
  }
  for (const grade of ['Grade 1', 'Grade 4', 'Adult', '']) {
    if (!grade) continue
    const r = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID, schoolGrade: grade } })
    assertStatus(`A-gr-${grade}`, `Students grade=${grade} filter`, r)
  }
  for (const q of ['Peter', 'STU-000', 'zzznomatch']) {
    const r = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID, search: q } })
    assertStatus(`A-s-${q}`, `Students search=${q} filter`, r)
  }

  // Combined: level + status + gender + search (realistic dashboard combos)
  const lvl1 = activeLevels[0]
  const comboR = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID, levelId: lvl1.id, status: 'active', gender: 'male' } })
  assertStatus('A-combo1', `Students level=${lvl1.name}+active+male`, comboR)
  const comboR2 = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID, levelId: lvl1.id, search: 'Peter' } })
  assertStatus('A-combo2', `Students level=${lvl1.name}+search=Peter`, comboR2)

  // Pagination
  const pg1 = await api('GET', '/students', { params: { page: '1', limit: '20', schoolId: SCHOOL_ID } })
  const pg2 = await api('GET', '/students', { params: { page: '2', limit: '20', schoolId: SCHOOL_ID } })
  if (pg1.status === 200 && pg2.status === 200) {
    const t1 = pg1.data.pagination?.totalPages, t2 = pg2.data.pagination?.totalPages
    if (t1 > 1 && pg2.data.data.length === 0) fail('A-pg', 'Students page 2', 200, 'page 2 empty but totalPages>1')
    else pass('A-pg', 'Students pagination', `totalPages=${t1}`)
  } else fail('A-pg', 'Students pagination', pg1.status, pg1.data)

  // ── SCENARIO B: Student form — required groupId blocks L2 enrollment ─────
  console.log('\n── B: Student create/edit form ──')
  const noGroupLvl = activeLevels.find(l => (levelGroups[l.id] || []).filter(g => g.status !== 'inactive').length === 0)
  if (noGroupLvl) {
    const r = await api('POST', '/students', { params: { schoolId: SCHOOL_ID }, body: { firstName: 'QA', lastName: 'NoGroup', dateOfBirth: '2014-01-01', gender: 'male', levelId: noGroupLvl.id } })
    if (r.status === 400 && JSON.stringify(r.data).includes('groupId')) fail('B-1', `Student create in level without groups (${noGroupLvl.name})`, 400, 'REQUIRED groupId blocks enrollment: ' + JSON.stringify(r.data))
    else pass('B-1', `Student create in level without groups (${noGroupLvl.name})`, `status=${r.status} ${JSON.stringify(r.data).slice(0,120)}`)
  } else pass('B-1', 'No level without groups found', 'n/a')

  // ── SCENARIO B2: createGroup levelId regression (fix verification) ───────
  console.log('\n── B2: createGroup levelId fix ──')
  if (activeLevels.length >= 2) {
    const targetLvl = activeLevels[1]
    const ts = Date.now()
    const cg = await api('POST', '/students/groups', { params: { schoolId: SCHOOL_ID }, body: { name: `QA-Fix-${ts}`, levelId: targetLvl.id } })
    if (cg.status === 200 || cg.status === 201) {
      if (cg.data?.levelId === targetLvl.id) {
        pass('B2-1', `createGroup honors levelId (${targetLvl.name})`, `levelId=${cg.data.levelId}`)
      } else {
        fail('B2-1', `createGroup ignores levelId (${targetLvl.name})`, cg.status, `assigned to ${cg.data?.levelId} not ${targetLvl.id}`)
      }
      const del = await api('DELETE', `/students/groups/${cg.data.id}`)
      if (del.status === 200) pass('B2-2', 'cleanup created group', 'deleted')
      else fail('B2-2', 'cleanup created group', del.status, del.data)
    } else fail('B2-1', `createGroup with levelId (${targetLvl.name})`, cg.status, cg.data)
  }

  // ── SCENARIO C: Attendance page ──────────────────────────────────────────
  console.log('\n── C: Attendance page combinations ──')
  const sessAll = await api('GET', '/attendance/sessions', { params: { schoolId: SCHOOL_ID, limit: '500' } })
  assertStatus('C-1', 'Attendance sessions (all)', sessAll)
  for (const lvl of activeLevels.slice(0, 5)) {
    const r = await api('GET', '/attendance/sessions', { params: { schoolId: SCHOOL_ID, limit: '500', levelId: lvl.id } })
    assertStatus(`C-l-${lvl.name}`, `Attendance level=${lvl.name}`, r)
  }
  for (const st of ['scheduled', 'in_progress', 'completed', 'cancelled']) {
    const r = await api('GET', '/attendance/sessions', { params: { schoolId: SCHOOL_ID, limit: '500', status: st } })
    assertStatus(`C-st-${st}`, `Attendance status=${st}`, r)
  }
  for (const [from, to] of [['2026-01-01', '2026-12-31'], ['2026-08-01', '2026-08-01']]) {
    const r = await api('GET', '/attendance/sessions', { params: { schoolId: SCHOOL_ID, limit: '500', from, to } })
    assertStatus(`C-d-${from}`, `Attendance from=${from} to=${to}`, r)
  }
  const ls = await api('GET', '/attendance/level-stats', { params: { schoolId: SCHOOL_ID } })
  assertStatus('C-2', 'Attendance level-stats', ls)
  const gs = await api('GET', '/attendance/group-stats', { params: { schoolId: SCHOOL_ID } })
  assertStatus('C-3', 'Attendance group-stats', gs)
  const heat = await api('GET', '/attendance/liturgy-heatmap', { params: { schoolId: SCHOOL_ID } })
  assertStatus('C-4', 'Attendance liturgy-heatmap', heat)

  // ── SCENARIO D: Assessments page ─────────────────────────────────────────
  console.log('\n── D: Assessments page combinations ──')
  const asList = await api('GET', '/assessments', { params: { schoolId: SCHOOL_ID, page: '1', limit: '20' } })
  assertStatus('D-1', 'Assessments list', asList)
  for (const lvl of activeLevels.slice(0, 3)) {
    const r = await api('GET', '/assessments', { params: { schoolId: SCHOOL_ID, page: '1', limit: '20', levelId: lvl.id } })
    assertStatus(`D-l-${lvl.name}`, `Assessments level=${lvl.name}`, r)
  }
  for (const st of ['draft', 'published', 'completed', 'archived']) {
    const r = await api('GET', '/assessments', { params: { schoolId: SCHOOL_ID, page: '1', limit: '20', status: st } })
    assertStatus(`D-st-${st}`, `Assessments status=${st}`, r)
  }
  const asStats = await api('GET', '/assessments/stats', { params: { schoolId: SCHOOL_ID } })
  assertStatus('D-2', 'Assessments stats', asStats)

  // ── SCENARIO E: Curriculum page (level→subject→items→lessons→allocations) ─
  console.log('\n── E: Curriculum page combinations ──')
  const subjects = (await api('GET', '/curriculum/subjects', { params: { schoolId: SCHOOL_ID } })).data
  console.log(`Subjects: ${subjects?.length}`)
  for (const lvl of activeLevels) {
    const lessons = await api('GET', '/curriculum/lessons', { params: { schoolId: SCHOOL_ID, levelId: lvl.id } })
    assertStatus(`E-l-${lvl.name}`, `Curriculum lessons level=${lvl.name}`, lessons)
  }
  for (let n = 1; n <= 5; n++) {
    const r = await api('GET', '/curriculum/items', { params: { schoolId: SCHOOL_ID, levelNumber: String(n) } })
    assertStatus(`E-i-${n}`, `Curriculum items levelNumber=${n}`, r)
  }
  const years = (await api('GET', '/curriculum/academic-years', { params: { schoolId: SCHOOL_ID } })).data
  if (years?.length) {
    for (const lvl of activeLevels.slice(0, 2)) {
      const r = await api('GET', '/curriculum/allocations', { params: { schoolId: SCHOOL_ID, academicYearId: years[0].id, levelId: lvl.id } })
      assertStatus(`E-a-${lvl.name}`, `Curriculum allocations year+level=${lvl.name}`, r)
    }
    const cal = await api('GET', '/curriculum/calendar', { params: { schoolId: SCHOOL_ID, academicYearId: years[0].id } })
    assertStatus('E-cal', 'Curriculum calendar (year)', cal)
    const weeks = await api('GET', '/curriculum/weeks', { params: { schoolId: SCHOOL_ID, academicYearId: years[0].id } })
    assertStatus('E-wk', 'Curriculum weeks (year)', weeks)
  }

  // ── SCENARIO F: Gamification page ────────────────────────────────────────
  console.log('\n── F: Gamification page ──')
  const lb = await api('GET', '/gamification/leaderboard', { params: { schoolId: SCHOOL_ID } })
  assertStatus('F-1', 'Gamification leaderboard', lb)
  const badges = await api('GET', '/gamification/badges', { params: { schoolId: SCHOOL_ID } })
  assertStatus('F-2', 'Gamification badges', badges)
  const season = await api('GET', '/gamification/seasonal', { params: { schoolId: SCHOOL_ID } })
  assertStatus('F-3', 'Gamification seasonal status', season)
  const dashLb = await api('GET', '/dashboard/leaderboard', { params: { schoolId: SCHOOL_ID, limit: '10' } })
  assertStatus('F-4', 'Dashboard leaderboard', dashLb)

  // ── SCENARIO G: Dashboard page ───────────────────────────────────────────
  console.log('\n── G: Dashboard page ──')
  const dashStats = await api('GET', '/dashboard/stats', { params: { schoolId: SCHOOL_ID } })
  assertStatus('G-1', 'Dashboard stats', dashStats)
  const dashMine = await api('GET', '/dashboard/mine', { params: { schoolId: SCHOOL_ID } })
  assertStatus('G-2', 'Dashboard mine', dashMine)
  const digest = await api('GET', '/dashboard/servant-digest', { params: { schoolId: SCHOOL_ID } })
  assertStatus('G-3', 'Dashboard servant-digest', digest)
  const pstats = await api('GET', '/dashboard/practice-stats', { params: { schoolId: SCHOOL_ID } })
  assertStatus('G-4', 'Dashboard practice-stats', pstats)

  // ── SCENARIO H: Settings tabs ────────────────────────────────────────────
  console.log('\n── H: Settings tabs ──')
  const schools = await api('GET', '/users/schools')
  assertStatus('H-1', 'Settings schools', schools)
  const churches = await api('GET', '/churches')
  assertStatus('H-2', 'Settings churches', churches)
  const roles = await api('GET', '/users/roles')
  assertStatus('H-3', 'Settings roles', roles)
  const gradesCfg = await api('GET', `/users/schools/niangelos-main/config`, { params: { key: 'grades' } })
  assertStatus('H-4', 'Settings grades config', gradesCfg)
  const users = await api('GET', '/users', { params: { schoolId: SCHOOL_ID } })
  assertStatus('H-5', 'Settings users', users)
  const usersByRole = await api('GET', '/users', { params: { schoolId: SCHOOL_ID, role: 'servant' } })
  assertStatus('H-6', 'Settings users role=servant', usersByRole)

  // ── SCENARIO I: Reports/Diocese ──────────────────────────────────────────
  console.log('\n── I: Reports ──')
  const r1 = await api('GET', `/reports/priest-pulse?schoolId=${SCHOOL_ID}`)
  assertStatus('I-1', 'Report priest-pulse', r1)
  const r2 = await api('GET', `/reports/liturgical-engagement?schoolId=${SCHOOL_ID}`)
  assertStatus('I-2', 'Report liturgical-engagement', r2)
  const r3 = await api('GET', `/reports/servant-contributions?schoolId=${SCHOOL_ID}`)
  assertStatus('I-3', 'Report servant-contributions', r3)
  const r4 = await api('GET', `/reports/diocese`)
  assertStatus('I-4', 'Report diocese', r4)

  // ── SCENARIO J: Notifications ────────────────────────────────────────────
  console.log('\n── J: Notifications ──')
  const n1 = await api('GET', '/notifications', { params: { schoolId: SCHOOL_ID, page: '1', limit: '20' } })
  assertStatus('J-1', 'Notifications list', n1)
  const n2 = await api('GET', '/notifications', { params: { schoolId: SCHOOL_ID, page: '1', limit: '20', read: 'false' } })
  assertStatus('J-2', 'Notifications read=false', n2)

  // ── SCENARIO K: Student Portal & Parents (public/code + parent flows) ────
  console.log('\n── K: Portal pages ──')
  const portalCode = 'STU-00030'
  const pLogin = await api('POST', '/student-portal/login', { body: { studentCode: portalCode } })
  if (pLogin.status < 200 || pLogin.status >= 300) fail('K-1', `Student portal login ${portalCode}`, pLogin.status, pLogin.data)
  else pass('K-1', `Student portal login ${portalCode}`, `status=${pLogin.status} (2xx ok for res.ok)`)
  const portalData = await api('GET', `/student-portal/${encodeURIComponent(portalCode)}`)
  assertStatus('K-2', `Student portal data ${portalCode}`, portalData)

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(50))
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  const out = { runAt: new Date().toISOString(), results }
  fs.mkdirSync('/Users/amir.adly/niangelos-platform/docs/superpowers/tests/results', { recursive: true })
  fs.writeFileSync('/Users/amir.adly/niangelos-platform/docs/superpowers/tests/results/frontend-scenarios.json', JSON.stringify(out, null, 2))
  console.log('Results written to frontend-scenarios.json')
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
