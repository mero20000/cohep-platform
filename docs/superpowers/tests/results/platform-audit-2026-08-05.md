# niangelos-platform — Full Platform Audit (2026-08-05)

Audit method: read-only source deep-dives across all domains (auth/users/settings, students CRUD, curriculum/practice/progress, attendance/assessments/reports, gamification/announcements/portals, backend API/data integrity) + live prod smoke tests.
Severity: **Critical** = data loss/corruption/crash/security · **High** = wrong data silently shown/mutated · **Medium** = broken edge behavior · **Low** = cosmetic/perf/UX.

---

## 🚨 CRITICAL

### C1. Announcements feature is entirely non-functional server-side (no CRUD)
- Only endpoint exists: `POST /announcements/draft` (AI draft). `backend/src/modules/announcements/announcements.controller.ts:13-18`.
- Frontend calls `GET /announcements`, `POST /announcements`, `PUT /announcements/:id`, `PATCH /announcements/:id/publish`, `DELETE /announcements/:id` (`page.tsx:35,57,65`; `announcement-form-modal.tsx:64-66`).
- **Live-verified:** `GET /announcements` → 404, `POST /announcements` → 404.
- Fallback silently persists to `localStorage` (`announcement-store.ts`, `announcement-form-modal.tsx:68-74`) and **toasts "Announcement created"** even though nothing is saved server-side. Data is per-browser, lost across devices, invisible to parents/students (their banner fetch 404s silently). The `Announcement` Prisma model has no backend handler.
- Fix options: (a) add full CRUD + publish + expiry-respect + list endpoints and remove localStorage fallback, or (b) hide/disable the feature + tell the user it's unshipped.

### C2. Parent practice flow always returns "No active lesson" (status mismatch)
- `parents.service.ts:497-504` queries allocations with `scheduledDate <= now` AND `status: 'active'` (also `term`), but allocations are always created with **`draft`** (`calendar-view.tsx:201,348`) or **`published`** (`calendar-view.tsx:235`, `lesson-modal.tsx:26`); backend default is `draft` (`curriculum.service.ts:329`).
- Nothing ever writes `'active'`. ⇒ `getCurrentLesson` always returns `null` → parent practice-guide dead.
- Fix: use a canonical status (accept `in: ['active','published']`, or set allocations to `active` when marked allocated) and remove date/term dependence that makes it brittle.

### C3. Student portal is unauthenticated and student codes are sequentially enumerable
- `student-portal.controller.ts:7-21` has **no `@UseGuards` / `@Public` / role guard** — only a global `JwtAuthGuard` (via `APP_GUARD`, `app.module.ts:76`) is inherited, but `login` and `GET :studentCode` accept just a student code with no auth.
- Codes are `STU-00001…` sequential (`students.service.ts:664-682`). Anyone can enumerate codes and read portal data (profile, progress, lessons) for arbitrary students.
- Fix: require parent/student authentication; do not return sensitive data from a bare-code lookup.

---

## 🔴 HIGH

### H1. Students CSV export silently truncates to 100 rows
- Frontend requests `limit=pagination.total||2000` (`students-client.tsx:148`) but backend clamps `limit = Math.min(rawLimit,100)` (`students.service.ts:21`). Schools with >100 students export only first 100.
- Fix: stream/multi-page export server-side (respect true cap) + UTF-8 BOM for Arabic Excel + guard CSV formula injection.

### H2. `generateStudentCode` infinite recursion → stack-overflow 500 whenever a code gap exists
- `students.service.ts:664-682` recurses with same `count` when candidate `STU-(count+1)` already exists (gaps from hard-deleted rows, migrations, hand-edited codes). Unbounded recursion → `RangeError: Maximum call stack size exceeded`.
- Also no serialization: two concurrent creates both pick `STU-(N+1)`; loser hits `@@unique([schoolId,studentCode])` → 500.
- Fix: iterative bounded loop based on `max(studentCode)` with existence check; retry on P2002.

### H3. Level/group integrity not enforced on edit & bulk level-change
- Bulk "Change Level/Group" lists **all** groups from all levels (`student-bulk-modals.tsx:96-97`); backend `bulkUpdate`/`update` never verify `group.levelId === levelId` (`students.service.ts:400-403`, `:117-126`). A student can be saved as Level-2 + Group-of-Level-1 → corrupts attendance/assessments/portal "upcoming sessions".
- Fix: filter group dropdown by selected level; server-side validate group belongs to level.

### H4. Silent group re-assignment on merely opening/editing a student
- `student-form-modal.tsx:41-47` re-derives `groupId` from the grade→group combo on open and **overwrites** the stored group; an unchanged save relocates the student.
- Fix: auto-map only when grade/level actually changes; otherwise keep `student.groupId`.

### H5. Sorting is client-side per-page only (globally wrong roster ordering)
- `students-client.tsx:79-97` sorts the current 20-row page; server always orders `createdAt:desc`; `sortBy` never sent to API. Names recur across pages; "A–Z" shows misleading data.
- Fix: send `sortBy`/`sortDir` to `GET /students` and order server-side.

### H6. Import group resolution keyed by name-only → wrong-level groups
- `students.service.ts:292` keys groups by `name` only (not `(level,name)`); two same-named groups across levels → "last wins" places students in wrong level's group.
- Fix: key by `(resolvedLevelId, name)`.

### H7. Bulk grade change never re-derives group from grade→group mapping
- `student-bulk-modals.tsx:105-113` sends only `schoolGrade`; group stays stale → combo inconsistency after bulk grade update.
- Fix: re-resolve `groupId` from `gradeGroups` config when `schoolGrade` changes.

### H8. Attendance `to` date filter drops the entire end day
- `attendance.service.ts:36-39`: `lte = new Date(to)` is `00:00:00` → excludes all records on the `to` date.
- Fix: `new Date(to).setHours(23,59,59,999)` or `tomorrow minus 1ms`.

### H9. Duplicate attendance sessions freely created
- `createSession` (`attendance.service.ts:93-137`) has no uniqueness guard; repeated start-class clicks create multiple sessions for same group/date.
- Fix: upsert / unique on `(schoolId,groupId,scheduledDate)` or find-first-then-create.

### H10. Attendance session list truncated to 100 while UI requests 500
- Frontend `page.tsx:111` sends `limit:500`; backend caps at 100 (`attendance.service.ts:29`). Past sessions unreachable.
- Fix: raise cap or paginate in UI.

### H11. `updateUser` escalates roles without the guard used elsewhere
- `users.service.ts:133-137`: if `data.roleName` present, does `deleteMany` all userRoles + `create` the one role — with **no check** that caller is super_admin and **no guard** that `roleName` isn't `super_admin`/`admin`. `assignRole` (`:157-159`) has that guard; `updateUser` bypasses it. Also wipes all existing roles.
- Deployment context: **prod admin `admin@niangelos.app` is currently deactivated** (live login → 401 "Account is deactivated"), so roles/settings may be unmanageable; verify intended account state.
- Fix: route role changes through `assignRole` scope checks; validate `roleName` enum.

### H12. Roles/permissions editor writes to a non-existent endpoint
- `roles-permissions-tab.tsx:123` POSTs `/roles/:role/permissions`; **no roles controller exists** (no module/controller in `backend/src/modules/`), so settings saves 404 and permission edits never persist.
- Fix: implement backend `/roles/*` CRUD (or remove the editor + sync from `permissions.ts`).

---

## 🟠 MEDIUM

- **M1.** Attendance sessions: records for soft-deleted students filtered in `getSessionById` (`:89`) but not in `getSessions` list summary — summary counts may include deleted students' records.
- **M2.** Point-system config read bug: `getSystemConfig` returns a single object when `key` is set (`users.service.ts:303`), but `point-system-tab` reads `data?.[0]?.value` → saved rules never load.
- **M3.** Add-student dead-end: level with no mapped grade→group → `groupId` forced empty → generic "Please fill all required fields", no manual group picker (`student-form-modal.tsx:34-35,139-142`).
- **M4.** Photo upload happens **before** create; if create fails, the upload is orphaned on disk (`student-form-modal.tsx:75`).
- **M5.** Create student ignores DTO `status`, hard-codes `'active'` (`students.service.ts:150`) — "Inactive/Graduated" choice silently dropped.
- **M6.** Delete confirmation claims permanent destruction of attendance/grades/XP, but deletion is **soft** (`students.service.ts:219`, `:421`) — warning misleads servants; no restore UI.
- **M7.** "Delete All" bulk button label implies whole-school deletion; actually deletes only selected set (`student-bulk-modals.tsx:70`).
- **M8.** CSV import: rows missing a name silently dropped (`student-import-modal.tsx:40-46`); no dedup against existing students → duplicate enrolments; one bad row aborts whole import via all-or-nothing `$transaction` with no per-row resolution.
- **M9.** Import assigns codes `STU-${count+i+1}` using a count that includes soft-deleted rows, no per-code existence check → potential unique-constraint 500.
- **M10.** Stats cards fetched once on mount, never refreshed after add/edit/delete/import (`students-client.tsx:108`).
- **M11.** Post-mutation pagination: create on page>1 invisible; delete-last-of-page lands on phantom empty page (`students-client.tsx:63,140,144`; `student-bulk-modals.tsx:38`).
- **M12.** Page size hard-coded to 20; no page-size control (`students-client.tsx:90`).
- **M13.** `GET /students/:id/activity` not school-scoped (`students.controller.ts:147-151`, `audit.service.ts:32-43`) — cross-tenant audit-log read.
- **M14.** `addXp` read-modify-write (aggregate sum then create transaction) is not atomic (`gamification.service.ts:531-551`) — concurrent awarding can race.
- **M15.** `computeAllBadges` iterates every student serially with 1-in-many `$transaction`-less writes — slow on large schools, no batching.
- **M16.** Assessment partial update AS-6: `UpdateAssessmentDto` still requires `totalPoints`/`passingPoints` (`assessment.dto.ts:141-147`) → `PATCH` 400. (Known; unfixed.)
- **M17.** Church filter auto-set to logged-in user's church makes "No students match your filters" show on brand-new schools and "Clear Filters" reveal cross-church data contradicting the default scoping (`students-client.tsx:106`).

---

## 🟡 LOW
- Activity log entity read uses only `entityType`+`entityId`, no `schoolId` (`students.controller.ts`); detail modal never calls `GET /students/:id` so profile/medical/parents not shown & can be stale (`student-detail-modal.tsx:14-32`); no delete inside detail modal.
- Single delete requires no typed confirmation (bulk does) (`student-delete-modal.tsx:32`); `deletingRef` dead variable (`students-client.tsx:63`).
- Import CSV parser mishandles escaped quotes, no BOM handling (`student-import-modal.tsx:21-30`); level preview uses name-not-ID lookup (`:112`); gender only `@IsString` (no enum).
- `query-student.dto.ts:20-23` `status` no `@IsEnum`; `findOne` update doesn't validate `groupId` belongs to `levelId`.
- Student code `@@unique` means re-create after deletion can collide; assigned-servants lookup scopes level+group+roleName (may empty-out level-scoped servants).
- Shift-click range uses `optimisticStudents` vs sorted render (`students-client.tsx:79-85`).
- Announcements/form fallback swallows the 404 and lies with success toast (`announcement-form-modal.tsx:68-75`).

---

## Live prod smoke observations (2026-08-05)
- `GET /announcements` → **404**, `POST /announcements` → **404** (C1 confirmed).
- `POST /auth/login` for `admin@niangelos.app` → **401 "Account is deactivated"** (account currently inactive on prod; verify intended — blocks staff roles/settings verification).
- `GET /student-portal/STU-00001` with no auth → **401** (global guard coverage is present at transport level; the insecurity is the bare-code design + sequential codes at the logic layer).
- Rate-limited (429) after several attempts — pace live calls.

---

## Suggested priority fix order
1. **C1** Announcements: either ship backend CRUD or disable the feature + remove false success toast.
2. **C2** Parent practice status mismatch (canonical `active`/`published`).
3. **C3** Require parent/student auth for portal; drop bare-code sensitive reads.
4. **H2** `generateStudentCode` loop + concurrency (crash trigger).
5. **H1** Export full roster (cap + streaming).
6. **H3/H4/H7** Level/group integrity + no silent group override.
7. **H11/H12** Roles: enforce guard on `updateUser`; implement/remove `/roles` endpoint.
8. **H8-H10** Attendance date filter, duplicate sessions, list cap.
9. Medium batch: import robustness, stats refresh, pagination, school-scoping.