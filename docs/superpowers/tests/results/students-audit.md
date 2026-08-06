# STUDENTS End-to-End Audit — niangelos-platform

Scope: Students CRUD (list, filters, add/edit/delete, detail, bulk ops, import, stats, assigned servants, grade+group combos).
Frontend: `frontend/src/app/dashboard/students/**`
Backend: `backend/src/modules/students/**`, `backend/prisma/schema.prisma`

All findings were traced end-to-end as a real user. Severity legend: Critical = data loss/corruption or crash; High = wrong data shown or silently mutated; Medium = broken/correct-broken edge behavior; Low = cosmetic/perf/security-nuance.

---

## 0. Delta summary (top issues)

- **Export silently drops students.** Frontend asks for `limit=total` but the backend hard-caps `limit` at 100 → schools with >100 students export only 100 rows. (High)
- **`generateStudentCode` can infinitely recurse** (stack overflow / 500) whenever the highest existing `STU-…` code exceeds the row count (hard-deleted rows, gap after data migrations, or code edited by hand). (High)
- **Bulk Level change lets you pick a group from any level** and the backend never checks `group.levelId === levelId`, so a student can be saved into Level 2 + a Level-1 group. Data-integrity corruption. (High)
- **Silent group mutation on Edit.** Opening the edit modal re-derives `groupId` from the grade→group combo and overwrites the stored group; saving without touching anything relocates the student to a different group. (High)
- **Client-side sort is per-page only.** Sorting happens over the 20 rows of the current page; the server always orders by `createdAt`. A "name A–Z" sort shows different windows per page with no global ordering — wrong data presented. (High)
- **Same-name groups collide on CSV import.** `groupMap` is keyed by group *name only* (not level), so two "Group A"s in different levels resolve to whichever is last → import can place a student in the wrong level's group. (High)
- **Bulk grade change never re-derives the group** from grade→group mapping → combo inconsistency after bulk grade update. (Medium-High)
- **Import silently drops malformed rows** (missing name) with no error, and does no dedup against existing students → duplicate enrolments. (Medium)

---

## 1. List / filters / pagination / sorting / stats cards

**[High] frontend/src/app/dashboard/students/students-client.tsx:79-85 + :87-97 — Client-side sort operates only on the current page's 20 rows; the server always orders by `createdAt` and the sort key is never sent to the API.**
Real user impact: Clicking "Student"/"Name" to sort A→Z sorts only the 20 rows loaded on this page. Page 2 fetches the next 20 by creation date and re-sorts *those 20* among themselves. Result: the same names recur across pages, other keys never appear, and the "sorted" list is globally wrong. The user's mental model of an ordered roster is broken, and any read of "alphabetical list" returns misleading data.
Suggested fix: Send `sortBy`/`sortDir` to `GET /students` and order in `students.service.findAll` (`orderBy`), and remove the client-side sort (or keep it only for non-paginated exports).

**[Low] students-client.tsx:79-85 — Shift-click range selection uses `optimisticStudents` (unsorted base) while rows are rendered from `sortedStudents`.**
Real user impact: When a sort is active, shift-clicking a visible range can select a different set of rows than what the user sees highlighted.
Suggested fix: Build the range indices from `sortedStudents` instead of `optimisticStudents`.

**[Medium] students-client.tsx:90 — Page size is hard-coded to `limit:'20'` (mirrored in `pagination` state default).**
Real user impact: No way to view more rows per page; large rosters require many clicks; no preference/URL persistence.
Suggested fix: Expose a page-size control and persist per-user; pass it as `limit`.

**[Medium] students-client.tsx:138-145 + student-table.tsx (empty state) — After deleting the last row of the last page, `fetchStudents(pagination.page)` re-fetches the same page number which is now out of range → empty table rendered as "No students match your filters" even when no filter is active.**
Real user impact: Deleting the last item on page N drops you onto a phantom empty page with a misleading message; you must manually click back to page 1. Same applies to bulk delete (`student-bulk-modals.tsx:38` → `onSuccess(currentPage)`).
Suggested fix: After delete, clamp `page = min(page, totalPages)` before refetch (or `fetchStudents(1)`) and detect the "page out of range" case to auto-jump.

**[Medium] students-client.tsx:108 — Student stats (`/students/stats`) are fetched once on mount and never refreshed after add/edit/delete/bulk status/import.**
Real user impact: After adding a student, total/active/grade-distribution cards remain stale until a full page reload — the numbers a servant reports from the dashboard are wrong.
Suggested fix: Refetch stats inside the same `onSuccess` callback used for list refresh (and after import/delete).

**[Low] students-client.tsx:106 — The church filter is auto-set to the logged-in user's church on mount.**
Real user impact: The list is always church-scoped; `hasActiveFilters` becomes true immediately (so a brand-new school shows "No students match your filters" instead of the onboarding empty state), and "Clear Filters" then reveals all churches' students, contradicting the default scoping.
Suggested fix: Decide intent explicitly; if per-church scoping is desired, apply it server-side via `schoolId` filter rather than a visible `churchName` filter chip, or don't count it as a user filter.

**[Low] query-student.dto.ts:20-23 — `status` accepts arbitrary string (enum is only documented via ApiProperty, not enforced by `@IsEnum`).**
Real user impact: Any status value passes server validation; UI only offers the 3 real ones so low real-world friction, but a bad `status` filter returns empty results silently.
Suggested fix: Add `@IsEnum(['active','inactive','graduated','transferred'])`.

---

## 2. Add student

**[High] student-form-modal.tsx:34-35 + 139-142 — If a level has no grade→group combos configured, `mappedGrade = gradeOptions` (full fallback list) but selecting any grade sets `groupId:''` because `combo` is undefined → the save is rejected with "Please fill all required fields" (groupId is required: `:69`).**
Real user impact: For any level without grades mapped in Settings→Grades, adding a student is impossible — the Group field is display-only ("Auto from grade") and there is no manual group picker and no way to proceed. Servant hits a dead end with a confusing generic error.
Suggested fix: Either block submit with a clear "configure a grade→group mapping first" message, or add a real group <select> fallback when no combination maps the chosen level, and don't force `groupId` empty into validation.

**[Medium] student-form-modal.tsx:75 — Photo upload (`POST /upload/student-photo`) runs *before* `POST /students`; if the student create then fails (validation 400, duplicate, no academic year 404, network), the uploaded file is orphaned on disk with no reference.**
Real user impact: Stale `uploads/student-photos/*` accumulate on every failed add; no impact on roster data but storage bloat and unreferenced files.
Suggested fix: Upload after a successful create (create with temp/no photo then attach), or wrap in a transaction that deletes the uploaded file on failure.

**[Medium] students.service.ts:150 — Create ignores the DTO `status` and hard-codes `status: 'active'`.**
Real user impact: A servant choosing status "Inactive" or "Graduated" on the Add form sees their choice, but the student is silently stored as Active — appears in active lists and stats count.
Suggested fix: Use `createStudentDto.status ?? 'active'`.

**[Low] students-client.tsx:31-33 + form catch — The optimistic temp row (`temp-${Date.now()}`) is added before the request; on error `onSuccess(currentPage)` refetches so it is normally cleaned up, but if that refetch also fails (`fetchError`) the phantom row lingers in optimistic state (invisible behind the error panel).**
Real user impact: Cosmetic; the phantom row disappears on the next successful fetch. No data corruption, but transient ghost row during long/slow creates.
Suggested fix: Remove-by-id on fetch failure, or clear optimistic queue when a create errors.

**[Low] student-form-modal.tsx:57-67 — Required validation is enforced per-field, but only `name/dateOfBirth/levelId/groupId`; `email`/`phone` regex are loose and only checked when non-empty.**
Real user impact: `phoneRe` allows any 6–20 chars of digits/specials (no country-code requirement); `name` can be a single token so `lastName` becomes `''` and is stored empty (schema requires `@IsString`, passes). Minor data-quality issues.
Suggested fix: Enforce a headed name (≥2 tokens), stricter phone validation, and trim sentinel empties to `null`.

---

## 3. Edit student

**[High] student-form-modal.tsx:41-47 — The `groupId` prefill effect re-derives the group from the grade→group combo on open and *overwrites* the stored `groupId` whenever a mapping exists.**
Real user impact: A student whose actual group differs from the mapping (legacy data, manual reassignment, or the mapping was edited since) gets their group silently changed to the mapped group the moment the modal opens — and because the user's next action is usually just "Save", the student is relocated without any deliberate change. This is silent data mutation.
Suggested fix: Only auto-map when the user actually changes the grade or level; otherwise keep `student.groupId` untouched. On a manual grade change, warn that the group will change.

**[Medium] student-form-modal.tsx:121 — Changing level clears `schoolGrade` and `groupId` (good), but the group is not re-derived until a grade is chosen; saving with a level but no grade fails validation.** (Related to the dead-end in §2.)
Real user impact: Same dead-end as Add when no combo maps the new level.
Suggested fix: Provide group fallback selection or a clear "map grade first" message for the new level.

**[Low] student-form-modal.tsx:52 — Edit prefill re-sends `phone/email/address/notes` from `metadata`; if the user lacks `student:edit-sensitive`, `churchToolId` and `parentEmail` are still carried in `body` via the `...rest` spread and re-saved unchanged.**
Real user impact: No UI path changes them, but the server accepts them from any staff role (`@Roles(STAFF_ROLES)` only) — a crafted request can set `parentEmail` and hijack a parent-dashboard link. Access-control is not enforced on the field level.
Suggested fix: Strip `churchToolId`/`parentEmail` in the DTO/service unless the authenticated role holds `student:edit-sensitive`.

**[Low] `put` path (controller.ts:117-126) — Update does not validate `groupId` belongs to `levelId` (server).**
Real user impact: Only reachable via the bulk path or crafted request, but it is the server-side root cause of the level/group mismatch bug (see §5). Combined with the bulk UI bug this yields real corrupted assignments.
Suggested fix: In `update`/`bulkUpdate`, verify the target group's `levelId === levelId`.

---

## 4. Delete

**[Medium] student-delete-modal.tsx:19-27 & student-bulk-modals.tsx:54-59 — The confirmation copy claims deletion permanently removes "Attendance records / Assessment submissions & grades / Gamification XP & badges."**
Real user impact: Deletion is actually a **soft delete** (`students.service.remove:219` sets `deletedAt`; `bulkDelete:421` likewise). All attendance/submissions/XP rows remain in the DB and are simply hidden from student-list queries. The active student could never log in again, and if the same student is later re-added the historical data still references the old row (and is now unreachable). The warning overstates permanent loss and misleads servants about what is being destroyed.
Suggested fix: Reword to "This archives the student; historical records are retained but the student can no longer access the portal."

**[Low] students.service.ts:218-221 — Soft delete does not detach/soft-delete related rows (attendance sessions reference the student via `AttendanceRecord.studentId` with no `onDelete` set).**
Real user impact: Rows persist and can leak into queries that forget `deletedAt:null`; no major owner-visible bug today, but historical data becomes orphaned and unrecoverable through the UI.
Suggested fix: Document the archive semantics; consider a `Restore` action or a hard-delete-with-cascade admin path that matches the warning text.

**[Low] student-delete-modal.tsx:32 — Single delete has no typed confirmation (bulk delete requires typing "DELETE" at bulk-modals:69, single does not).**
Real user impact: A single careless click permanently archives a student (irreversible from UI). Inconsistent destructive-action guardrails.
Suggested fix: Require the same "DELETE" type-to-confirm for single delete, or add an undo/restore.

**[Low] students-client.tsx:63,140,144 — `deletingRef` is written but never read (dead variable).**
Real user impact: No double-submit guard; the modal closes before the await so re-clicks are unlikely, but the guard is dead code with no protective effect.
Suggested fix: Remove it or actually use it to disable the confirm button while in flight.

---

## 5. Bulk operations

**[High] student-bulk-modals.tsx:96-97 — The Bulk "Change Level / Group" modal lists **all** groups from every level (`allGroups.map(...)`) with no filtering to the selected level.**
Real user impact: A servant picks Level 2 + visually any group that happens to be in that column (e.g., "Group A" that belongs to Level 1), submits, and the backend (`students.service.bulkUpdate:400-403`) writes `{levelId, groupId}` with **no consistency check**. Students end up with `levelId=Level2` and `groupId=Level1-GroupA` — corrupted level/group enrollment that then breaks group-based attendance/assessments/portal "upcoming sessions".
Suggested fix: Filter the group dropdown by the chosen `bulkLevelId`; server-side validate `group.levelId === levelId` in `bulkUpdate` and `update`.

**[Medium-High] student-bulk-modals.tsx:105-113 & students.service.ts:393-403 — Bulk "Change Grade" sends only `schoolGrade`; the group is never re-derived from the grade→group combo.**
Real user impact: After a bulk grade change, students keep their old group even though the grade now maps to a different group → level/grade/group combo becomes inconsistent; the roster shows a grade whose mapped group doesn't match the assigned group.
Suggested fix: When `schoolGrade` is set in `bulkUpdate`, re-resolve `groupId` from the `gradeGroups` config for the student's current level and update it too.

**[Medium] student-bulk-modals.tsx:70 — The bulk-delete confirm button is labeled "Delete All".**
Real user impact: Reads as if it deletes *all* students in the school; it actually deletes the currently **selected** set. Misleading, and risk of a servant assuming a smaller scope.
Suggested fix: Label "Delete (N) selected".

**[Low] students.service.ts:400-403 — `bulkUpdate` returns only `updated` count; ids not found in this school are silently ignored (no feedback).**
Real user impact: If any selected id belongs to another school or was already soft-deleted, the success toast under-reports; no indication something didn't update.
Suggested fix: Return `{ updated, notFound }` and surface it.

---

## 6. Import CSV

**[High] students.service.ts:292 — Group resolution for a provided `groupId` is keyed by group **name only** (`groupMap.set(g.name.toLowerCase(), g.id)`), not by (level,name). When two levels have a group with the same name, "last wins" and an import row that supplies `groupId` can land a student in the **wrong level's group**.**
Real user impact: A CSV with a `groupId` column and common group names ("Group A") across levels silently enrols some students into another level's group. Group-based attendance/assessments and parent portal "upcoming sessions" then show the wrong cohort.
Suggested fix: Key groups by `(resolvedLevelId, name)` and resolve `groupId` scoped to the resolved level.

**[Medium] student-import-modal.tsx:40-46 — Rows that fail to yield both `firstName` and `lastName` are silently **dropped** (`rows.filter(r=>r.firstname&&r.lastname)`), not reported.**
Real user impact: A CSV with a few rows missing a name shows a preview of (N−k) rows and imports only those; the k dropped students simply disappear with no warning — silent data loss from the import.
Suggested fix: Collect dropped rows into `duplicateWarnings`-style errors and block/focus them before import.

**[Medium] student-import-modal.tsx:47-57 — Duplicate detection is only client-side "warnings" and does not block; the backend (`bulkCreate`) has **no dedup** against existing students (no unique constraint on name/email/phone).**
Real user impact: Re-importing the same file (or a file overlapping existing students) creates duplicate enrolments with new STU-… codes; the warning banner is shown but Import remains enabled, so duplicates are created anyway.
Suggested fix: Query existing students by normalized `(firstName,lastName)`/email for the school and skip-or-report in the import result.

**[Medium] students.service.ts:322-335, 364-368 — Any row with an invalid date / unknown level / unmapped grade aborts the **entire** import inside/around a `$transaction`; there is no partial import and no per-row resolution workflow.**
Real user impact: One bad date in a 500-row file fails the whole batch; the error string lists every bad row but the user must fix everything and resubmit the full file. Data is not lost but the workflow is painful for real spreadsheets.
Suggested fix: Support per-row resolution (skip bad rows and report), returning `{ imported, failed:[{row,message}] }` instead of all-or-nothing.

**[Low] students.service.ts:308 + 356 — Import codes are assigned `STU-${count + i + 1}` using a count that **includes soft-deleted** students and without per-code existence checks.**
Real user impact: In normal flow codes stay monotonic and unique; but with any code gap from hard-deleted rows or imported legacy data, an import can assign an already-used code → unique-constraint (`@@unique([schoolId, studentCode])` schema.prisma:286) failure → the whole import 500s with an opaque error.
Suggested fix: Allocate codes via a used-code set (like `generateStudentCode`'s existence check, but capped), not by raw count.

**[Low] students.service.ts:314-316 — Level/group lookup is case-insensitive on name but only via `toLowerCase` of the exact trimmed value; names with internal spacing/case oddities fail.**
Real user impact: `"Level  1"` (double space) or a level stored with different casing/accents won't resolve → row error. Also `gender` is never validated (`@IsString` only) → `gender="x"` imports and renders as male in the list.
Suggested fix: Normalize whitespace; enforce `@IsEnum(['male','female'])` in `BulkStudentItem`.

**[Low] student-import-modal.tsx:21-30 — The custom `csvFields` parser mishandles escaped quotes inside quoted fields (`""` closes/opens) and has no BOM handling on input.**
Real user impact: Names containing embedded quotes break parsing; barely common in practice.
Suggested fix: Use a robust CSV parser (e.g., `csv-parse`) and strip/accept UTF-8 BOM.

**[Low] student-import-modal.tsx:112 — Preview "Level" column uses `levelNameMap[r.levelid]` where `r.levelid` is often a **level name**, not an ID, so matching fails and it renders the raw string or an 8-char ID fragment.**
Real user impact: The level preview is confusing/unclear rather than useful; cosmetic, but reduces confidence in the exact level being targeted before import.
Suggested fix: Resolve by name into the map too (build `name→id` map), then display the friendly level name.

---

## 7. Detail modal / assigned servants

**[Low] student-detail-modal.tsx:14-32 — The detail modal renders only from the list-row `Student` object + a separate activity fetch; it never calls `GET /students/:id`, so it does not display the profile (emergency contact, allergies, medical notes, parent linkage, churchToolId) even though `findOne` (`students.service.ts:71-99`) already returns `profile`, `studentParents`, and `medicalNotes` — and can show **stale** data if the student was updated by another user.**
Real user impact: Servants reviewing a student miss medical/emergency info and see potentially outdated values for the current session.
Suggested fix: On open, `GET /students/:id` and render profile + parents + medical notes; keep activity fetch as-is.

**[Low] student-detail-modal.tsx:77-80 — Delete is only reachable from the list-row action, not from within the detail modal (Edit exists, Delete does not).**
Real user impact: Inconsistent entry point; servant must close detail to delete. Not a bug, but a UX gap.
Suggested fix: Optionally add a guarded Delete action in the detail modal footer.

**[Low] students.controller.ts:147-151 + audit.service.ts:32-43 — `GET /students/:id/activity` (and `findByEntity`) filters only by `entityType`+`entityId` with **no schoolId scope**.**
Real user impact: Any staff role can read another school's student activity log if they know the student UUID (UUIDs are not guessable, but they leak via logs/shared exports). Cross-tenant information disclosure.
Suggested fix: Scope `findByEntity` by `schoolId` from the resolver.

**[Low] students-client.tsx:110-114 — Assigned servants fetch uses both `groupId` and `levelId` plus `roleIn`; a servant assigned to the level but not the group, or with a different role name, will not appear.**
Real user impact: The "Assigned Servants" panel can be empty for groups where servants are level-scoped — misleading "no servants assigned."
Suggested fix: Clarify the intended scoping (level vs group) and query accordingly.

---

## 8. Student code (STU-……)

**[High] students.service.ts:664-682 — `generateStudentCode` recurses with the **same** `count` when the candidate code already exists; if `STU-(count+1)` exists (code gap from a hard-deleted row, an externally-imported higher code, or a code that was manually edited), the recursion never terminates → `RangeError: Maximum call stack size exceeded` → 500, and under some Node configs can destabilize the request worker.**
Real user impact: Adding a student after a code gap (or after any hard delete / data migration that leaves a skipped code) crashes the create request. Because a *soft* delete still counts, this is rare in pure UI flow but is a live crash-trigger with adjacent data operations.
Suggested fix: Loop (not recurse) over an incrementing counter, or compute from `max(studentCode)` with an existence check, and guard against unbounded runs.

**[Medium] students.service.ts:664-682 — No serialization: two concurrent creates both read `count`, both target `STU-(N+1)`, and the loser hits the DB unique constraint `@@unique([schoolId, studentCode])` → unhandled → 500 to one user.**
Real user impact: Two servants adding students simultaneously can cause one add to fail with a generic error (and, per the recursion bug above, the loser's retry path loops).
Suggested fix: Reserve codes via a DB sequence/upsert or retry on P2002 with the next free code (bounded).

---

## 9. Pagination / page-size / onSuccess(page)

**[High] (cross ref §1 / §4 / §5) students-client.tsx:148 + students.service.ts:21 — `handleExport` requests `limit: String(pagination.total||2000)`, but `findAll` clamps `limit = Math.min(rawLimit, 100)`. Exports are truncated to 100 rows.**
Real user impact: Any school with >100 students gets a CSV missing students beyond the first 100 — silent data loss on the primary roster-export feature (no cap in the UI message, no pagination in export).
Suggested fix: Stream/multi-page export on the server (respect the true cap), or lower the advertised export and chunk pages client-side; also add a UTF-8 BOM (`\uFEFF`) for Arabic Excel and guard CSV formula injection.

**[Medium] students-client.tsx:100 + :196 — `fetchStudents(1)` is called whenever filters change (`useEffect` on `fetchStudents`), and pagination calls `fetchStudents(p)`; `onSuccess(currentPage)` is used for create/update/delete/bulk. After a create the new student (ordered `createdAt:desc`) lands on page 1, so if the user is on page 3 it is invisible; after delete the phantom/empty trailing page issue (§4) appears.**
Real user impact: Post-mutation navigation to a page where the changed record may not be visible, or an empty trailing page; users must manually jump.
Suggested fix: Route create to page 1, clamp delete/bulk pages to `totalPages`, and scroll-user back to the affected page where appropriate.

---

## Coverage checklist

1. List/filters/pagination/sorting/stats ✓ (§1)
2. Add (validation, photo, optimistic) ✓ (§2)
3. Edit (prefill, level change, grade→group, partial-field) ✓ (§3)
4. Delete (single/bulk/delete-all, confirmations, soft vs hard, attendance/assessment/progress) ✓ (§4)
5. Bulk (status/grade/level, group re-derivation) ✓ (§5)
6. Import (columns, dups, group auto-derive, malformed/date/unknown level, error reporting) ✓ (§6)
7. Detail (info, edit/delete entries, assigned servants) ✓ (§7)
8. STU-… code collisions after deletion ✓ (§8)
9. Pagination/limit/onSuccess(page) ✓ (§9)

---

## Priority action order

1. Fix export cap (100) and export correctness. (§9)
2. Fix `generateStudentCode` infinite recursion + concurrency. (§8)
3. Enforce `group.levelId === levelId` in `update`/`bulkUpdate`; filter group dropdown by level in bulk-level modal. (§5, §3)
4. Stop silent group override on edit-open. (§3)
5. Make sort server-side / drop client-only per-page sort. (§1)
6. Scope import `groupId` resolution by level; dedup + report malformed rows. (§6)
7. Refresh stats after mutations. (§1)