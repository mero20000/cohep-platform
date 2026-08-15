#!/usr/bin/env node
// One-off cleanup of orphaned QA test data left in the database by previous
// harness runs (e.g. "Peter Test-<timestamp>", "QaParent Pr-<ts>", "QA-Group-…").
//
// Usage:
//   QA_API=https://your-backend/api \
//   QA_EMAIL=admin@your-school.app \
//   QA_PASSWORD='Admin123!' \
//   node docs/superpowers/tests/harness/cleanup-qa.mjs
//
// Defaults match the QA harness (points at the deployed backend). It logs in as
// an admin, finds records whose name/email matches the QA patterns, and
// soft-deletes them. Best-effort: failures are reported, nothing is hard-deleted.

const API = process.env.QA_API || 'https://niangelos-backend.onrender.com/api'
const EMAIL = process.env.QA_EMAIL || 'admin@niangelos.app'
const PASSWORD = process.env.QA_PASSWORD || 'Admin123!'

let TOKEN = ''
let SCHOOL_ID = ''
let lastReq = 0
const MIN_SPACING = Number(process.env.QA_SPACING || 200)

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
async function throttle() {
  const now = Date.now()
  const wait = lastReq ? Math.max(0, MIN_SPACING - (now - lastReq)) : 0
  if (wait > 0) await sleep(wait)
  lastReq = Date.now()
}

async function api(method, path, body) {
  await throttle()
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`
  const url = path.startsWith('http') ? path : `${API}${path}`
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, ok: res.ok, data }
}

// QA patterns used across the harness.
const STUDENT_ORPHAN = (s) =>
  /^Test-\d/.test(s.lastName || '') ||
  /^Imp-\d/.test(s.lastName || '') ||
  (s.firstNameAr || '').startsWith('تست') ||
  /qa-parent/i.test(s.parentEmail || '') ||
  (s.firstName === 'Peter' && /Test-/.test(s.lastName || ''))
const GROUP_ORPHAN = (g) => /^QA-/.test(g.name || '') || (g.nameAr || '').includes('مجموعة QA')
const PARENT_ORPHAN = (u) => /qa-parent|qa-%/i.test(u.email || '') || /^QaParent/i.test(u.firstName || '')

async function main() {
  const login = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
  if (!login.ok) { console.error('❌ Login failed:', JSON.stringify(login.data)); process.exit(1) }
  TOKEN = login.data.accessToken
  SCHOOL_ID = login.data.user.schoolId
  console.log(`✅ Logged in as ${login.data.user.email} (school ${SCHOOL_ID})`)

  // ── Students ──────────────────────────────────────────────────────────
  let removedStudents = 0, checkedStudents = 0
  let page = 1
  const PAGE = 500
  while (true) {
    const res = await api('GET', `/students?schoolId=${SCHOOL_ID}&limit=${PAGE}&page=${page}`)
    const list = res.data?.students ?? res.data?.data ?? res.data ?? []
    if (!Array.isArray(list) || list.length === 0) break
    checkedStudents += list.length
    for (const s of list) {
      if (STUDENT_ORPHAN(s)) {
        const del = await api('DELETE', `/students/${s.id}?schoolId=${SCHOOL_ID}`)
        if (del.ok) { removedStudents++; console.log(`  🧹 student ${s.firstName} ${s.lastName} (${s.id})`) }
        else console.log(`  ⚠️  student delete failed ${s.id}: ${del.status}`)
      }
    }
    if (list.length < PAGE) break
    page++
  }
  console.log(`   students: checked ${checkedStudents}, removed ${removedStudents}`)

  // ── Groups ────────────────────────────────────────────────────────────
  let removedGroups = 0
  const gres = await api('GET', `/students/groups/all?schoolId=${SCHOOL_ID}`)
  const groupLevels = gres.data?.groups ?? gres.data ?? []
  const groups = groupLevels.flatMap((l) => l.groups ?? [])
  for (const g of groups) {
    if (GROUP_ORPHAN(g)) {
      const del = await api('DELETE', `/students/groups/${g.id}?schoolId=${SCHOOL_ID}`)
      if (del.ok) { removedGroups++; console.log(`  🧹 group ${g.name} (${g.id})`) }
      else console.log(`  ⚠️  group delete failed ${g.id}: ${del.status}`)
    }
  }
  console.log(`   groups: removed ${removedGroups}`)

  // ── Parent users ─────────────────────────────────────────────────────────
  let removedUsers = 0
  const ures = await api('GET', `/users?schoolId=${SCHOOL_ID}&role=parent&search=qa-parent`)
  const users = ures.data?.users ?? ures.data?.data ?? ures.data ?? []
  for (const u of (Array.isArray(users) ? users : [])) {
    if (PARENT_ORPHAN(u)) {
      const del = await api('DELETE', `/users/${u.id}?schoolId=${SCHOOL_ID}`)
      if (del.ok) { removedUsers++; console.log(`  🧹 parent user ${u.email} (${u.id})`) }
      else console.log(`  ⚠️  user delete failed ${u.id}: ${del.status}`)
    }
  }
  console.log(`   parent users: removed ${removedUsers}`)

  console.log(`\n✅ Cleanup complete — students: ${removedStudents}, groups: ${removedGroups}, parent users: ${removedUsers}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
