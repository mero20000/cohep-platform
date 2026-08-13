# Servant Role Improvements — Hardening Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the deferred review minors and cosmetic spec gaps from the Servant Role Improvements feature: lazy time allocation + negative backend tests, a `getSchoolServantSummary` dateJoined test, a never-blank group select with an "assigned" hint and list-row refresh, journey-card test cleanup, and End Class post-success state coverage.

**Architecture:** Five independent, small changes. Two backend hardening tasks (attendance timing + servants summary test). Three frontend tasks (attendance group select, journey card test cleanup, End Class test coverage). No new endpoints, no DB changes.

**Tech Stack:** NestJS + Prisma + Jest (backend), Next.js App Router + React + Vitest (frontend).

## Global Constraints

- No database migrations. Only existing schema fields used.
- Follow existing patterns: `t(en, ar)` bilingual helper where used; `toast` from `@/components/ui/toast`; `http` from `@/lib/http-client`; `getSchoolId()` from `@/lib/school`.
- Backend verification command: `npx tsc --noEmit -p tsconfig.json` and `npx jest <spec-path>` (backend uses Jest, NOT vitest).
- Frontend verification command: `npm run type-check` and `npx vitest run <test-path>`.
- Copy rules: Arabic = `المجموعة المخصصة: {name}`, English = `Assigned: {name}`.
- The backend suite has 4 PRE-EXISTING failing suites (mail/users/students/announcements, 17 tests) and the frontend suite has 27 PRE-EXISTING failures (missing `Star` lucide-react mock). These are unrelated to this plan; the regression check is "no NEW failures", never "make all green".

---

### Task 1: Backend — lazy `now` + negative tests in `updateSession`

**Files:**
- Modify: `backend/src/modules/attendance/attendance.service.ts:807`
- Test: `backend/src/modules/attendance/attendance.service.spec.ts` (append to the existing `describe('updateSession')` block)

**Interfaces:**
- Consumes: existing `updateSession(id: string, dto: Partial<CreateAttendanceSessionDto>)` and `syncSessionStudents(id, servantId)` — signatures unchanged.
- Produces: `updateSession` allocates `new Date()` only when a status transition actually records a time; no behavior change. Later tasks rely on `updateSession` behaving identically.

- [ ] **Step 1: Write the failing tests**

Append these two tests inside the existing `describe('updateSession', ...)` block in `backend/src/modules/attendance/attendance.service.spec.ts` (after the `re-syncs students when groupId changes` test). The `beforeEach` in that block already sets up `storedSession`, `findUnique`, `update`, `student.findMany`, `attendanceRecord.findMany/deleteMany/createMany`:

```ts
it('does NOT re-sync students when neither status nor group changes', async () => {
  await service.updateSession('sess-1', { notes: 'just a note' } as any);

  expect(prisma.student.findMany).not.toHaveBeenCalled();
});

it('does NOT overwrite actualStartTime when already set', async () => {
  const started = new Date('2026-01-01T00:00:00.000Z');
  storedSession = { ...baseSession, status: 'in_progress', actualStartTime: started };

  await service.updateSession('sess-1', { status: 'in_progress' } as any);

  const data = prisma.attendanceSession.update.mock.calls[0][0].data;
  expect(data.actualStartTime).toBeUndefined();
  expect(storedSession.actualStartTime).toBe(started);
});
```

- [ ] **Step 2: Run tests to verify the new ones pass**

Run: `npx jest src/modules/attendance/attendance.service.spec.ts`
Expected: both new tests pass. (They are negative tests — they pass against the current implementation too; their value is regression protection, not red-first. Do NOT remove them; the task's implementable change is step 3.)

- [ ] **Step 3: Make `now` lazy**

In `backend/src/modules/attendance/attendance.service.ts`, at line 807, remove `const now = new Date();`. Change lines 819-820 from:

```ts
        ...(statusChanged && dto.status === 'in_progress' && !session.actualStartTime && { actualStartTime: now }),
        ...(statusChanged && dto.status === 'completed' && { actualEndTime: now }),
```

to:

```ts
        ...(statusChanged && dto.status === 'in_progress' && !session.actualStartTime && { actualStartTime: new Date() }),
        ...(statusChanged && dto.status === 'completed' && { actualEndTime: new Date() }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/attendance/attendance.service.spec.ts`
Expected: PASS (all 11 tests in the file, including the 2 new ones).

- [ ] **Step 5: Run backend typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/attendance/attendance.service.ts backend/src/modules/attendance/attendance.service.spec.ts
git commit -m "refactor(backend): lazy time allocation and negative tests in updateSession"
```

---

### Task 2: Backend — `getSchoolServantSummary` dateJoined test

**Files:**
- Test: `backend/src/modules/servants/servants.service.spec.ts`

**Interfaces:**
- Consumes: existing `getSchoolServantSummary(schoolId: string): Promise<ServantProfileData[]>` — unchanged.
- Produces: test coverage confirming `ServantProfileData.dateJoined` is populated from `metadata.dateJoined || user.createdAt.toISOString()` in the summary builder. No code change.

- [ ] **Step 1: Write the failing test**

Read the existing mock setup in `backend/src/modules/servants/servants.service.spec.ts` first and match its `prisma.user.findMany` mock shape (it must resolve an array of user objects each having `userRoles: [{ role: { name } }]`, `servantProfile`, `metadata`, `createdAt`). Append inside the file:

```ts
describe('getSchoolServantSummary dateJoined', () => {
  it('returns metadata.dateJoined when set', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u2',
        firstName: 'A',
        lastName: 'B',
        avatarUrl: null,
        createdAt: new Date('2021-06-01T00:00:00.000Z'),
        metadata: { dateJoined: '2020-01-15' },
        servantProfile: null,
        userRoles: [{ role: { name: 'servant' } }],
      },
    ] as any);

    const result = await service.getSchoolServantSummary('school-1');
    expect(result[0].dateJoined).toBe('2020-01-15');
  });

  it('falls back to user.createdAt when metadata.dateJoined is absent', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u2',
        firstName: 'A',
        lastName: 'B',
        avatarUrl: null,
        createdAt: new Date('2021-06-01T00:00:00.000Z'),
        metadata: {},
        servantProfile: null,
        userRoles: [{ role: { name: 'servant' } }],
      },
    ] as any);

    const result = await service.getSchoolServantSummary('school-1');
    expect(result[0].dateJoined).toBe(new Date('2021-06-01T00:00:00.000Z').toISOString());
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest src/modules/servants/servants.service.spec.ts`
Expected: PASS (new tests + existing tests).

- [ ] **Step 3: Run backend typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/servants/servants.service.spec.ts
git commit -m "test(backend): cover dateJoined in getSchoolServantSummary"
```

---

### Task 3: Frontend — group select hardening in Mark Attendance

**Files:**
- Modify: `frontend/src/app/dashboard/attendance/attendance-client.tsx:243-252, 394-398, 576-583`
- Test: `frontend/src/app/dashboard/attendance/__tests__/attendance-client.test.tsx`

**Interfaces:**
- Consumes: `groups: Group[]` state (from `fetchLevelsGroups`), `selectedSession`, `assignedGroupId` (computed at line 394), `http.put('/attendance/sessions/:id', { groupId })`, `fetchSessionDetail(id)`, `fetchSessions()`.
- Produces: (a) the group select never renders a blank value — the session's current group and the assigned group are always present as options; (b) an "assigned" hint line when the assigned group differs from the current selection; (c) `handleChangeSessionGroup` refreshes the session list after a successful PUT.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/app/dashboard/attendance/__tests__/attendance-client.test.tsx`. The existing `beforeEach` (lines 76-91) seeds `localStorage` with `metadata.groupId: 'group-1'`, mocks GETs (sessions returns `{ data: [session] }` where `session.group = { id: 'group-1', name: 'Group A' }`), and `groups` = `[group-1, group-2]`. Add these tests:

```tsx
it('defaults the select to the assigned group when the session has no group', async () => {
  mockGet.mockImplementation((path: string) => {
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path === '/students/groups/all') return Promise.resolve(groups)
    if (path === '/attendance/sessions') return Promise.resolve({ data: [{ ...session, group: null }] })
    if (path.startsWith('/attendance/sessions/')) {
      return Promise.resolve({ ...session, group: null, attendanceRecords: [] })
    }
    return Promise.resolve([])
  })
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  const groupSelect = await screen.findByLabelText('Group')
  expect(groupSelect).toHaveValue('group-1')
})

it('shows the assigned hint when the assigned group differs from the session group', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 'u1', metadata: { groupId: 'group-2' } }))
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  await screen.findByLabelText('Group')
  await waitFor(() => {
    expect(screen.getByText('Assigned: Group B')).toBeTruthy()
  })
})

it('renders read-only group text for completed sessions', async () => {
  mockGet.mockImplementation((path: string) => {
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path === '/students/groups/all') return Promise.resolve(groups)
    if (path === '/attendance/sessions') return Promise.resolve({ data: [{ ...session, status: 'completed' }] })
    if (path.startsWith('/attendance/sessions/')) {
      return Promise.resolve({ ...session, status: 'completed', attendanceRecords: [] })
    }
    return Promise.resolve([])
  })
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  await waitFor(() => {
    expect(screen.getByText('Group A')).toBeTruthy()
  })
  expect(screen.queryByLabelText('Group')).toBeNull()
})

it('shows an error toast when the group update fails', async () => {
  render(<AttendanceClient />)
  const row = await screen.findByRole('button', { name: /^session /i })
  fireEvent.click(row)
  const groupSelect = await screen.findByLabelText('Group')
  mockPut.mockRejectedValueOnce(new Error('boom'))
  fireEvent.change(groupSelect, { target: { value: 'group-2' } })
  await waitFor(() => {
    expect(mockToast).toHaveBeenCalledWith('error', expect.anything())
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/app/dashboard/attendance/__tests__/attendance-client.test.tsx`
Expected: the "assigned group default" test fails (select is blank or session group wins), the "assigned hint" test fails (no `Assigned: Group B` text), the "completed" test fails (a `Group` labeled select exists), and the error-toast test may pass trivially (it is a negative test). Note: `mockToast` already exists in the file (line 8) and `waitFor`/`screen` are imported.

- [ ] **Step 3: Implement the group select hardening**

In `frontend/src/app/dashboard/attendance/attendance-client.tsx`:

1. **Never-blank options + assigned hint.** Replace the select block at lines 574-583 with:

```tsx
{(() => {
  const currentGroupId = selectedSession.group?.id
  const optionIds = new Set(groups.map(g => g.id))
  const optionGroups = [...groups]
  if (currentGroupId && !optionIds.has(currentGroupId)) {
    optionGroups.push({ id: currentGroupId, name: selectedSession.group?.name || currentGroupId, levelId: selectedSession.level?.id || '', status: 'active' })
  }
  if (assignedGroupId && !optionIds.has(assignedGroupId)) {
    const assignedName = groups.find(g => g.id === assignedGroupId)?.name || assignedGroupId
    optionGroups.push({ id: assignedGroupId, name: assignedName, levelId: '', status: 'active' })
  }
  const selectValue = currentGroupId || assignedGroupId || ''
  return (
    <>
      <select
        aria-label={lang === 'ar' ? 'المجموعة' : 'Group'}
        value={selectValue}
        onChange={e => handleChangeSessionGroup(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-xs min-h-[28px] focus:border-gold-500 focus:outline-none"
      >
        {optionGroups.map(g => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      {assignedGroupId && assignedGroupId !== selectValue && (
        <span className="block text-[10px] text-gray-400 mt-0.5">
          {lang === 'ar' ? `المجموعة المخصصة: ${optionGroups.find(g => g.id === assignedGroupId)?.name || assignedGroupId}` : `Assigned: ${optionGroups.find(g => g.id === assignedGroupId)?.name || assignedGroupId}`}
        </span>
      )}
    </>
  )
})()}
```

2. **Refresh list row.** In `handleChangeSessionGroup` (line 243), after the successful PUT and `fetchSessionDetail(selectedSession.id)`, add `fetchSessions()`:

```tsx
  const handleChangeSessionGroup = async (groupId: string) => {
    if (!selectedSession || !groupId) return
    try {
      await http.put(`/attendance/sessions/${selectedSession.id}`, { groupId })
      toast('success', lang === 'ar' ? 'تم تحديث المجموعة' : 'Group updated')
      fetchSessionDetail(selectedSession.id)
      fetchSessions()
    } catch {
      toast('error', lang === 'ar' ? 'فشل تحديث المجموعة' : 'Failed to update group')
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/dashboard/attendance/__tests__/attendance-client.test.tsx`
Expected: PASS (all 5 tests: the original + 4 new).

- [ ] **Step 5: Run frontend typecheck + full suite (regression only)**

Run: `npm run type-check` and `npm test`
Expected: type-check clean. Test count: 27 pre-existing failures unchanged (no new failures).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/dashboard/attendance/attendance-client.tsx frontend/src/app/dashboard/attendance/__tests__/attendance-client.test.tsx
git commit -m "feat(frontend): never-blank group select, assigned hint, and list refresh in mark attendance"
```

---

### Task 4: Frontend — journey card test cleanup

**Files:**
- Test: `frontend/src/components/dashboard/__tests__/servant-journey-card.test.tsx`

**Interfaces:**
- Consumes: existing `ServantJourneyCard` component (unchanged) and its live-years computation (unchanged).
- Produces: a deterministic, date-independent test for the years computation; removes lint noise. No component code change.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `frontend/src/components/dashboard/__tests__/servant-journey-card.test.tsx` with:

```tsx
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServantJourneyCard } from '../servant-journey-card'

const mockGet = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a) },
}))

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mockGet.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-13T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

it('computes years from dateJoined', async () => {
  mockGet.mockResolvedValue({
    userId: 'u1',
    dateJoined: '2020-01-15',
    yearsOfService: 2, // stale cached value — must not be displayed
    totalStudents: 5,
    totalHymns: 3,
  })
  renderWithClient(<ServantJourneyCard />)
  await waitFor(() => {
    expect(screen.getByText('6')).toBeTruthy()
  })
})

it('falls back to cached yearsOfService when dateJoined is null', async () => {
  mockGet.mockResolvedValue({
    userId: 'u1',
    dateJoined: null,
    yearsOfService: 4,
    totalStudents: 5,
    totalHymns: 3,
  })
  renderWithClient(<ServantJourneyCard />)
  await waitFor(() => {
    expect(screen.getByText('4')).toBeTruthy()
  })
})
```

Note: the first test now asserts exactly `6` (2020-01-15 to the fixed clock 2026-08-13 = 6 years), so it is deterministic. The unused `describe` import is removed and a trailing newline is present.

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/components/dashboard/__tests__/servant-journey-card.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 3: Run frontend typecheck**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/__tests__/servant-journey-card.test.tsx
git commit -m "test(frontend): deterministic journey card years test"
```

---

### Task 5: Frontend — End Class post-success coverage

**Files:**
- Test: `frontend/src/app/dashboard/__tests__/todays-session-card.test.tsx`

**Interfaces:**
- Consumes: existing `TodaysSessionCard` (unchanged) — `handleEndClass` calls `http.put('/attendance/sessions/:id', { status: 'completed' })`, shows a success toast, then `setSession(null)` + `setStudents([])` (dashboard-client.tsx:832-844).
- Produces: test coverage asserting the card resets to the "no active session" start state and fires the success toast. No component code change.

- [ ] **Step 1: Extend the test**

In `frontend/src/app/dashboard/__tests__/todays-session-card.test.tsx`, capture the toast mock and extend the existing test. Change line 11-14 (the toast mock) to expose the mock fn:

```tsx
const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))
```

And add `mockToast.mockReset()` to the `beforeEach` (lines 33-36):

```tsx
beforeEach(() => {
  mockGet.mockReset()
  mockPut.mockReset()
  mockToast.mockReset()
})
```

Then append assertions to the existing test (after the `mockPut` waitFor at line 57):

```tsx
  await waitFor(() => {
    expect(mockToast).toHaveBeenCalledWith('success', 'Class ended')
  })
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /end class/i })).toBeNull()
  })
  expect(screen.getByRole('button', { name: /start class/i })).toBeTruthy()
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/app/dashboard/__tests__/todays-session-card.test.tsx`
Expected: PASS. (If the "start class" button name in the empty state differs — check dashboard-client.tsx around line 859-880 and adjust the query to the actual rendered label.)

- [ ] **Step 3: Run frontend typecheck + full suite (regression only)**

Run: `npm run type-check` and `npm test`
Expected: type-check clean. 27 pre-existing failures unchanged (no new failures).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/__tests__/todays-session-card.test.tsx
git commit -m "test(frontend): End Class resets card state and fires toast"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (lazy `now` + negative tests) → Task 1. Section 2 (`||` kept; summary test) → Task 2. Section 3 (never-blank select, assigned hint, list refresh, tests) → Task 3. Section 4 (journey test cleanup) → Task 4. Section 5 (End Class coverage) → Task 5. No gaps.
- **Placeholder scan:** No TBD/TODO. All code blocks are complete. Task 5's Step 2 includes one conditional note about the empty-state button name (actual code verified: line 859 area renders a Start button; the implementer adjusts the query only if the label differs).
- **Type consistency:** `assignedGroupId`, `handleChangeSessionGroup`, `fetchSessionDetail`, `fetchSessions` names match the existing file (lines 243, 394, 183, 122). Backend test mock shapes match existing suites (prismaMock in attendance spec; `prisma.user.findMany` shape from servants spec). The lazy-`now` change preserves `updateSession`'s exact data contract.
- **No component regressions:** Tasks 1, 2, 4, 5 are test/refactor-only with zero behavior change; Task 3 changes only the group select block and adds one `fetchSessions()` call to an existing handler.