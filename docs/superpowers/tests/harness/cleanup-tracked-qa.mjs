#!/usr/bin/env node
// One-off cleanup of the 34 tracked QA records from the 2026-08-01 production
// validation run (docs/superpowers/tests/results/tracked-data.md).
// Deletes in the documented dependency order (dependents first), best-effort:
// a 404 / already-deleted record is reported as GONE, failures are reported.
// Records without a delete API (uploads, hymn practice session, notification)
// are reported as RESIDUE.
//
// Usage:
//   QA_API=https://niangelos-backend.onrender.com/api \
//   QA_EMAIL=... QA_PASSWORD=... node docs/superpowers/tests/harness/cleanup-tracked-qa.mjs

const API = process.env.QA_API || 'https://niangelos-backend.onrender.com/api'
const EMAIL = process.env.QA_EMAIL
const PASSWORD = process.env.QA_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error('Provide QA_EMAIL and QA_PASSWORD')
  process.exit(1)
}

let TOKEN = ''
let SCHOOL_ID = ''
let lastReq = 0
const MIN_SPACING = Number(process.env.QA_SPACING || 200)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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

// Each entry: label, delete endpoint (school-scoped where the API needs it).
// Ordered dependents-first per tracked-data.md Cleanup Plan.
const RECORDS = [
  // Dependents first
  { id: 'db7507a6-1e65-49d4-902a-ff64f07193a3', label: 'QA attendance session', del: (id) => `/attendance/sessions/${id}` },
  { id: '6c35aec2-9151-4d5e-bd10-278537434cda', label: 'QA assessment', del: (id) => `/assessments/${id}` },
  // revoke controller ignores the student path param (`@Param('id') _id`) — pass any student id
  { id: 'a1294a3f-3fe8-48d3-aa8e-839bbfdb3a11', label: 'QA student-badge', del: (id) => `/gamification/students/00000000-0000-0000-0000-000000000000/badges/${id}` },
  { id: '04a76fc4-14f1-4b81-9836-d294f451e444', label: 'QA badge', del: (id) => `/gamification/badges/${id}` },
  { id: '4469d92c-2578-48f9-bb66-46ed7038e120', label: 'QA calendar event', del: (id) => `/curriculum/calendar-events/${id}` },
  { id: 'd7f7cf8a-e97b-4921-9f23-3c2e16133d6f', label: 'QA allocation', del: (id) => `/curriculum/allocations/${id}` },
  { id: '2172dc0d-852e-4fe4-bd94-b0b4dfa71bb9', label: 'QA academic year', del: (id) => `/curriculum/academic-years/${id}` },
  { id: 'fb5e60fc-aa2a-4a5c-930d-3220660240c6', label: 'QA lesson', del: (id) => `/curriculum/lessons/${id}` },
  { id: '223c559d-08ca-4826-9f2e-b1747a43a016', label: 'QA bulk lesson', del: (id) => `/curriculum/lessons/${id}` },
  { id: '207b29c7-3ac4-4c8c-bbd3-71771760d734', label: 'QA bulk lesson', del: (id) => `/curriculum/lessons/${id}` },
  { id: '1dd07e61-fbfb-46f3-a5f7-2c6733c80799', label: 'QA subject item', del: (id) => `/curriculum/subjects/items/${id}?schoolId=${SCHOOL_ID}` },
  { id: 'c9f72843-e6b0-4726-8955-8524beb06407', label: 'QA subject', del: (id) => `/curriculum/subjects/${id}?schoolId=${SCHOOL_ID}` },
  { id: '9faff1a1-9f94-4ea3-bdfc-7f83ed99de46', label: 'QA level', del: (id) => `/curriculum/levels/${id}` },
  { id: '0eb72464-d8e3-41a5-af3a-91cfdedb0ad5', label: 'QA student group', del: (id) => `/students/groups/${id}?schoolId=${SCHOOL_ID}` },
  { id: 'c3914880-8066-4839-950e-b51b87a72317', label: 'QA family liturgy (verified)', del: (id) => `/servants/liturgy/${id}` },
  { id: 'f4a337aa-6587-48c9-aa54-c3517e9c6744', label: 'QA family liturgy (reject path)', del: (id) => `/servants/liturgy/${id}` },
  // Students (soft delete)
  { id: '00c76be3-3f59-4067-95df-ed12f5ffb3bf', label: 'QA bulk-import student', del: (id) => `/students/${id}?schoolId=${SCHOOL_ID}` },
  { id: '6e1b1baf-c309-4da0-acea-9c6e72a8a1a7', label: 'QA bulk-import student', del: (id) => `/students/${id}?schoolId=${SCHOOL_ID}` },
  { id: '6dd51361-6e62-44f9-ae4a-5a0db15472b2', label: 'QA student (Peter Test)', del: (id) => `/students/${id}?schoolId=${SCHOOL_ID}` },
  // Users (soft delete)
  { id: '28334bc2-cd3a-4d28-93df-fccf0619a5e9', label: 'QA parent user', del: (id) => `/users/${id}?schoolId=${SCHOOL_ID}` },
  { id: '3582c176-5c2f-4262-b2be-daaafb09e408', label: 'QA user', del: (id) => `/users/${id}?schoolId=${SCHOOL_ID}` },
  { id: 'ad8d5b94-0c68-4395-884f-f3481de21c7a', label: 'QA throwaway user (reset-password)', del: (id) => `/users/${id}?schoolId=${SCHOOL_ID}` },
  { id: '41a7e699-8808-4d1d-9075-54d991530e42', label: 'QA throwaway user (change-password)', del: (id) => `/users/${id}?schoolId=${SCHOOL_ID}` },
  // Schools / church / registrations
  { id: '1e81be1e-cff3-421b-b819-d1882733cdd5', label: 'QA school', del: (id) => `/users/schools/${id}` },
  { id: '152ba06b-ef4b-45ef-8761-ef65b4c6a04f', label: 'QA pending school (auth register)', del: (id) => `/admin/registrations/${id}` },
  { id: 'c94ea21e-4354-48c6-926b-2f79099cb906', label: 'QA church', del: (id) => `/churches/${id}` },
]

// No delete API — reported as residue.
const RESIDUE = [
  { id: 'bf31c917-926a-48ee-b7de-711412d38731', label: 'QA hymn practice session', why: 'no delete endpoint' },
  { id: '3cac3a7e-b75f-41f7-a06c-99b49ec7ce9f', label: 'QA notification', why: 'no delete endpoint' },
  { id: '/uploads/church-logos/b0b83b06-….png', label: 'QA uploaded file (church-logo)', why: 'no delete API' },
  { id: '/uploads/church-logos/school-561b18c1-….png', label: 'QA uploaded file (school-logo)', why: 'no delete API' },
  { id: '/uploads/avatars/avatar-38a015cd-….png', label: 'QA uploaded file (avatar)', why: 'no delete API' },
  { id: '/uploads/student-photos/student-98cb617d-….png', label: 'QA uploaded file (student-photo)', why: 'no delete API' },
  { id: '/uploads/presentations/pres-576e25af-….pptx', label: 'QA uploaded presentation', why: 'no delete API' },
  { id: 'STU-00027', label: 'QA student code (STU-00027)', why: 'student code of a QA student; covered by student soft-delete above' },
]

async function main() {
  const login = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
  if (!login.ok) { console.error('❌ Login failed:', login.status, JSON.stringify(login.data)); process.exit(1) }
  TOKEN = login.data.accessToken
  SCHOOL_ID = login.data.user.schoolId
  console.log(`✅ Logged in as ${login.data.user.email} (roles ${JSON.stringify(login.data.user.roles)}) school ${SCHOOL_ID}\n`)

  let ok = 0, gone = 0, failed = 0
  for (const r of RECORDS) {
    const res = await api('DELETE', r.del(r.id))
    if (res.ok) { ok++; console.log(`🧹  ${r.label} (${r.id}) — deleted`) }
    else if (res.status === 404) { gone++; console.log(`⚪  ${r.label} (${r.id}) — already gone (404)`) }
    else { failed++; console.log(`⚠️  ${r.label} (${r.id}) — FAILED ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`) }
  }

  console.log(`\nResidue (no delete API — needs manual/server-side cleanup):`)
  for (const r of RESIDUE) console.log(`    • ${r.label} (${r.id}) — ${r.why}`)

  console.log(`\n✅ Cleanup finished — deleted: ${ok}, already-gone: ${gone}, failed: ${failed}`)
  if (failed > 0) process.exit(2)
}

main().catch((e) => { console.error(e); process.exit(1) })