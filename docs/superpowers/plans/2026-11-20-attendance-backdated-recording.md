# Backdated Attendance Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let servants record a class after the day (up to 7 days back), surface missed classes, and label late entries.

**Architecture:** Extend `AttendanceService.startClass` with an optional `date`, add a `getMissedSessions` query, stamp `metadata.lateEntry`, and extend the "No session today" screen in `mark-client.tsx`. No migration.

**Tech Stack:** NestJS + Prisma + Jest (`backend/src/modules/attendance`), Next.js + Vitest/RTL (`frontend/src/app/dashboard/attendance`).

**Spec:** `docs/superpowers/specs/2026-11-20-attendance-backdated-recording-design.md`

## Global Constraints

- Window: `BACKFILL_WINDOW_DAYS = 7` (exported constant in `attendance.service.ts`); admin / super_admin / principal / level_leader are not capped.
- `date` format `YYYY-MM-DD`; future dates → `BadRequestException`; too old for a non-privileged caller → `ForbiddenException`.
- Backfilled `scheduledDate` = 12:00 local of that date; `scheduledTime` stays `'12:00'`.
- Late label key: `session.metadata.lateEntry = { daysLate: number, recordedAt: ISO string }`.
- All UI copy bilingual (`t(en, ar)` / `lang === 'ar'`), touch targets `min-h-[44px]`.

## Review Focus

- `date` equal to today behaves exactly like no `date` (no `lateEntry`).
- Two servants backfilling the same group and day land on one session.
- Student created after the backfilled day is not on that day's roster, and an already-marked record is never deleted by roster sync.
- A day that already has a non-cancelled class never appears under inferred "Missed".
- A malformed `date` (`2026-13-40`, `abc`) returns 400, not a 500.

---

### Task 1: `startClass` accepts a past date

**Files:**
- Modify: `backend/src/modules/attendance/attendance.service.ts` (`startClass`, ~1287-1445), `backend/src/modules/attendance/attendance.controller.ts:254-258`
- Test: `backend/src/modules/attendance/attendance.service.spec.ts` (extend `describe('startClass')`, line ~174)

**Interfaces:**
- Produces: `export const BACKFILL_WINDOW_DAYS = 7`; `startClass(servantId, selectedGroupId?, selectedLevelId?, selectedGradeId?, selectedGender?, date?: string)`; controller reads `@Query('date') date?: string`.
- Produces: private `resolveBackfillDate(date: string | undefined, roles: string[]): { dayStart: Date; dayEnd: Date; scheduledDate: Date; daysLate: number } | null` (null = today).

- [ ] **Step 1: Write failing tests** in the `startClass` describe: (a) `date` = yesterday creates a session with `scheduledDate` at 12:00 yesterday and `metadata.lateEntry.daysLate === 1`; (b) `date` = today creates no `lateEntry`; (c) `date` = tomorrow rejects `BadRequestException`; (d) `'2026-13-40'` rejects `BadRequestException`; (e) 8 days ago as a plain servant rejects `ForbiddenException`, as `level_leader` succeeds; (f) an existing non-cancelled session for that day is returned with `created: false`; (g) `student.findMany` is called with `createdAt: { lte: <end of that day> }` in `where`.
- [ ] **Step 2:** Run `cd backend && npx jest attendance.service.spec -t startClass` — expect the new tests FAIL.
- [ ] **Step 3: Implement.** `resolveBackfillDate` parses with a strict `^\d{4}-\d{2}-\d{2}$` + round-trip check, compares day starts, and checks roles via the `servantRoles` query already in `startClass`. Replace the `today`/`tomorrow` window in `existingWhere` with `dayStart`/`dayEnd`; use `scheduledDate` for `create`; add the `createdAt` filter to `studentWhere` only when backfilling; merge `lateEntry` into `sessionMeta` when `daysLate >= 1`. Thread `date` through the controller.
- [ ] **Step 4:** Re-run the command — expect PASS; then `npx jest attendance` — expect no regressions.
- [ ] **Step 5: Commit** `feat(attendance): start-class accepts a past date within the backfill window`.

### Task 2: Roster sync respects the session day; finalize stamps late entry

**Files:**
- Modify: `attendance.service.ts` (`syncSessionStudents` ~532, `finalizeSession` ~1047)
- Test: `attendance.service.spec.ts`

**Interfaces:**
- Consumes: `lateEntry` shape from Global Constraints.
- Produces: private `daysLateFor(scheduledDate: Date, now = new Date()): number` (whole local-calendar days, min 0), used by Tasks 1 and 2.

- [ ] **Step 1: Write failing tests:** (a) `syncSessionStudents` on a session dated 3 days ago queries students with `createdAt: { lte: end of that day }`, and on a today session adds no `createdAt` filter; (b) `finalizeSession` on a session dated 2 days ago updates `metadata` including `lateEntry.daysLate === 2` and keeps existing metadata keys (`genderFilter`); on a today session it does not touch `lateEntry`; (c) finalizing a session that already has `lateEntry` keeps the original `recordedAt`.
- [ ] **Step 2:** Run `npx jest attendance.service.spec -t "sync|finalize"` — expect FAIL.
- [ ] **Step 3: Implement** `daysLateFor`, refactor Task 1 to use it, apply the `createdAt` filter in `syncSessionStudents` when `scheduledDate` is before today's start (only unmarked rows are ever deleted there already), and write `metadata` inside the existing `finalizeSession` transaction's session update.
- [ ] **Step 4:** Run `npx jest attendance` — PASS.
- [ ] **Step 5: Commit** `feat(attendance): label late entries and keep past rosters accurate`.

### Task 3: `GET /attendance/missed`

**Files:**
- Modify: `attendance.service.ts`, `attendance.controller.ts` (add before `@Get('sessions/:id')`, line ~98, so the route isn't shadowed)
- Test: `attendance.service.spec.ts`

**Interfaces:**
- Produces: `getMissedSessions(user: { id: string }): Promise<MissedItem[]>` where `MissedItem = { kind: 'session'; sessionId: string; date: string; groupName: string; levelId?: string | null; groupId: string; status: string } | { kind: 'inferred'; date: string; groupId: string; groupName: string; levelId: string | null }`; `date` is `YYYY-MM-DD`.

- [ ] **Step 1: Write failing tests:** (a) unfinished past class sessions in the last 7 days come back as `kind: 'session'`; completed, cancelled, today's and older-than-7-day ones do not; (b) a weekday the servant taught in the last 8 weeks with no non-cancelled class for the group that day comes back as `kind: 'inferred'` with the servant's latest `groupId`/`levelId`; (c) a day that already has a class (any servant) is not inferred; (d) a servant with no history gets `[]`; (e) results sorted by date descending.
- [ ] **Step 2:** Run `npx jest attendance.service.spec -t getMissedSessions` — expect FAIL.
- [ ] **Step 3: Implement.** Scope (a) with the same group/level rule `getSessions` uses for servants (`resolveServantSessionGroupIds`, fallback `servantId`). Build the weekday set from the servant's own sessions in the last 56 days. Add controller route `@Get('missed')` returning `getMissedSessions(req.user)`.
- [ ] **Step 4:** Run `npx jest attendance` — PASS.
- [ ] **Step 5: Commit** `feat(attendance): missed-class lookup for servants`.

### Task 4: Mark page UI

**Files:**
- Modify: `frontend/src/app/dashboard/attendance/mark/mark-client.tsx` (`startClassManually` ~98, empty state ~285-315, header ~586-600, mark-all dialog ~856)
- Test: `frontend/src/app/dashboard/attendance/mark/__tests__/mark-client.test.tsx`

**Interfaces:**
- Consumes: `POST /attendance/start-class?date=YYYY-MM-DD`, `GET /attendance/missed` (Task 3), `session.metadata.lateEntry.daysLate`.
- Produces: `startClassManually(groupId?, levelId?, gradeId?, gender?, date?: string)`.

- [ ] **Step 1: Write failing tests** (follow the file's existing `http` mock style): (a) with no session, the empty state shows "Start Class", "Record a past class" and, from a mocked `/attendance/missed`, "Fri Nov 14 · Group A" with a "Record now" button; (b) "Record now" on a `kind: 'session'` item loads `/attendance/sessions/<id>`; on `kind: 'inferred'` it posts `/attendance/start-class?groupId=…&levelId=…&date=2026-11-14`; (c) the date input has `max` = yesterday and `min` = 7 days ago for a servant, no `min` for `level_leader`; (d) a session with `metadata.lateEntry.daysLate = 3` shows "Recorded 3 days late"; (e) Mark All → Present on a past-day session shows the extra warning text; on today's session it does not; (f) a failed `/attendance/missed` still renders Start Class.
- [ ] **Step 2:** Run `cd frontend && npx vitest run src/app/dashboard/attendance/mark` — expect FAIL.
- [ ] **Step 3: Implement.** Add the `date` param to `startClassManually` (appended to the query string); a "Record a past class" button revealing a `<input type="date">` then the existing group picker; fetch `/attendance/missed` once when `needsManualStart`; render the Missed list; header badge; warning line in the mark-all dialog when `isFutureDay`'s inverse (scheduled day before today) holds. Reuse `canMulti` for the unbounded date range.
- [ ] **Step 4:** Run `npx vitest run src/app/dashboard/attendance` and `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(attendance): record a past class and missed-class list on the mark page`.

---

## Self-review

- Spec coverage: start-class date + window (T1), roster + late label (T2), missed list (T3), UI + badge + mark-all warning (T4).
- Types: `lateEntry`, `daysLateFor`, `MissedItem`, `startClassManually(…, date)` consistent across tasks.
- Proportion: four tasks against a one-page spec.
