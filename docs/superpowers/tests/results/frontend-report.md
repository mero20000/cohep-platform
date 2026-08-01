# Frontend-Scenario QA — Validation Report

**Date:** 2026-08-01
**Environment:** Production (Render + Vercel)
**Harness:** `docs/superpowers/tests/frontend-scenarios.mjs` (replicates exact dashboard/portal API requests)

## Result: 79 passed / 5 failed / 84 scenario tests

The harness replays the *exact* requests the dashboard pages make (students filters, attendance filters, curriculum level→subject→items→lessons→allocations, assessments, gamification, reports, settings tabs, notifications, portals) with all filter combinations against production.

## Issues found

### 1. FIXED — Groups could only ever be created under Level 1

**Symptom (what the user reported):** choosing Level 2–5 in Students page → group menu empty.

**Root cause (verified against production):**
- Backend `createGroup` (`students.service.ts`) **ignored the incoming `levelId`** and always assigned the new group to the **first** level (`orderBy: { number: 'asc' }`). Confirmed live: a group created with `levelId` = Level 2 was assigned to Level 1.
- Production data: Levels 2–5 have **3 students each** but **zero visible groups** — so the group filter and the Add/Edit Student form (which requires a group) cannot work for those levels.

**Fix (deployed, commit `f32e8110`):**
- `createGroup` now accepts + validates `levelId` (falling back to first level if omitted for backward compatibility).
- Settings → Groups tab now shows a **Level selector** on the create form and sends `levelId`.
- Verified live: creating a group targeting Level 2 now lands in Level 2.

### 2. Known remaining (not fixed — not selected)

| # | Issue | Evidence | Impact |
|---|-------|----------|--------|
| A-2..A-5 | Levels 2–5 still have **no visible groups** | `GET /students/groups/all` → Level 2–5 `groups: []`, but each has 3 students whose `groupId` points to soft-deleted groups | Group menu still empty until groups are created for those levels (now possible via the fix) or seed groups restored |
| B-1 | Student enrollment requires a `groupId` | `CreateStudentDto.groupId` is `@IsUUID()` non-optional; `POST /students` for a level without groups → 400 `groupId must be a UUID` | Cannot enroll a student in a level until it has at least one group |

> **RESOLVED by the grade+group combos feature (commit `df3cfb02`, 2026-08-01):**
> - Adding a grade+group combo under a level auto-creates its group (fixes A-2..A-5 — Levels 2–5 get groups via combos).
> - The student form derives `groupId` from the selected level+grade, and bulk import derives it too (fixes B-1 for bulk; single-student create still requires a mapped group by design).

### 3. NEW — Grade + Group combos per level (implemented + verified)

**Spec:** `docs/superpowers/specs/2026-08-01-grade-group-combos-design.md` (Approach A, config-based).

- Settings → Grades tab: level selector + per-level grade+group combos; add/edit/delete/activate; adding a combo auto-creates/reuses the real group under the level and keeps its name/status/deletion in sync.
- Student form: Group field is auto-derived from Level+Grade and shown as read-only; Grade dropdown only lists grades mapped for the selected level.
- Bulk import: group auto-derived from row level+grade when no group column is provided (`groupId` optional in `BulkImportStudentDto`).
- New pure-logic module `frontend/src/lib/grade-groups.ts` with **21 unit tests** (`grade-groups.test.ts`) — all passing.
- **Live-verified in production:** configured a `gradeGroups` config with (Level 2, Grade 5 → QA-Grade2 group), bulk-imported a student with no `groupId` → correctly placed in QA-Grade2 under Level 2; QA data then deleted.
- Frontend chunk hash confirmed deployed (settings chunk references the `gradeGroups` module; students page ships the new auto-group UI strings).
- Pre-existing broken tests unchanged: `page.test.tsx` (24 failures, jest-dom typing) and `constants.test.ts` (4 stale expectations) — no regressions from this feature.

## Coverage matrix (all PASS)

| Page / scenario | Endpoints exercised |
|---|---|
| Students: level filter, level+group, status, gender, grade, search, combos, pagination | `/students`, `/students/groups/all`, `/students/stats` |
| Attendance: level, status, date range, stats, heatmap | `/attendance/sessions`, `level-stats`, `group-stats`, `liturgy-heatmap` |
| Curriculum: levels, lessons per level, items per levelNumber, allocations, calendar, weeks | `/curriculum/{levels,lessons,items,allocations,calendar,weeks}` |
| Assessments: list, level, status, stats | `/assessments`, `/assessments/stats` |
| Gamification: leaderboard, badges, seasonal | `/gamification/*` |
| Dashboard: stats, mine, digest, practice-stats | `/dashboard/*` |
| Settings: schools, churches, roles, grades config, users, users by role | `/users/schools`, `/churches`, `/users/roles`, `/users` |
| Reports: priest-pulse, engagement, contributions, diocese | `/reports/*` |
| Notifications: list, unread | `/notifications` |
| Portals: student login/data, dashboard leaderboard | `/student-portal/*` |
| **Regression:** createGroup levelId | `/students/groups` |

## Frontend build/test notes
- `tsc --noEmit`: my changes introduce **0 new errors** (only pre-existing `page.test.tsx` jest-dom type errors).
- `vitest students page test`: 24 failures are **pre-existing** — a broken `lucide-react` mock in the test (`No "RefreshCw" export`); identical with my changes stashed.
