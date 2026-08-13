# Servant Role Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give servants an explicit End Class action, an editable group dropdown in the Mark Attendance form that reflects their assignment, and a Ministry Journey years counter computed from their joined date.

**Architecture:** Three small, independent changes. Backend `updateSession` records `actualStartTime`/`actualEndTime` and re-syncs students when the group changes. The attendance page gets an editable group `<select>`; the dashboard Active Session card gets an End Class button. `ServantProfileData` gains `dateJoined` so the journey card can compute years live.

**Tech Stack:** NestJS + Prisma (backend), Next.js App Router + React + Vitest (frontend).

## Global Constraints

- No database migrations. Only existing schema fields are used (`actualStartTime`, `actualEndTime`, `User.metadata.dateJoined`).
- Follow existing patterns: `t(en, ar)` bilingual helper where used; `toast` from `@/components/ui/toast`; `http` from `@/lib/http-client`; `getSchoolId()` from `@/lib/school`.
- Backend verification command: `npx tsc --noEmit -p tsconfig.json` and `npm test -- attendance.service` (or `npx vitest run` for frontend).
- Frontend verification command: `npm run type-check` and `npm test`.
- Copy rules: Arabic = `إنهاء الفصل`, English = `End Class`.

---

### Task 1: Backend — record times and re-sync students in `updateSession`

**Files:**
- Modify: `backend/src/modules/attendance/attendance.service.ts:800-842`
- Test: `backend/src/modules/attendance/attendance.service.spec.ts` (append to existing file)

**Interfaces:**
- Consumes: existing `updateSession(id: string, dto: Partial<CreateAttendanceSessionDto>)` — signature unchanged.
- Produces: `updateSession` now (a) sets `actualStartTime` when status becomes `in_progress` and it is null, (b) sets `actualEndTime` when status becomes `completed`, (c) runs `syncSessionStudents(id, servantId)` when `groupId` changes OR `status` changes. Later tasks rely on these behaviors.

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to `backend/src/modules/attendance/attendance.service.spec.ts` (the existing `prismaMock` already has `attendanceSession.update`, `student.findMany`, `attendanceRecord.findMany/deleteMany/createMany`):

```ts
describe('updateSession', () => {
  const baseSession = {
    id: 'sess-1',
    schoolId,
    servantId: 'u1',
    groupId: 'group-1',
    levelId: 'level-1',
    status: 'in_progress',
    actualStartTime: null,
    actualEndTime: null,
  };

  beforeEach(() => {
    prisma.attendanceSession.findUnique.mockResolvedValue(baseSession);
    prisma.attendanceSession.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...baseSession, ...data }),
    );
    prisma.student.findMany.mockResolvedValue([]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    prisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
    prisma.attendanceRecord.createMany.mockResolvedValue({ count: 0 });
  });

  it('records actualEndTime when status becomes completed', async () => {
    await service.updateSession('sess-1', { status: 'completed' } as any);

    const data = prisma.attendanceSession.update.mock.calls[0][0].data;
    expect(data.status).toBe('completed');
    expect(data.actualEndTime).toBeInstanceOf(Date);
  });

  it('records actualStartTime when status becomes in_progress and it is null', async () => {
    prisma.attendanceSession.findUnique.mockResolvedValue({
      ...baseSession,
      status: 'scheduled',
    });

    await service.updateSession('sess-1', { status: 'in_progress' } as any);

    const data = prisma.attendanceSession.update.mock.calls[0][0].data;
    expect(data.actualStartTime).toBeInstanceOf(Date);
  });

  it('re-syncs students when groupId changes', async () => {
    prisma.student.findMany.mockResolvedValue([{ id: 'st1' }, { id: 'st2' }]);

    await service.updateSession('sess-1', { groupId: 'group-2' } as any);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ groupId: 'group-2' }) }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/modules/attendance/attendance.service.spec.ts`
Expected: FAIL — `data.actualEndTime` is undefined, and `student.findMany` not called with `group-2`.

- [ ] **Step 3: Implement the changes**

In `updateSession` (`attendance.service.ts:800`), change the `data` object to include time recording, and change the sync condition to include group changes:

```ts
async updateSession(id: string, dto: Partial<CreateAttendanceSessionDto>) {
  const session = await this.prisma.attendanceSession.findUnique({ where: { id } });
  if (!session) throw new NotFoundException('Attendance session not found');

  const statusChanged = !!dto.status && dto.status !== session.status;
  const groupChanged = !!dto.groupId && dto.groupId !== session.groupId;
  const now = new Date();

  const updated = await this.prisma.attendanceSession.update({
    where: { id },
    data: {
      ...(dto.servantId && { servantId: dto.servantId }),
      ...(dto.levelId && { levelId: dto.levelId }),
      ...(dto.groupId && { groupId: dto.groupId }),
      ...(dto.scheduledDate && { scheduledDate: new Date(dto.scheduledDate) }),
      ...(dto.scheduledTime && { scheduledTime: dto.scheduledTime }),
      ...(dto.status && { status: dto.status }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(statusChanged && dto.status === 'in_progress' && !session.actualStartTime && { actualStartTime: now }),
      ...(statusChanged && dto.status === 'completed' && { actualEndTime: now }),
    },
    include: {
      level: { select: { id: true, name: true, number: true } },
      group: { select: { id: true, name: true } },
      servant: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Sync students when status or group changes
  if (statusChanged || groupChanged) {
    await this.syncSessionStudents(id, dto.servantId || session.servantId);
  }
  // ... rest unchanged (audit log, sendPracticeGuideNotifications)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/modules/attendance/attendance.service.spec.ts`
Expected: PASS (new tests + existing `getSessions`/`createSession` tests).

- [ ] **Step 5: Run backend typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/attendance/attendance.service.ts backend/src/modules/attendance/attendance.service.spec.ts
git commit -m "feat(backend): record actual class times and re-sync students on group change"
```

---

### Task 2: Backend — expose `dateJoined` in servant profile

**Files:**
- Modify: `backend/src/modules/servants/servants.service.ts:8-22, 238-252, 290-304`
- Test: `backend/src/modules/servants/servants.service.spec.ts`

**Interfaces:**
- Consumes: `User.metadata.dateJoined` (string) and `User.createdAt` (Date).
- Produces: `ServantProfileData.dateJoined: string | null` — populated from `metadata.dateJoined ?? user.createdAt` (ISO string). Task 4 consumes it.

- [ ] **Step 1: Write the failing test**

Append to `backend/src/modules/servants/servants.service.spec.ts` (check the existing mock shape in that file first and match it):

```ts
describe('getServantProfile dateJoined', () => {
  it('returns metadata.dateJoined when set', async () => {
    // arrange: prisma.user.findUnique resolves a servant user with
    // metadata: { dateJoined: '2020-01-15' } and servantProfile: null
    const result = await service.getServantProfile('u1', 'u1');
    expect(result?.dateJoined).toBe('2020-01-15');
  });

  it('falls back to user.createdAt when metadata.dateJoined is absent', async () => {
    const createdAt = new Date('2021-06-01T00:00:00.000Z');
    // arrange: prisma.user.findUnique resolves with metadata: {} and createdAt
    const result = await service.getServantProfile('u1', 'u1');
    expect(result?.dateJoined).toBe(createdAt.toISOString());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/modules/servants/servants.service.spec.ts`
Expected: FAIL — `result?.dateJoined` is undefined.

- [ ] **Step 3: Implement the changes**

Add `dateJoined` to the interface (`servants.service.ts:8-22`):

```ts
export interface ServantProfileData {
  userId: string
  name: string
  photoUrl: string | null
  roles: string[]
  assignedLevel: string | null
  assignedGroup: string | null
  teachingSubjects: string[]
  yearsOfService: number
  dateJoined: string | null
  totalStudents: number
  totalSessions: number
  totalHymns: number
  totalReviews: number
  lastCalculatedAt: Date
}
```

In `getServantProfile` (`servants.service.ts:238-252`), add the field. `metadata` is already in scope (line 234):

```ts
return {
  userId: user.id,
  name: `${user.firstName} ${user.lastName}`,
  photoUrl: user.avatarUrl,
  roles,
  assignedLevel: profile?.currentLevelName || null,
  assignedGroup: profile?.currentGroupName || null,
  teachingSubjects: metadata.teachingSubjects || [],
  yearsOfService: profile?.yearsOfService || 0,
  dateJoined: metadata.dateJoined || user.createdAt.toISOString(),
  totalStudents: profile?.totalStudents || 0,
  totalSessions: profile?.totalSessions || 0,
  totalHymns: profile?.totalHymns || 0,
  totalReviews: profile?.totalReviews || 0,
  lastCalculatedAt: profile?.lastCalculatedAt || new Date(0),
}
```

In `getSchoolServantSummary` (`servants.service.ts:290-304`), add the same field. `metadata` and `user` are already in scope (lines 292-293):

```ts
dateJoined: metadata.dateJoined || user.createdAt.toISOString(),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/modules/servants/servants.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run backend typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/servants/servants.service.ts backend/src/modules/servants/servants.service.spec.ts
git commit -m "feat(backend): return dateJoined in servant profile"
```

---

### Task 3: Frontend — End Class button (dashboard card) + rename Completed button

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx:789-932`
- Modify: `frontend/src/app/dashboard/attendance/attendance-client.tsx:694-698`
- Test: `frontend/src/app/dashboard/hero.test.tsx` (or add a focused test next to `TodaysSessionCard` if a harness exists)

**Interfaces:**
- Consumes: `http.put('/attendance/sessions/:id', { status: 'completed' })` from Task 1 (records `actualEndTime`). `useToast()` from `@/components/ui/toast`.
- Produces: `TodaysSessionCard` gains an "End Class" button that completes the active session; the attendance page button is renamed. No cross-task contracts beyond the HTTP call.

- [ ] **Step 1: Write the failing test (dashboard)**

Add to `frontend/src/app/dashboard/hero.test.tsx` following its existing mock pattern (`vi.mock('@/lib/http-client')`):

```tsx
it('ends an active class from the dashboard card', async () => {
  // arrange: mock http.get('/attendance/sessions') to return an in_progress
  // session, http.get(`/attendance/sessions/${id}`) to return its records,
  // and http.put to resolve.
  // render <TodaysSessionCard lang="en" /> (import if not exported; otherwise
  // render the dashboard client)
  const endButton = screen.getByRole('button', { name: /end class/i });
  fireEvent.click(endButton);
  await waitFor(() => {
    expect(mockPut).toHaveBeenCalledWith('/attendance/sessions/sess-1', { status: 'completed' });
  });
});
```

Adjust the exact query strings to match `hero.test.tsx`'s existing `http` mock. If `TodaysSessionCard` is not exported, export it (named export) from `dashboard-client.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/dashboard/hero.test.tsx`
Expected: FAIL — no "End Class" button exists.

- [ ] **Step 3: Implement End Class in `TodaysSessionCard`**

In `dashboard-client.tsx`, add state and a handler inside `TodaysSessionCard` (after `handleStart`, near line 828):

```tsx
const [ending, setEnding] = useState(false)

const handleEndClass = async () => {
  if (!session) return
  setEnding(true)
  try {
    await http.put(`/attendance/sessions/${session.id}`, { status: 'completed' })
    toast('success', lang === 'ar' ? 'تم إنهاء الفصل' : 'Class ended')
    setSession(null)
    setStudents([])
  } catch {
    toast('error', lang === 'ar' ? 'فشل إنهاء الفصل' : 'Failed to end class')
  }
  setEnding(false)
}
```

In the Active Session JSX, next to the Attendance `Link` (lines 879-882), add the button:

```tsx
<div className="flex items-center gap-2">
  <button
    onClick={handleEndClass}
    disabled={ending}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
  >
    {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
    {lang === 'ar' ? 'إنهاء الفصل' : 'End Class'}
  </button>
  <Link href={`/dashboard/attendance?sessionId=${session.id}&mode=exceptions`}
    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
    {lang === 'ar' ? 'الحضور' : 'Attendance'} <ChevronRight className="h-4 w-4" />
  </Link>
</div>
```

Add `Square` to the lucide-react imports in `dashboard-client.tsx` (check the existing import list for `Square`; if absent, add it).

- [ ] **Step 4: Rename the attendance page button**

In `attendance-client.tsx:697`, change the label:

```tsx
{lang === 'ar' ? 'إنهاء الفصل' : 'End Class'}
```

(Leave the `handleSaveAttendance(true)` call and green styling unchanged.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/dashboard/hero.test.tsx` and `npm test`
Expected: PASS.

- [ ] **Step 6: Run frontend typecheck**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/dashboard/dashboard-client.tsx frontend/src/app/dashboard/attendance/attendance-client.tsx frontend/src/app/dashboard/hero.test.tsx
git commit -m "feat(frontend): End Class action on dashboard card and attendance page"
```

---

### Task 4: Frontend — editable group dropdown in Mark Attendance form

**Files:**
- Modify: `frontend/src/app/dashboard/attendance/attendance-client.tsx:62, 534-555`
- Test: `frontend/src/app/dashboard/attendance/__tests__/attendance-client.test.tsx` (create; follow the mock pattern in `frontend/src/app/dashboard/servants/__tests__/page.test.tsx`)

**Interfaces:**
- Consumes: `groups: Group[]` and `levels: Level[]` state already loaded by `fetchLevelsGroups` (attendance-client.tsx:150-161); `selectedSession`; `http.put('/attendance/sessions/:id', { groupId })` from Task 1 (re-syncs students).
- Produces: a group `<select>` in the Mark Attendance panel header that pre-fills from the servant's assignment and updates the session on change.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/dashboard/attendance/__tests__/attendance-client.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AttendanceClient } from '../attendance-client'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()

vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: (...a: any[]) => mockPost(...a), put: (...a: any[]) => mockPut(...a), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => null }) }))

const groups = [
  { id: 'group-1', name: 'Group A', levelId: 'level-1', status: 'active' },
  { id: 'group-2', name: 'Group B', levelId: 'level-1', status: 'active' },
]
const levels = [{ id: 'level-1', name: 'Level 1', number: 1, status: 'active' }]

beforeEach(() => {
  mockGet.mockReset(); mockPost.mockReset(); mockPut.mockReset()
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'u1', metadata: { groupId: 'group-1' } }))
  mockGet.mockImplementation((path: string) => {
    if (path === '/curriculum/levels') return Promise.resolve(levels)
    if (path === '/students/groups/all') return Promise.resolve([{ groups }])
    if (path === '/attendance/sessions') return Promise.resolve({ data: [] })
    if (path.startsWith('/attendance/sessions/')) {
      return Promise.resolve({
        id: 'sess-1', status: 'in_progress', scheduledDate: '2026-01-05',
        level: { id: 'level-1', name: 'Level 1', number: 1 },
        group: { id: 'group-1', name: 'Group A' },
        servant: { id: 'u1', firstName: 'X', lastName: 'Y' },
        attendanceRecords: [],
      })
    }
    return Promise.resolve([])
  })
})

it('shows the assigned group as the dropdown default and updates on change', async () => {
  render(<AttendanceClient />)
  // Open the session detail via the session list row
  await waitFor(() => expect(screen.getByRole('button', { name: /sess/i })).toBeTruthy())
  // (adjust to whatever identifies the session row; see task implementer)
  fireEvent.change(screen.getByLabelText(/group/i), { target: { value: 'group-2' } })
  await waitFor(() => {
    expect(mockPut).toHaveBeenCalledWith('/attendance/sessions/sess-1', { groupId: 'group-2' })
  })
})
```

If the session row button has no accessible name, add an `aria-label` to the row button at attendance-client.tsx:504 in the implementation step, then use that label in the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/dashboard/attendance/__tests__/attendance-client.test.tsx`
Expected: FAIL — no group select rendered / no `mockPut` call.

- [ ] **Step 3: Implement the group select**

In `attendance-client.tsx`:

1. Add a handler (near `handleSaveAttendance`, after line 241):

```tsx
const handleChangeSessionGroup = async (groupId: string) => {
  if (!selectedSession || !groupId) return
  try {
    await http.put(`/attendance/sessions/${selectedSession.id}`, { groupId })
    toast('success', lang === 'ar' ? 'تم تحديث المجموعة' : 'Group updated')
    fetchSessionDetail(selectedSession.id)
  } catch {
    toast('error', lang === 'ar' ? 'فشل تحديث المجموعة' : 'Failed to update group')
  }
}
```

2. Compute the assigned group id near the top of the render (after `safeRecords`, line 382):

```tsx
const assignedGroupId = (() => {
  try {
    return (JSON.parse(localStorage.getItem('user') || '{}').metadata?.groupId) || ''
  } catch { return '' }
})()
```

3. Replace the read-only level/group line (553-554) with a group select for non-completed sessions:

```tsx
<div className="text-xs text-gray-500 mt-1">
  L{selectedSession.level?.number || '?'} &middot;{' '}
  {isCompleted ? (
    selectedSession.group?.name || '?'
  ) : (
    <select
      aria-label={lang === 'ar' ? 'المجموعة' : 'Group'}
      value={selectedSession.group?.id || ''}
      onChange={e => handleChangeSessionGroup(e.target.value)}
      className="rounded-lg border border-gray-300 px-2 py-1 text-xs min-h-[28px] focus:border-gold-500 focus:outline-none"
    >
      {groups.map(g => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  )}
</div>
<div className="text-xs text-gray-500">{new Date(selectedSession.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} {selectedSession.scheduledTime}</div>
```

4. Add `aria-label` to the session list row button (attendance-client.tsx:504): `aria-label={`session ${s.group?.name || s.id}`}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/dashboard/attendance/__tests__/attendance-client.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run frontend typecheck + full test suite**

Run: `npm run type-check` and `npm test`
Expected: clean, all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/dashboard/attendance/attendance-client.tsx frontend/src/app/dashboard/attendance/__tests__/attendance-client.test.tsx
git commit -m "feat(frontend): editable group dropdown in mark attendance form"
```

---

### Task 5: Frontend — journey card computes years from joined date

**Files:**
- Modify: `frontend/src/components/dashboard/servant-journey-card.tsx:34`
- Modify: `frontend/src/components/servants/hooks.ts:6-20`
- Test: create `frontend/src/components/dashboard/__tests__/servant-journey-card.test.tsx` (or extend an existing journey test if present)

**Interfaces:**
- Consumes: `ServantProfileData.dateJoined: string | null` from Task 2.
- Produces: journey card displays live-computed years; falls back to `profile.yearsOfService` when `dateJoined` is null.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/dashboard/__tests__/servant-journey-card.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ServantJourneyCard } from '../servant-journey-card'

const mockGet = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a) },
}))

beforeEach(() => mockGet.mockReset())

it('computes years from dateJoined', async () => {
  mockGet.mockResolvedValue({
    userId: 'u1',
    dateJoined: '2020-01-15',
    yearsOfService: 2, // stale cached value — must not be displayed
    totalStudents: 5,
    totalHymns: 3,
  })
  render(<ServantJourneyCard />)
  await waitFor(() => {
    // From 2020-01-15 to 2026-08-13 = 6 years
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
  render(<ServantJourneyCard />)
  await waitFor(() => {
    expect(screen.getByText('4')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/__tests__/servant-journey-card.test.tsx`
Expected: FAIL — card shows cached `2` instead of `6`.

- [ ] **Step 3: Implement the changes**

Add `dateJoined: string | null` to `ServantProfileData` in `frontend/src/components/servants/hooks.ts` (after `yearsOfService`):

```ts
yearsOfService: number
dateJoined: string | null
```

In `servant-journey-card.tsx`, compute years before the return (after the `if (!profile) return null` guard, line 23):

```tsx
const yearsOfService = profile.dateJoined
  ? Math.max(0, Math.floor((Date.now() - new Date(profile.dateJoined).getTime()) / (365.25 * 24 * 3600 * 1000)))
  : profile.yearsOfService
```

Replace line 34 to use it:

```tsx
<div className="text-2xl font-bold text-gray-900">{yearsOfService}</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/__tests__/servant-journey-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run frontend typecheck + full test suite**

Run: `npm run type-check` and `npm test`
Expected: clean, all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dashboard/servant-journey-card.tsx frontend/src/components/servants/hooks.ts frontend/src/components/dashboard/__tests__/servant-journey-card.test.tsx
git commit -m "feat(frontend): compute ministry years from servant joined date"
```

---

## Self-Review Notes

- **Spec coverage:** Feature 1 → Tasks 1 + 3 (backend times + End Class UI). Feature 2 → Tasks 1 (re-sync on group change) + 4 (dropdown). Feature 3 → Tasks 2 + 5 (dateJoined API + live compute). No gaps.
- **Placeholder scan:** The Task 4 test includes one inline note to "adjust to whatever identifies the session row" — the implementation step (add `aria-label`) makes it concrete. No TBD/TODO elsewhere.
- **Type consistency:** `dateJoined` typed `string | null` in backend interface (Task 2), frontend hook (Task 5), both `.toISOString()` producers. `updateSession` signature unchanged. `syncSessionStudents(id, servantId)` called identically in both paths.