import type { Page, Route } from '@playwright/test'
import { SCHOOL_ID, STUDENT_CODE, type RoleFixture } from './roles'

/**
 * In-browser API mock. The app talks to `${origin}/api/...` in e2e (see playwright.config.ts), so
 * every request can be answered here and the suite needs no backend or database.
 *
 * Unknown GET endpoints answer `{}` and are collected in `unhandled`, so a new page that calls a
 * new endpoint shows up in the test output instead of silently rendering an empty state.
 */

const NAMES = [
  'Mina Girgis', 'Marina Samir', 'Kyrillos Adel', 'Mariam Nabil', 'Bishoy Fayez', 'Demiana Wagdy',
  'Antonios Maher', 'Yostina Emad', 'Abanoub Raafat', 'Veronia Hany', 'Philopateer Magdy', 'Irene Sameh',
  'Pierre Atef', 'Christina Lamei', 'Shenouda Ayman', 'Mary Ashraf', 'Fady Naguib', 'Nancy Samy',
  'George Medhat', 'Rita Shady', 'Moses Anwar', 'Sandra Hossam', 'Daniel Rafik', 'Martha Essam',
]

// Photos: every third student has one that loads, a few point at a file that 404s (the fallback must cope),
// the rest have none. /icons/icon-192x192.png is a real file served by the app itself.
// assetUrl() only passes absolute URLs and /uploads/... straight through (anything else goes to the recordings proxy),
// so the working photo is an absolute URL back to the app under test.
const APP_ORIGIN = `http://localhost:${process.env.E2E_PORT || 3100}`
export const PHOTO_OK = `${APP_ORIGIN}/icons/icon-192x192.png`
export const PHOTO_BROKEN = '/uploads/student-photos/missing.png'
const photoFor = (i: number) => (i % 3 === 0 ? PHOTO_OK : i % 7 === 1 ? PHOTO_BROKEN : null)

const student = (i: number) => {
  const [firstName, lastName] = NAMES[i].split(' ')
  return {
    photoUrl: photoFor(i),
    id: `stu-${i + 1}`, firstName, lastName, status: 'active', schoolId: SCHOOL_ID,
    gender: i % 2 ? 'female' : 'male', groupId: 'grp-1', group: { id: 'grp-1', name: 'Group A' },
    gradeId: 'gr-1', grade: { id: 'gr-1', name: 'Grade 3' },
  }
}

const students = NAMES.map((_, i) => student(i))

const session = {
  id: 'sess-1', type: 'class', status: 'in_progress',
  scheduledDate: new Date().toISOString(), schoolId: SCHOOL_ID,
  level: { id: 'lvl-1', name: 'Level 2', number: 2 }, group: { id: 'grp-1', name: 'Group A' },
  attendanceRecords: students.map((s) => ({ id: `rec-${s.id}`, status: 'unmarked', student: s })),
}

const school = {
  id: SCHOOL_ID, name: 'St. Mark Hymn School', nameAr: 'مدرسة مار مرقس للألحان', logoUrl: null,
  church: { id: 'ch-1', name: 'St. Mark Church', logoUrl: null },
}

const stats = {
  school, totalChurches: 4, activeStudents: 186, totalLevels: 6, publishedAssessments: 12,
  // Last 7 days vs the 7 before, an 8-week trend, and the at-risk count: the same shape as the real API.
  attendanceRate: 82, attendancePrevRate: 78, studentsAtRisk: 3,
  attendanceTrend: [70, 74, null, 79, 81, 77, 78, 82].map((rate, i) => ({
    weekStart: new Date(Date.UTC(2026, 8, 6 + i * 7)).toISOString().slice(0, 10), rate, decided: rate === null ? 0 : 40,
  })),
  assessmentStats: { passRate: 76, gradedCount: 40, passCount: 30, avgGradeScore: 14, recent: { windowDays: 90, gradedCount: 12, passRate: 83 } }, upcomingSessions: [], leaderboard: [], activity: [],
  recentGrades: [
    { id: 'g1', studentName: 'Mina Girgis', studentPhotoUrl: PHOTO_OK, assessmentTitle: 'Hymn of the Cherubim quiz', assessmentId: 'as-1', score: 18, maxScore: 20, passed: true, gradedAt: '2026-10-25T10:00:00Z' },
    { id: 'g2', studentName: 'Marina Samir', studentPhotoUrl: null, assessmentTitle: 'Hymn of the Cherubim quiz', assessmentId: 'as-1', score: 9, maxScore: 20, passed: false, gradedAt: '2026-10-25T10:05:00Z' },
  ],
}

const portal = {
  student: {
    id: 'stu-1', firstName: 'Mina', lastName: 'Girgis', studentCode: STUDENT_CODE,
    level: { id: 'lvl-1', name: 'Level 2', number: 2 }, group: { id: 'grp-1', name: 'Group A' },
  },
  school: { name: school.name, nameAr: school.nameAr, churchName: school.church.name, churchLogoUrl: null },
  attendance: { present: 9, late: 1, absent: 1, excused: 1, total: 12 },
  recentAttendance: [
    { date: '2026-10-25', status: 'present', homeworkStatus: 'completed' },
    { date: '2026-10-18', status: 'late', homeworkStatus: 'partial' },
    { date: '2026-10-11', status: 'absent' },
  ],
  badges: [], liturgy: { verifiedCount: 3, pendingCount: 1, recent: [] }, totalXp: 420,
  upcomingSessions: [], recentHomework: [],
  assessments: [{
    id: 'as-1', title: 'Hymn of the Cherubim quiz', type: 'quiz', totalPoints: 20, passingScore: 12,
    level: { id: 'lvl-1', name: 'Level 2' }, subject: { id: 'sub-1', name: 'Hymns' },
    submissionStatus: 'not_started', submissionId: '', submittedAt: '',
  }],
}

const mineFor = (role: string) => ({
  role, school, studentsCount: 18, attendanceRate: 84, sessions: [], groups: [{ id: 'grp-1', name: 'Group A' }],
  assigned: { groupId: 'grp-1' }, recentGrades: [], thisWeek: {},
  children: role === 'parent'
    ? [{ id: 'stu-1', firstName: 'Mina', lastName: 'Girgis', attendanceRate: 90, level: { name: 'Level 2' }, progress: { percent: 64 } }]
    : undefined,
})

export interface MockOptions {
  /** Merged over the school-wide dashboard stats, to test a particular situation (e.g. no class this week). */
  stats?: Record<string, unknown>
}

type Handler = (url: URL, method: string, role: RoleFixture, opts: MockOptions) => unknown | undefined

const handlers: Array<[RegExp, Handler]> = [
  [/^\/api\/auth\/me$/, (_u, _m, r) => ({ ...r.user })],
  [/^\/api\/dashboard\/stats$/, (_u, _m, _r, o) => ({ ...stats, ...(o.stats ?? {}) })],
  [/^\/api\/dashboard\/mine$/, (u, _m, r) => mineFor(u.searchParams.get('viewRole') || r.user.roles[0])],
  [/^\/api\/dashboard\/servant-digest$/, (_u, _m, r) => ({
    generatedAt: new Date().toISOString(),
    servant: { id: r.user.id, firstName: r.user.firstName, lastName: r.user.lastName },
    studentStory: null, classTrend: null, milestone: null, absenceAlerts: [], nextSession: null,
  })],
  [/^\/api\/dashboard\/(practice-stats|leaderboard)$/, () => ({})],
  [/^\/api\/users\/schools\/me$/, () => school],
  [/^\/api\/users\/schools$/, () => [school]],
  [/^\/api\/users$/, () => [{ id: 'u1', roles: ['servant'] }, { id: 'u2', roles: ['group_leader'] }]],
  [/^\/api\/churches$/, () => [{ id: 'ch-1', name: 'St. Mark Church' }]],
  [/^\/api\/registrations$/, () => [{ id: 'reg-1' }, { id: 'reg-2' }, { id: 'reg-3' }]],
  [/^\/api\/assessments\/pending-review\/count$/, () => ({ count: 12 })],
  [/^\/api\/notifications$/, () => []],
  [/^\/api\/announcements$/, () => []],
  [/^\/api\/students$/, (u) => {
    const rows = u.searchParams.get('engagementStatus') === 'at_risk' ? students.slice(0, 3) : students
    return { data: rows, pagination: { page: 1, limit: 20, total: rows.length, totalPages: 1 } }
  }],
  [/^\/api\/reports\/priest-pulse$/, () => ({
    generatedAt: new Date().toISOString(),
    pulse: {
      attendanceThisWeek: 82, attendanceLastWeek: 78, attendanceTrend: 4, attendanceTrendPoints: [],
      studentsAtRisk: 3, pendingGrading: 2, xpEarnedThisWeek: 1200, familyPracticeThisWeek: 5,
      totalStudents: 186, activeStudentsThisWeek: 150, healthScore: 77,
      healthBreakdown: [
        { key: 'attendance', labelEn: 'Attendance', labelAr: 'الحضور', points: 41, max: 50, counted: true, detailEn: '82% in the last 7 days', detailAr: '82٪ في آخر 7 أيام' },
        { key: 'grading', labelEn: 'Grading backlog', labelAr: 'تقييمات معلقة', points: 16, max: 20, counted: true, detailEn: '2 waiting (−2 each)', detailAr: '2 بانتظار التصحيح (−2 لكل واحد)' },
        { key: 'atRisk', labelEn: 'Students at risk', labelAr: 'طلاب في خطر', points: 8, max: 20, counted: true, detailEn: '3 students (−4 each)', detailAr: '3 من الطلاب (−4 لكل طالب)' },
        { key: 'homePractice', labelEn: 'Home practice', labelAr: 'الممارسة المنزلية', points: 10, max: 10, counted: true, detailEn: '5 families practised (full marks if any)', detailAr: '5 عائلة مارست (الدرجة كاملة إن مارست أي عائلة)' },
      ],
    },
    signals: [{ type: 'warning', messageEn: '3 students have missed 3+ sessions in a row.', messageAr: '3 طالب غابوا عن 3 جلسات متتالية أو أكثر.' }],
  })],
  [/^\/api\/reports\/level-group-overview$/, (u) => {
    const days = Number(u.searchParams.get('days') ?? 30)
    const unit = (id: string, name: string, students: number, attendanceRate: number | null, prev: number | null, atRisk: number, passRate: number | null) =>
      ({ id, name, nameAr: null, students, attendanceRate, prevAttendanceRate: prev, atRisk, passRate, gradedCount: passRate === null ? 0 : 12 })
    return {
      generatedAt: new Date().toISOString(), windowDays: days,
      levels: [unit('lvl-1', 'Level 1', 40, 91, 88, 0, 85), unit('lvl-2', 'Level 2', 35, 54, 66, 6, 48), unit('lvl-3', 'Level 3', 28, null, null, 0, null)],
      groups: [unit('grp-1', 'Group A', 30, 72, 70, 2, 75), unit('grp-2', 'Group B', 25, 58, 61, 4, 60)],
    }
  }],
  // Student detail dialog: all three return lists.
  [/^\/api\/students\/[^/]+\/activity$/, () => []],
  [/^\/api\/gamification\/badges$/, () => []],
  [/^\/api\/gamification\/students\/[^/]+\/badges$/, () => []],
  [/^\/api\/students\/stats$/, () => ({ total: students.length, active: students.length })],
  [/^\/api\/students\/groups\/all$/, () => [{ id: 'grp-1', name: 'Group A', status: 'active' }]],
  [/^\/api\/students\/levels\/all$/, () => [{ id: 'lvl-1', name: 'Level 2', number: 2 }]],
  [/^\/api\/curriculum\/(levels|lessons|academic-years)$/, () => []],
  [/^\/api\/grades$/, () => [{ id: 'gr-1', name: 'Grade 3', groupId: 'grp-1' }]],
  [/^\/api\/attendance\/liturgy-heatmap$/, () => ({ students: [], weeks: [] })],
  [/^\/api\/servants\/group-mates$/, () => []],
  [/^\/api\/attendance\/sessions$/, () => []],
  [/^\/api\/attendance\/sessions\/sess-1$/, () => session],
  [/^\/api\/attendance\/start-class$/, () => ({ session: { id: 'sess-1' } })],
  [/^\/api\/student-portal\/[^/]+\/subject-items$/, () => []],
  [/^\/api\/student-portal\/(?!login)[^/]+$/, () => portal],
  [/^\/api\/student-portal\/login$/, () => ({ accessToken: 'portal-token' })],
]

export interface MockApi { unhandled: string[]; errors: string[] }

export async function mockApi(page: Page, role: RoleFixture, opts: MockOptions = {}): Promise<MockApi> {
  const unhandled: string[] = []
  const errors: string[] = []

  // Uncaught exceptions and errors React logs when an error boundary catches a crash. Hydration
  // mismatch warnings are ignored here (tracked separately), and the Next dev overlay is hidden so
  // it can't intercept taps.
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (/TypeError|ReferenceError|RangeError|Unhandled|Minified React error/.test(text)) errors.push(text.slice(0, 300))
  })
  await page.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style')
      style.textContent = 'nextjs-portal{display:none!important}'
      document.documentElement.appendChild(style)
    }
    if (document.documentElement) hide()
    else document.addEventListener('DOMContentLoaded', hide)
  })

  await page.addInitScript(([user]) => {
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('niangelos_token', 'e2e-token')
  }, [role.user] as const)

  await page.route('**/api/**', async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.pathname.startsWith('/api/logto')) return route.fallback()

    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (req.method() !== 'GET') {
      // Writes succeed with an empty body; analytics are fire-and-forget.
      return json({ ok: true })
    }
    for (const [pattern, handle] of handlers) {
      if (pattern.test(url.pathname)) {
        const body = handle(url, req.method(), role, opts)
        if (body !== undefined) return json(body)
      }
    }
    unhandled.push(`GET ${url.pathname}`)
    return json({})
  })

  return { unhandled, errors }
}

export { STUDENT_CODE }
