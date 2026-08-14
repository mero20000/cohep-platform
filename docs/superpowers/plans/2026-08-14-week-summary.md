# Current-Week Attendance Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "This Week" attendance summary card (Present / Absent / Late / Excused / Total / rate) to the servant/ministry dashboard, scoped to the servant's groups, covering the current week's Saturday + Sunday sessions.

**Architecture:** Extend the existing `/dashboard/mine` ministry view (`getMinistryView`) with a new `thisWeek` payload computed from attendance records whose session falls on the current week's Sat/Sun, then render a new `WeekSummaryCard` in `MinistryDashboard` fed by that payload. No new endpoint, no new network call.

**Tech Stack:** NestJS + Prisma (backend), React 18 + Next.js App Router + Tailwind + motion + lucide-react (frontend). Backend tests: Jest. Frontend tests: Vitest + Testing Library.

## Global Constraints

- Status strings are lowercase: `present | late | absent | excused` (schema field `AttendanceRecord.status` is a `String`, not an enum — see `backend/prisma/schema.prisma:715`).
- Week boundary: current week's **Saturday 00:00:00 → Sunday 23:59:59.999**. Compute `daysSinceSat = (now.getDay() + 1) % 7` (getDay: Sun=0 … Sat=6), `saturday = now − daysSinceSat`, `sunday = saturday + 1 day`.
- Scope: reuse the already-resolved `groupIds` in `getMinistryView`; filter `student.deletedAt = null`.
- `attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0`.
- Copy: EN `This Week Summary` / AR `ملخص هذا الأسبوع`; status labels EN `Present|Late|Absent|Excused`, AR `حاضر|متأخر|غائب|معذور`; attendance link EN `Attendance` / AR `الحضور`.
- No comments in code unless already present in the surrounding block.
- Backend test command: `npx jest src/modules/dashboard/dashboard.service.spec.ts` (from `backend/`). Frontend test command: `npx vitest run src/app/dashboard/__tests__/week-summary-card.test.tsx` (from `frontend/`).
- Backend baseline: 17 pre-existing failures in 4 suites (mail/users/students/announcements) — must remain unchanged. Frontend baseline: 102/102 passing.
- Push to `origin/main`; always `git pull --rebase --autostash` before pushing.

---

### Task 1: Backend — add `thisWeek` to `getMinistryView`

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.service.ts:267-439` (`getMinistryView`)
- Create: `backend/src/modules/dashboard/dashboard.service.spec.ts`

**Interfaces:**
- Consumes: `DashboardService.getMine(user, schoolId, viewRole)` → calls `getMinistryView` when role is in `['servant','group_leader','level_leader','assistant_servant']`. `getMinistryView` already has `groupIds: string[]` resolved.
- Produces: ministry response gains `thisWeek: { present: number; late: number; absent: number; excused: number; total: number; attendanceRate: number }`. This is what Task 2 renders.

- [ ] **Step 1: Write the failing spec**

Create `backend/src/modules/dashboard/dashboard.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;

  const schoolId = 'school-1';
  const user = { id: 'user-1', roles: ['servant'] };

  const prismaMock = {
    school: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    attendanceSession: { findMany: jest.fn(), count: jest.fn() },
    attendanceRecord: { findMany: jest.fn() },
    group: { findMany: jest.fn(), findUnique: jest.fn() },
    student: { count: jest.fn() },
    grade: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  function mockMinistryBaseline() {
    prisma.school.findUnique.mockResolvedValue({ name: 'S', nameAr: '', logoUrl: null, church: null });
    prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'g1' } });
    prisma.attendanceSession.findMany.mockResolvedValue([]);
    prisma.group.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);
    prisma.attendanceSession.count.mockResolvedValue(0);
    prisma.group.findUnique.mockResolvedValue({ name: 'Group A' });
    prisma.grade.findMany.mockResolvedValue([]);
  }

  describe('getMine ministry view — thisWeek', () => {
    it('returns status counts for records in the current Sat-Sun window', async () => {
      mockMinistryBaseline();
      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([]) // all-time attendanceRecords (existing stat)
        .mockResolvedValueOnce([
          { status: 'present' },
          { status: 'present' },
          { status: 'late' },
          { status: 'absent' },
          { status: 'excused' },
        ]); // weekRecords (new)

      const result = await service.getMine(user, schoolId, 'servant');

      expect(result.thisWeek).toEqual({
        present: 2,
        late: 1,
        absent: 1,
        excused: 1,
        total: 5,
        attendanceRate: 60,
      });
    });

    it('filters the week query to the servant groups and the Sat-Sun window', async () => {
      mockMinistryBaseline();
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.getMine(user, schoolId, 'servant');

      const weekCall = prisma.attendanceRecord.findMany.mock.calls[1][0];
      expect(weekCall.where.student).toEqual({ deletedAt: null });
      expect(weekCall.where.attendanceSession).toMatchObject({
        schoolId,
        groupId: { in: ['g1'] },
      });
      expect(weekCall.where.attendanceSession.scheduledDate.gte).toBeInstanceOf(Date);
      expect(weekCall.where.attendanceSession.scheduledDate.lte).toBeInstanceOf(Date);
      expect(weekCall.where.attendanceSession.scheduledDate.lte.getTime())
        .toBeGreaterThan(weekCall.where.attendanceSession.scheduledDate.gte.getTime());
    });

    it('returns attendanceRate 0 when there are no records this week', async () => {
      mockMinistryBaseline();
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.getMine(user, schoolId, 'servant');

      expect(result.thisWeek.attendanceRate).toBe(0);
      expect(result.thisWeek.total).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx jest src/modules/dashboard/dashboard.service.spec.ts` (in `backend/`)
Expected: FAIL — `thisWeek` is `undefined` (property does not exist yet).

- [ ] **Step 3: Compute the current week window in `getMinistryView`**

In `getMinistryView` (dashboard.service.ts), immediately before the `Promise.all` at line 322, add:

```ts
const now = new Date();
const daysSinceSat = (now.getDay() + 1) % 7;
const saturday = new Date(now);
saturday.setDate(now.getDate() - daysSinceSat);
saturday.setHours(0, 0, 0, 0);
const sunday = new Date(saturday);
sunday.setDate(saturday.getDate() + 1);
sunday.setHours(23, 59, 59, 999);
```

- [ ] **Step 4: Add the week records query to the `Promise.all`**

Change the destructure at line 322 to include `weekRecords`:

```ts
const [sessions, groups, studentsCount, completedSessions, totalSessions, attendanceRecords, recentGrades, weekRecords] = await Promise.all([
```

Append a new query as the last array element (after the `grade.findMany` entry, before the closing `]);` at line 370):

```ts
this.prisma.attendanceRecord.findMany({
  where: {
    attendanceSession: {
      schoolId,
      groupId: { in: groupIds },
      scheduledDate: { gte: saturday, lte: sunday },
    },
    student: { deletedAt: null },
  },
  select: { status: true },
}),
```

Note: the existing all-time `attendanceRecord.findMany` (line 347-353) stays untouched — it must remain the FIRST `attendanceRecord.findMany` call so the spec's `mock.calls[1]` (week query) holds.

- [ ] **Step 5: Derive and return `thisWeek`**

After the existing `attendanceRate` block (line 389-393), add:

```ts
const weekPresent = weekRecords.filter((r: any) => r.status === 'present').length;
const weekLate = weekRecords.filter((r: any) => r.status === 'late').length;
const weekAbsent = weekRecords.filter((r: any) => r.status === 'absent').length;
const weekExcused = weekRecords.filter((r: any) => r.status === 'excused').length;
const weekTotal = weekRecords.length;
const thisWeek = {
  present: weekPresent,
  late: weekLate,
  absent: weekAbsent,
  excused: weekExcused,
  total: weekTotal,
  attendanceRate: weekTotal > 0 ? Math.round(((weekPresent + weekLate) / weekTotal) * 100) : 0,
};
```

In the return object (line 395-438), add `thisWeek,` after `recentGrades: ...` (line 427-437).

- [ ] **Step 6: Run the spec to verify it passes**

Run: `npx jest src/modules/dashboard/dashboard.service.spec.ts` (in `backend/`)
Expected: PASS (all 3 tests).

- [ ] **Step 7: Type-check the backend**

Run: `npx tsc --noEmit` (in `backend/`)
Expected: no errors.

- [ ] **Step 8: Run the full backend suite to confirm no regressions**

Run: `npx jest 2>&1 | tail -30` (in `backend/`)
Expected: the 4 pre-existing failing suites (mail/users/students/announcements, 17 tests) fail exactly as before; all other suites pass.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/dashboard/dashboard.service.ts backend/src/modules/dashboard/dashboard.service.spec.ts
git commit -m "feat(dashboard): add current-week attendance summary to ministry view"
```

---

### Task 2: Frontend — `WeekSummaryCard` on the ministry dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx` (add `WeekSummaryCard` after `WeekScheduleCard` ~line 1026; mount it in `MinistryDashboard` after the "This Week Schedule" block at line 1738-1743)
- Create: `frontend/src/app/dashboard/__tests__/week-summary-card.test.tsx`

**Interfaces:**
- Consumes: `d.thisWeek` from the `/dashboard/mine` response (Task 1): `{ present, late, absent, excused, total, attendanceRate }`.
- Produces: exported `WeekSummaryCard({ thisWeek, lang })` used only inside this file. Icons used are already imported at dashboard-client.tsx:9-17 (`ClipboardCheck`, `UserCheck`, `Clock`, `XCircle`, `AlertTriangle`) — no import changes needed.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/dashboard/__tests__/week-summary-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import { WeekSummaryCard } from '../dashboard-client'

const mockGet = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('motion/react', () => ({
  motion: { div: ({ children }: any) => <div>{children}</div> },
}))

vi.mock('@/lib/school', () => ({
  getSchoolId: () => 'school-1',
}))

beforeEach(() => {
  mockGet.mockReset()
})

it('renders the week summary counts', () => {
  render(
    <WeekSummaryCard
      lang="en"
      thisWeek={{ present: 2, late: 1, absent: 1, excused: 1, total: 5, attendanceRate: 60 }}
    />,
  )
  expect(screen.getByText('This Week Summary')).toBeTruthy()
  expect(screen.getByText('Present')).toBeTruthy()
  expect(screen.getByText('Late')).toBeTruthy()
  expect(screen.getByText('Absent')).toBeTruthy()
  expect(screen.getByText('Excused')).toBeTruthy()
  expect(screen.getByText('Attendance Rate: 60%')).toBeTruthy()
})

it('renders nothing when thisWeek is missing', () => {
  const { container } = render(<WeekSummaryCard lang="en" thisWeek={null} />)
  expect(container).toBeEmptyDOMElement()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/dashboard/__tests__/week-summary-card.test.tsx` (in `frontend/`)
Expected: FAIL — `WeekSummaryCard` is not exported from `../dashboard-client`.

- [ ] **Step 3: Add the `WeekSummaryCard` component**

Insert immediately after the `WeekScheduleCard` function (after line 1026, before `SessionSummaryModal` at line 1028):

```tsx
export function WeekSummaryCard({ thisWeek, lang }: { thisWeek?: any; lang: string }) {
  if (!thisWeek) return null
  const total = thisWeek.total ?? 0
  const rate = thisWeek.attendanceRate ?? 0
  const items = [
    { key: 'present', label: lang === 'ar' ? 'حاضر' : 'Present', count: thisWeek.present ?? 0, dot: 'bg-green-500', Icon: UserCheck },
    { key: 'late', label: lang === 'ar' ? 'متأخر' : 'Late', count: thisWeek.late ?? 0, dot: 'bg-amber-500', Icon: Clock },
    { key: 'absent', label: lang === 'ar' ? 'غائب' : 'Absent', count: thisWeek.absent ?? 0, dot: 'bg-red-500', Icon: XCircle },
    { key: 'excused', label: lang === 'ar' ? 'معذور' : 'Excused', count: thisWeek.excused ?? 0, dot: 'bg-gray-400', Icon: AlertTriangle },
  ]
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-emerald-600 ring-1 ring-emerald-200/50">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'ملخص هذا الأسبوع' : 'This Week Summary'}</h2>
        </div>
        <Link href="/dashboard/attendance" className="text-xs text-emerald-600 font-medium hover:text-emerald-700">
          {lang === 'ar' ? 'الحضور' : 'Attendance'}
        </Link>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((it) => (
            <div key={it.key} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`h-2 w-2 rounded-full ${it.dot}`} />
                <span className="text-[11px] text-gray-500">{it.label}</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{it.count}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2.5">
          <span className="text-sm font-medium text-emerald-700">{lang === 'ar' ? `الإجمالي: ${total}` : `Total: ${total}`}</span>
          <span className="text-sm font-bold text-emerald-700">{lang === 'ar' ? `معدل الحضور: ${rate}٪` : `Attendance Rate: ${rate}%`}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Mount `WeekSummaryCard` in `MinistryDashboard`**

Insert immediately after the "This Week Schedule" block (after line 1743, before the `{/* Recurring Sessions Button */}` block at line 1745):

```tsx
{/* This Week Summary */}
{['servant', 'group_leader', 'level_leader'].includes(d.role || '') && (
  <motion.div variants={fadeUp}>
    <WeekSummaryCard thisWeek={d.thisWeek} lang={lang} />
  </motion.div>
)}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/dashboard/__tests__/week-summary-card.test.tsx` (in `frontend/`)
Expected: PASS (both tests).

- [ ] **Step 6: Run the full frontend suite to confirm no regressions**

Run: `npx vitest run 2>&1 | tail -15` (in `frontend/`)
Expected: 104/104 pass (2 new tests + prior 102).

- [ ] **Step 7: Type-check the frontend**

Run: `npx tsc --noEmit` (in `frontend/`)
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/dashboard/dashboard-client.tsx frontend/src/app/dashboard/__tests__/week-summary-card.test.tsx
git commit -m "feat(dashboard): add this-week attendance summary card for servants"
```

---

### Task 3: Push and verify

- [ ] **Step 1: Run the backend dashboard spec once more**

Run: `npx jest src/modules/dashboard/dashboard.service.spec.ts` (in `backend/`)
Expected: PASS.

- [ ] **Step 2: Push**

```bash
git pull --rebase --autostash && git push
```
Expected: pushed to `origin/main`.

## Self-Review

**Spec coverage:**
- New card on ministry dashboard → Task 2 (mounted in `MinistryDashboard`, role-gated same as other servant cards).
- Sat/Sun week window → Task 1 Step 3; verified by Task 1 Step 4 test (`scheduledDate.gte`/`lte` are Dates spanning a 2-day window).
- "My assigned groups" scope → Task 1 Step 4 (`groupId: { in: groupIds }`) + `student.deletedAt: null`; asserted in the spec.
- Status counts + `attendanceRate` (0 when no records) → Task 1 Step 5 + Step 1 tests.
- No new endpoint / no new network call → design preserves `/dashboard/mine` as the only fetch.
- Testing section of spec (backend spec + frontend coverage + type-check) → Task 1 Steps 1-7, Task 2 Steps 1-7.
- Out-of-scope items (management/parent dashboards, all-time stat, drill-down) → untouched.

**Placeholder scan:** No TBDs, TODOs, or "add error handling" placeholders. Every code step contains full code.

**Type consistency:** `thisWeek` shape `{ present, late, absent, excused, total, attendanceRate }` is produced in Task 1 and consumed identically in Task 2. `WeekSummaryCard` props (`thisWeek`, `lang`) match both the test and the mount site. The `attendanceRecord.findMany` call order (all-time first, week second) is asserted in the spec and preserved in the implementation.
