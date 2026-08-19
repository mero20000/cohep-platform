# Servant "My Class" At-a-Glance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a servant-facing `/dashboard/my-class` screen showing, in one view, who's likely absent, which students need follow-up, today's lesson, and each student's recent notes — powered by a new `GET /dashboard/class-overview` endpoint.

**Architecture:** A dedicated NestJS endpoint reuses a shared `resolveServantClass` helper (extracted from the existing `getServantDigest`) to derive the servant's groups/students, then deterministically computes the roster, likely-absent flags, follow-up reasons, today's lesson, and notes. A new Next.js dashboard route renders it.

**Tech Stack:** NestJS + Prisma (Postgres), React Query not required — the page uses `http.get` in `useEffect` like the existing notifications page. Vitest + @testing-library for frontend tests, Jest for backend specs.

## Global Constraints

- Bilingual copy: every user-visible string has `en`/`ar` pair, resolved via `useLanguage()` → `lang === 'ar' ? ar : en`.
- RTL-aware: layout must use Tailwind classes that mirror under `rtl` where needed; text stays neutral.
- Follow repo conventions: `'use client'`, `@/` path aliases, 2-space indent, single quotes, no comments unless necessary.
- Verification gate before push: `npx tsc --noEmit` + `npx vitest run` + `npx next build` (two ESLint rules are error-level on Vercel: `@next/next/no-img-element` and `@typescript-eslint/no-this-alias`).
- The two unrelated untracked files (`backend/prisma/upload-servants.ts`, `docs/superpowers/plans/2026-08-18-servant-module-enhancements.md`) must NOT be committed; stage files explicitly.
- No new DB tables/migrations required (servant→group is derived from `AttendanceSession`, not a relation).

---
## File Structure

- **Backend**
  - `backend/src/modules/dashboard/dashboard.service.ts` — modify: extract `resolveServantClass` helper (used by both `getServantDigest` and new `getClassOverview`); add `getClassOverview`.
  - `backend/src/modules/dashboard/dashboard.controller.ts` — modify: add `@Get('class-overview')`.
  - `backend/src/modules/dashboard/dashboard.service.spec.ts` — modify: extend prisma mock + add tests for helper and `getClassOverview`.
- **Frontend**
  - `frontend/src/components/dashboard-shell.tsx` — modify: add `My Class` nav item (gated by `attendance:record`).
  - `frontend/src/app/dashboard/my-class/page.tsx` — create: the screen.
  - `frontend/src/app/dashboard/my-class/__tests__/my-class.test.tsx` — create: page tests.

---

### Task 1: Backend shared helper `resolveServantClass`

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.service.ts` (add private method; refactor `getServantDigest` lines ~720-740 to call it)
- Test: `backend/src/modules/dashboard/dashboard.service.spec.ts`

**Interfaces:**
- Produces: `private async resolveServantClass(userId: string, schoolId: string): Promise<{ groupIds: string[]; levelIds: string[]; studentIds: string[] }>`

- [ ] **Step 1: Write the failing test** (append to `dashboard.service.spec.ts`)

```ts
describe('resolveServantClass', () => {
  it('derives groupIds, levelIds, and studentIds from sessions and students', async () => {
    prisma.attendanceSession.findMany.mockResolvedValue([
      { groupId: 'g1', levelId: 'l1' },
      { groupId: 'g1', levelId: 'l2' },
      { groupId: null, levelId: null },
    ]);
    prisma.student.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

    const result = await (service as any).resolveServantClass('user-1', schoolId);

    expect(result.groupIds).toEqual(['g1']);
    expect(result.levelIds).toEqual(['l1', 'l2']);
    expect(result.studentIds).toEqual(['s1', 's2']);
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ groupId: { in: ['g1'] } }) })
    );
  });

  it('returns empty studentIds when the servant has no groups', async () => {
    prisma.attendanceSession.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([]);
    const result = await (service as any).resolveServantClass('user-1', schoolId);
    expect(result.studentIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest dashboard.service.spec.ts -t "resolveServantClass"`
Expected: FAIL — `service.resolveServantClass is not a function`

- [ ] **Step 3: Implement the helper and refactor the digest**

Add this method to `DashboardService` (place it just above `getServantDigest`):

```ts
private async resolveServantClass(userId: string, schoolId: string) {
  const ownSessions = await this.prisma.attendanceSession.findMany({
    where: { schoolId, servantId: userId },
    select: { groupId: true, levelId: true },
  });
  const groupIds = [...new Set(ownSessions.map((s: any) => s.groupId).filter(Boolean))] as string[];
  const levelIds = [...new Set(ownSessions.map((s: any) => s.levelId).filter(Boolean))] as string[];
  const studentIds = groupIds.length > 0
    ? (await this.prisma.student.findMany({
        where: { groupId: { in: groupIds }, deletedAt: null },
        select: { id: true },
      })).map((s: any) => s.id)
    : [];
  return { groupIds, levelIds, studentIds };
}
```

Then replace the inline derivation block in `getServantDigest` (currently the `ownSessions` + `groupIds` + `levelIds` + `studentIds` lines) with:

```ts
const { groupIds, levelIds, studentIds } = await this.resolveServantClass(user.id, schoolId);
```

The rest of `getServantDigest` is unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest dashboard.service.spec.ts -t "resolveServantClass"`
Expected: PASS (existing digest tests must still pass — run `npx jest dashboard.service.spec.ts` and confirm no regression)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/dashboard/dashboard.service.ts backend/src/modules/dashboard/dashboard.service.spec.ts
git commit -m "refactor(dashboard): extract resolveServantClass shared helper"
```

---

### Task 2: Backend `getClassOverview` + `GET /dashboard/class-overview`

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.service.ts`
- Modify: `backend/src/modules/dashboard/dashboard.controller.ts`

**Interfaces:**
- Consumes: `resolveServantClass(userId, schoolId)` → `{ groupIds, levelIds, studentIds }`
- Produces:
  - `async getClassOverview(user: { id: string; firstName?: string; lastName?: string }, schoolIdentifier: string): Promise<any>`
  - Response shape:
```ts
{
  servant: { id, firstName?, lastName? },
  nextSession: { id, scheduledDate, levelId, levelName?, levelNumber?, groupId, groupName? } | null,
  todayLesson: { lessonId, title, titleAr?, titleCoptic?, levelId, levelName, levelNumber, subjectName, scheduledDate } | null,
  roster: [{
    studentId, firstName, lastName, firstNameAr?, lastNameAr?, photoUrl?,
    attendanceRate, lastAttendanceStatus, likelyAbsent, needsFollowUp,
    followUpReasons: string[], notes: [{ category?, note?, isPrivate, createdAt }],
  }],
}
```
- Follow-up reason tokens: `overdue_review`, `low_mastery`, `absent_3plus`, `ungraded_assessment`.

- [ ] **Step 1: Add the controller endpoint**

In `dashboard.controller.ts`, add after `getServantDigest`:

```ts
@Get('class-overview')
@Roles(...STAFF_ROLES)
@ApiOperation({ summary: 'Get servant class at-a-glance — roster, likely absent, follow-up, today lesson' })
async getClassOverview(
  @CurrentUser() user: any,
  @Query('schoolId') schoolId: string = '',
) {
  return this.service.getClassOverview(user, schoolId);
}
```

- [ ] **Step 2: Implement `getClassOverview`**

Add to `DashboardService` (after `getServantDigest`):

```ts
async getClassOverview(user: any, schoolIdentifier: string) {
  const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
  const { groupIds, levelIds, studentIds } = await this.resolveServantClass(user.id, schoolId);

  const nextSession = await this.prisma.attendanceSession.findFirst({
    where: { schoolId, servantId: user.id, status: 'scheduled', scheduledDate: { gte: new Date() } },
    orderBy: { scheduledDate: 'asc' },
    include: {
      level: { select: { id: true, name: true, number: true } },
      group: { select: { id: true, name: true } },
    },
  });

  let todayLesson: any = null;
  if (levelIds.length > 0) {
    const alloc = await this.prisma.curriculumAllocation.findFirst({
      where: {
        academicYear: { schoolId },
        levelId: { in: levelIds },
        scheduledDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      orderBy: { scheduledDate: 'asc' },
      include: {
        lesson: { select: { id: true, title: true, titleAr: true, titleCoptic: true } },
        level: { select: { id: true, name: true, number: true } },
        subject: { select: { name: true } },
      },
    });
    if (alloc) {
      todayLesson = {
        lessonId: alloc.lessonId,
        title: alloc.lesson.title,
        titleAr: alloc.lesson.titleAr,
        titleCoptic: alloc.lesson.titleCoptic,
        levelId: alloc.levelId,
        levelName: alloc.level.name,
        levelNumber: alloc.level.number,
        subjectName: alloc.subject.name,
        scheduledDate: alloc.scheduledDate,
      };
    }
  }

  const roster: any[] = [];
  if (studentIds.length > 0) {
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true, photoUrl: true,
      },
    });

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { recordedAt: 'desc' },
      select: {
        studentId: true, status: true, recordedAt: true,
        note: true, noteCategory: true, isPrivateNote: true,
      },
    });

    let progressByStudent: Record<string, any> = {};
    if (todayLesson) {
      const progresses = await this.prisma.lessonProgress.findMany({
        where: { lessonId: todayLesson.lessonId, studentId: { in: studentIds } },
        select: { studentId: true, masteryStatus: true },
      });
      progressByStudent = Object.fromEntries(progresses.map(p => [p.studentId, p]));
    }

    const overdueIds = new Set(
      (await this.prisma.lessonProgress.findMany({
        where: { studentId: { in: studentIds }, nextReviewAt: { lt: new Date() } },
        select: { studentId: true },
      })).map(p => p.studentId),
    );

    const ungradedIds = new Set(
      (await this.prisma.assessmentSubmission.findMany({
        where: { studentId: { in: studentIds }, grades: { none: {} } },
        select: { studentId: true },
      })).map(s => s.studentId),
    );

    const nextWeekday = nextSession ? new Date(nextSession.scheduledDate).getDay() : null;

    for (const student of students) {
      const sr = records.filter(r => r.studentId === student.id);
      const presentCount = sr.filter(r => r.status === 'present' || r.status === 'late').length;
      const attendanceRate = sr.length ? Math.round(presentCount / sr.length * 100) : 0;
      const lastStatus = sr[0]?.status ?? null;

      const lastTwo = sr.slice(0, 2);
      const lastTwoAbsent = lastTwo.length >= 2 && lastTwo.every(r => r.status === 'absent');
      const historicallyAbsentOnWeekday = nextWeekday !== null
        && sr.filter(r => r.status === 'absent' && new Date(r.recordedAt).getDay() === nextWeekday).length >= 2;
      const likelyAbsent = attendanceRate < 60 || lastTwoAbsent || historicallyAbsentOnWeekday;

      const reasons: string[] = [];
      if (overdueIds.has(student.id)) reasons.push('overdue_review');
      if (todayLesson) {
        const p = progressByStudent[student.id];
        if (p && (p.masteryStatus === 'not_started' || p.masteryStatus === 'introduced')) reasons.push('low_mastery');
      }
      if (sr.length >= 3 && sr.slice(0, 3).every(r => r.status === 'absent')) reasons.push('absent_3plus');
      if (ungradedIds.has(student.id)) reasons.push('ungraded_assessment');

      const notes = sr
        .filter(r => r.note)
        .slice(0, 5)
        .map(r => ({ category: r.noteCategory, note: r.note, isPrivate: r.isPrivateNote, createdAt: r.recordedAt }));

      roster.push({
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameAr: student.firstNameAr,
        lastNameAr: student.lastNameAr,
        photoUrl: student.photoUrl,
        attendanceRate,
        lastAttendanceStatus: lastStatus,
        likelyAbsent,
        needsFollowUp: reasons.length > 0,
        followUpReasons: reasons,
        notes,
      });
    }

    roster.sort((a, b) => {
      const aFlag = a.likelyAbsent || a.needsFollowUp ? 0 : 1;
      const bFlag = b.likelyAbsent || b.needsFollowUp ? 0 : 1;
      if (aFlag !== bFlag) return aFlag - bFlag;
      return (a.lastName || '').localeCompare(b.lastName || '');
    });
  }

  return {
    servant: { id: user.id, firstName: user.firstName, lastName: user.lastName },
    nextSession: nextSession ? {
      id: nextSession.id,
      scheduledDate: nextSession.scheduledDate,
      levelId: nextSession.levelId,
      levelName: nextSession.level?.name,
      levelNumber: nextSession.level?.number,
      groupId: nextSession.groupId,
      groupName: nextSession.group?.name,
    } : null,
    todayLesson,
    roster,
  };
}
```

- [ ] **Step 3: Write backend tests for `getClassOverview`**

Extend the prisma mock in `dashboard.service.spec.ts` (add to `prismaMock`):

```ts
curriculumAllocation: { findFirst: jest.fn() },
lessonProgress: { findMany: jest.fn() },
assessmentSubmission: { findMany: jest.fn() },
```

Append tests:

```ts
describe('getClassOverview', () => {
  function baseline() {
    (prisma.attendanceSession.findMany as jest.Mock).mockResolvedValue([{ groupId: 'g1', levelId: 'l1' }]);
    (prisma.student.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', firstName: 'Mina', lastName: 'A', firstNameAr: null, lastNameAr: null, photoUrl: null },
      { id: 's2', firstName: 'John', lastName: 'B', firstNameAr: null, lastNameAr: null, photoUrl: null },
    ]);
    (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'), levelId: 'l1',
      level: { id: 'l1', name: 'Level 3', number: 3 }, group: { id: 'g1', name: 'Group A' },
    });
    (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue({
      lessonId: 'les1', scheduledDate: new Date(),
      lesson: { id: 'les1', title: 'Kyrie', titleAr: null, titleCoptic: 'ⲕⲩⲣⲓⲉ' },
      level: { id: 'l1', name: 'Level 3', number: 3 },
      subject: { name: 'Tasbeha' },
    });
    (prisma.attendanceRecord.findMany as jest.Mock).mockResolvedValue([
      { studentId: 's1', status: 'present', recordedAt: new Date(), note: null, noteCategory: null, isPrivateNote: false },
      { studentId: 's2', status: 'present', recordedAt: new Date(), note: null, noteCategory: null, isPrivateNote: false },
    ]);
    (prisma.lessonProgress.findMany as jest.Mock)
      .mockResolvedValueOnce([{ studentId: 's1', masteryStatus: 'known' }]) // for today lesson
      .mockResolvedValue([]); // overdue review scan
    (prisma.assessmentSubmission.findMany as jest.Mock).mockResolvedValue([]);
  }

  it('returns roster with today lesson and null flags when attendance is strong', async () => {
    baseline();
    const result = await service.getClassOverview(user, schoolId);
    expect(result.todayLesson.title).toBe('Kyrie');
    expect(result.nextSession.groupName).toBe('Group A');
    expect(result.roster).toHaveLength(2);
    expect(result.roster.every((r: any) => r.likelyAbsent === false)).toBe(true);
    expect(result.roster.every((r: any) => r.needsFollowUp === false)).toBe(true);
  });

  it('flags likelyAbsent when attendance rate is below 60%', async () => {
    baseline();
    (prisma.attendanceRecord.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        studentId: 's1', status: i % 2 === 0 ? 'absent' : 'present',
        recordedAt: new Date(), note: null, noteCategory: null, isPrivateNote: false,
      })),
    );
    const result = await service.getClassOverview(user, schoolId);
    const mina = result.roster.find((r: any) => r.studentId === 's1');
    expect(mina.likelyAbsent).toBe(true);
  });

  it('collects follow-up reason tokens', async () => {
    baseline();
    (prisma.lessonProgress.findMany as jest.Mock)
      .mockResolvedValueOnce([{ studentId: 's1', masteryStatus: 'not_started' }]) // low mastery
      .mockResolvedValue([{ studentId: 's1' }]); // overdue review
    (prisma.assessmentSubmission.findMany as jest.Mock).mockResolvedValue([{ studentId: 's1' }]); // ungraded
    const result = await service.getClassOverview(user, schoolId);
    const mina = result.roster.find((r: any) => r.studentId === 's1');
    expect(mina.followUpReasons).toEqual(expect.arrayContaining(['low_mastery', 'overdue_review', 'ungraded_assessment']));
    expect(mina.needsFollowUp).toBe(true);
  });

  it('returns empty roster and null today lesson when servant has no students', async () => {
    (prisma.attendanceSession.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
    const result = await service.getClassOverview(user, schoolId);
    expect(result.roster).toEqual([]);
    expect(result.todayLesson).toBeNull();
    expect(result.nextSession).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify**

Run: `cd backend && npx jest dashboard.service.spec.ts`
Expected: PASS (new tests + existing digest tests). If `getMine` tests break from the mock change, add the missing mock keys to `mockMinistryBaseline` but do not change assertions.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/dashboard/dashboard.service.ts backend/src/modules/dashboard/dashboard.controller.ts backend/src/modules/dashboard/dashboard.service.spec.ts
git commit -m "feat(dashboard): servant class-overview endpoint with roster and follow-up"
```

---

### Task 3: Frontend nav item

**Files:**
- Modify: `frontend/src/components/dashboard-shell.tsx`

**Interfaces:**
- Produces: nav entry visible to roles holding `attendance:record`.

- [ ] **Step 1: Add the `School` icon import**

In the lucide import block (lines 6-10), append `School`:

```ts
Crown, Shield, GraduationCap, Layers, Heart, Church, Mail,
Headphones, School,
```

- [ ] **Step 2: Add the nav item**

After the `Hymn Review` item in `navigation` (line ~40):

```ts
{ name: 'My Class', nameAr: 'صفي', href: '/dashboard/my-class', icon: School, perm: 'attendance:record' as const },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard-shell.tsx
git commit -m "feat(dashboard): add My Class nav item gated by attendance:record"
```

---

### Task 4: Frontend `/dashboard/my-class` page

**Files:**
- Create: `frontend/src/app/dashboard/my-class/page.tsx`
- Create: `frontend/src/app/dashboard/my-class/__tests__/my-class.test.tsx`

**Interfaces:**
- Consumes: `GET /dashboard/class-overview` via `http.get` (returns the Task 2 response shape).
- Renders: header + next session, today's lesson card, roster grouped flagged-first with notes expansion.

- [ ] **Step 1: Write the failing frontend test**

`frontend/src/app/dashboard/my-class/__tests__/my-class.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from '@testing-library/react'
import MyClassPage from '../page'

const mockGet = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard/my-class',
}))

jest.mock('@/lib/http-client', () => ({
  http: { get: (...args: any[]) => mockGet(...args) },
}))

jest.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

jest.mock('@/lib/asset-url', () => ({ assetUrl: (u?: string | null) => u ?? '' }))

describe('MyClassPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockGet.mockReset()
  })

  it('shows an empty state when there is no class data', async () => {
    mockGet.mockResolvedValue({
      servant: { id: 'u1' },
      nextSession: null,
      todayLesson: null,
      roster: [],
    })
    render(<MyClassPage />)
    expect(await screen.findByText('No class yet')).toBeInTheDocument()
  })

  it('renders today lesson and roster with follow-up badges', async () => {
    mockGet.mockResolvedValue({
      servant: { id: 'u1', firstName: 'S', lastName: 'T' },
      nextSession: { id: 'n1', scheduledDate: new Date().toISOString(), levelName: 'Level 3', groupName: 'Group A' },
      todayLesson: { lessonId: 'l1', title: 'Kyrie Eleison', titleCoptic: 'ⲕⲩⲣⲓⲉ', levelName: 'Level 3', subjectName: 'Tasbeha', scheduledDate: new Date().toISOString() },
      roster: [
        { studentId: 's1', firstName: 'Mina', lastName: 'A', attendanceRate: 80, lastAttendanceStatus: 'present', likelyAbsent: false, needsFollowUp: true, followUpReasons: ['overdue_review'], notes: [] },
        { studentId: 's2', firstName: 'John', lastName: 'B', attendanceRate: 40, lastAttendanceStatus: 'absent', likelyAbsent: true, needsFollowUp: true, followUpReasons: ['absent_3plus'], notes: [{ note: 'Seems tired', isPrivate: true, createdAt: new Date().toISOString() }] },
      ],
    })
    render(<MyClassPage />)

    expect(await screen.findByText('Kyrie Eleison')).toBeInTheDocument()
    expect(screen.getByText('Mina A')).toBeInTheDocument()
    expect(screen.getByText('John B')).toBeInTheDocument()
    // follow-up chip and likely-absent badge visible
    expect(screen.getByText('Follow up')).toBeInTheDocument()
    expect(screen.getByText('Likely absent')).toBeInTheDocument()
  })

  it('expands a student row to show notes', async () => {
    mockGet.mockResolvedValue({
      servant: { id: 'u1' },
      nextSession: null,
      todayLesson: null,
      roster: [
        { studentId: 's2', firstName: 'John', lastName: 'B', attendanceRate: 40, lastAttendanceStatus: 'absent', likelyAbsent: true, needsFollowUp: false, followUpReasons: [], notes: [{ note: 'Seems tired', isPrivate: true, createdAt: new Date().toISOString() }] },
      ],
    })
    render(<MyClassPage />)
    const row = await screen.findByText('John B')
    fireEvent.click(row)
    expect(screen.getByText('Seems tired')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run my-class`
Expected: FAIL — page module not found (file doesn't exist yet)

- [ ] **Step 3: Implement the page**

`frontend/src/app/dashboard/my-class/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Clock, AlertTriangle, Mic, BookOpen, User, CalendarDays } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { assetUrl } from '@/lib/asset-url'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface Note { category?: string; note?: string; isPrivate: boolean; createdAt: string }
interface RosterStudent {
  studentId: string
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  photoUrl?: string
  attendanceRate: number
  lastAttendanceStatus: string | null
  likelyAbsent: boolean
  needsFollowUp: boolean
  followUpReasons: string[]
  notes: Note[]
}
interface ClassOverview {
  servant: { id: string; firstName?: string; lastName?: string }
  nextSession: {
    id: string; scheduledDate: string; levelId?: string; levelName?: string; levelNumber?: number; groupId?: string; groupName?: string
  } | null
  todayLesson: {
    lessonId: string; title: string; titleAr?: string; titleCoptic?: string; levelName?: string; subjectName?: string; scheduledDate?: string
  } | null
  roster: RosterStudent[]
}

const REASON_LABEL: Record<string, { en: string; ar: string }> = {
  overdue_review: { en: 'Review due', ar: 'مراجعة مستحقة' },
  low_mastery: { en: 'New lesson', ar: 'درس جديد' },
  absent_3plus: { en: 'Missed 3+', ar: 'تغيب 3+' },
  ungraded_assessment: { en: 'To grade', ar: 'بانتظار التقييم' },
}

const STATUS_BADGE: Record<string, { en: string; ar: string; cls: string }> = {
  present: { en: 'Present', ar: 'حاضر', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  late: { en: 'Late', ar: 'متأخر', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  absent: { en: 'Absent', ar: 'غائب', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export default function MyClassPage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [data, setData] = useState<ClassOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [openStudent, setOpenStudent] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    http.get<ClassOverview>('/dashboard/class-overview')
      .then((res) => { if (mounted) setData(res) })
      .catch(() => { if (mounted) setData({ servant: { id: '' }, nextSession: null, todayLesson: null, roster: [] }) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const flagged = (data?.roster ?? []).filter(s => s.likelyAbsent || s.needsFollowUp)
  const settled = (data?.roster ?? []).filter(s => !(s.likelyAbsent || s.needsFollowUp))

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6"><div className="h-6 w-40 bg-gray-200 rounded animate-pulse" /></div>
        <TableSkeleton rows={5} cols={3} />
      </div>
    )
  }

  if (!data || (data.roster.length === 0 && !data.todayLesson)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('My Class', 'صفي')}</h1>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white">
          <EmptyState title={t('No class yet', 'لا توجد فصول بعد')} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('My Class', 'صفي')}</h1>
          {data.nextSession && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
              <CalendarDays className="h-4 w-4" />
              {data.nextSession.groupName} · {data.nextSession.levelName} ·{' '}
              {new Date(data.nextSession.scheduledDate).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400">{data.roster.length} {t('students', 'طالب')}</span>
      </div>

      {data.todayLesson && (
        <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-700">
            <BookOpen className="h-4 w-4" />
            {t("Today's lesson", 'درس اليوم')}
          </div>
          <h2 className="mt-2 text-lg font-bold text-gray-900">{lang === 'ar' ? data.todayLesson.titleAr || data.todayLesson.title : data.todayLesson.title}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {data.todayLesson.titleCoptic && <span className="coptic">{data.todayLesson.titleCoptic} · </span>}
            {data.todayLesson.subjectName} · {data.todayLesson.levelName}
          </p>
        </div>
      )}

      {flagged.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t('Needs attention', 'بحاجة لانتباه')}
          </h3>
          <div className="space-y-2">{flagged.map(s => renderRow(s))}</div>
        </div>
      )}

      {settled.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('Class', 'الفصل')}</h3>
          <div className="space-y-2">{settled.map(s => renderRow(s))}</div>
        </div>
      )}
    </div>
  )

  function renderRow(s: RosterStudent) {
    const open = openStudent === s.studentId
    return (
      <div key={s.studentId} className={`rounded-xl border bg-white ${s.likelyAbsent || s.needsFollowUp ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'}`}>
        <button
          type="button"
          onClick={() => setOpenStudent(open ? null : s.studentId)}
          className="flex w-full items-center gap-3 p-3 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-500">
            {s.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(s.photoUrl)} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900">
              {lang === 'ar' ? `${s.firstNameAr || s.firstName} ${s.lastNameAr || s.lastName}` : `${s.firstName} ${s.lastName}`}
            </div>
            <div className="mt-1 h-1.5 w-32 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.attendanceRate}%` }} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {s.lastAttendanceStatus && (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[s.lastAttendanceStatus]?.cls ?? 'border-gray-200 text-gray-600'}`}>
                {STATUS_BADGE[s.lastAttendanceStatus] ? (lang === 'ar' ? STATUS_BADGE[s.lastAttendanceStatus].ar : STATUS_BADGE[s.lastAttendanceStatus].en) : s.lastAttendanceStatus}
              </span>
            )}
            {s.likelyAbsent && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">{t('Likely absent', 'غائب غالباً')}</span>
            )}
            {s.needsFollowUp && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">{t('Follow up', 'متابعة')}</span>
            )}
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {open && (
          <div className="border-t border-gray-100 px-3 py-3">
            <div className="flex flex-wrap gap-1.5">
              {s.followUpReasons.map(r => (
                <span key={r} className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {REASON_LABEL[r] ? (lang === 'ar' ? REASON_LABEL[r].ar : REASON_LABEL[r].en) : r}
                </span>
              ))}
            </div>
            {s.notes.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {s.notes.map((n, i) => (
                  <li key={i} className={`rounded-lg p-2 text-sm ${n.isPrivate ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'text-gray-600'}`}>
                    {n.note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-gray-400">{t('No notes.', 'لا توجد ملاحظات.')}</p>
            )}
          </div>
        )}
      </div>
    )
  }
}
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `cd frontend && npx vitest run my-class`
Expected: PASS

- [ ] **Step 5: Typecheck + full frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS. Then `npx next build` — Expected: Compiles, 33/34 static pages.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/dashboard/my-class/page.tsx frontend/src/app/dashboard/my-class/__tests__/my-class.test.tsx
git commit -m "feat(dashboard): my-class at-a-glance screen with roster and today lesson"
```

---

### Task 5: Final verification and push

**Files:**
- N/A (verification)

- [ ] **Step 1: Run backend specs**

Run: `cd backend && npx jest dashboard.service.spec.ts`
Expected: PASS

- [ ] **Step 2: Run full frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx vitest run && npx next build`
Expected: all pass, build 33/34 pages (includes `/dashboard/my-class`)

- [ ] **Step 3: Push (stage explicitly; do not commit the two untracked unrelated files)**

```bash
cd /Users/amir.adly/cohep-platform && git pull --rebase --autostash
git push origin main
```

---

## Self-Review

- **Spec coverage:** shared helper (Task 1) ✓; class-overview endpoint + response shape (Task 2) ✓; likely-absent rule (Task 2) ✓; follow-up reasons tokens (Task 2) ✓; roster ordering flagged-first (Task 2) ✓; today lesson + empty states (Task 2/4) ✓; frontend route + nav gate (Task 3/4) ✓; frontend tests (Task 4) ✓; out-of-scope items (AI, community) correctly omitted ✓.
- **Type consistency:** `resolveServantClass` return shape consistent across Task 1/2; `getClassOverview` response shape matches Task 2 def and Task 4 interface; reason tokens match between Task 2 (`low_mastery`, `overdue_review`, `absent_3plus`, `ungraded_assessment`) and Task 4 `REASON_LABEL`.
- **Placeholder scan:** all steps include concrete code; no TBD/TODO.