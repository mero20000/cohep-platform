# Platform-Wide Module Audit — Findings & Proposed Plans

> Generated 2026-08-24 · For review & approval before execution
> Sources: 6 module audits (Assessments, Reports/Dashboard, Announcements/Notifications, Churches/Schools/Upload, Curriculum, Student Portal) + validated role matrix (`docs/ROLE-MATRIX.md` §3)
> Test evidence at time of writing: backend 268/268, frontend 176/176, both tsc clean

---

## Executive Summary

| Module | Critical | Important | Minor | Top risk |
|---|---|---|---|---|
| Assessments | 2 | 8 | 9 | Any staff can grade/delete anything; student impersonation via `studentId` param |
| Reports/Dashboard | 2 | 5 | 8 | `viewRole` privilege escalation; O(students) N+1 per request |
| Announcements/Notifications | 3 | 6 | 7 | Parents read DRAFT announcements; push backend doesn't exist; no WhatsApp opt-out |
| Churches/Schools/Upload | 3 | 5 | 8 | Cross-school IDOR on school CRUD; public SSRF-capable stream proxy |
| Curriculum | 3 | 2 | 4 | Any servant can hard-delete academic years & lessons |
| Student Portal/Hymn | 1 | 2 | 4 | Hymn-learning routes have no ownership verification |
| Role matrix §3 (cross-cutting) | — | 5 | — | Flat RBAC; assistant_servant hidden-but-privileged |

**Recommended execution order:** Security batch first (all Criticals), then RBAC hardening batch, then data-correctness batch, then UX/features batch.

---

## 1. Assessments

### Critical
- **A-C1. No ownership/class scoping** — `assessments.controller.ts:26` flat `STAFF_ROLES` on create/update/delete/grade/assign. An assistant_servant can delete another servant's assessment or grade another class. *Fix: ownership check (creator or same level/group) + restrict delete/publish to admin/principal.*
- **A-C2. Student impersonation** — `assessments.controller.ts:101-171`: any staff can submit answers **as any student** via `studentId` param, with no audit of who actually submitted. *Fix: restrict to admin/principal, add `submittedByUserId`, confirm product intent.*

### Important (selected)
- **A-I1. Race → duplicate submissions** — no `@@unique([assessmentId, studentId])` on AssessmentSubmission (`schema.prisma:843-866`); concurrent submits bypass the findFirst check. *Fix: unique constraint + transactional upserts.*
- **A-I2. Due date never enforced** — `dueDate`, `isLate`, `allowLateSubmission` exist but nothing reads them (`assessments.service.ts:221-241`). *Fix: enforce in submit/getTakeQuestions, set isLate.*
- **A-I3. Timer resets on refresh** — countdown restarts client-side; `startedAt` never persisted (`take-assessment.tsx:115`). *Fix: set startedAt server-side on first /questions fetch; compute remaining from it.*
- **A-I4. Essay/aggregate grade never reconciled** — per-question grades and null-question aggregate grades coexist; `getStats` only counts aggregate grades so auto-graded quizzes are invisible in pass-rate (`assessments.service.ts:258-275, 606-622`). *Fix: compute aggregate from per-question grades when all questions graded.*
- **A-I5. Fabricated `createdBy`/`gradedBy`** — creator set to "oldest user in school", sentinel UUID risks FK violation (`assessments.service.ts:74-95, 464-467`). *Fix: always `req.user.id`.*
- **A-I6. `markStudent` auto-creates submissions** — marking an unassigned student silently enrolls+completes them (`:449-456`). *Fix: reject unless assigned.*
- **A-I7. Batch "Fail" = 40% can still be a statistical pass** (`page.tsx:730-736`). *Fix: fail = passingPoints − 1.*
- **A-I8. getStats loads all submissions into memory** (`:606-622`). *Fix: SQL groupBy.*

### Minor (selected)
Empty `correctAnswer` → silent zeros; exact-string short-answer matching; UTC-midnight due dates; search filters only current page; no resubmit policy; rubricScores field unused; no notifications on publish/grade; mobile form grids; destructive "Deassign All" without confirm.

---

## 2. Reports & Dashboard

### Critical
- **R-C1. `viewRole` privilege escalation** — `dashboard.service.ts:250-270`: `GET /dashboard/mine?viewRole=admin` returns the full management view to **any** caller (incl. parents); server never checks viewRole ∈ user.roles. *Fix: intersect & reject (one-line).*
- **R-C2. N+1 at-risk scan on every request** — `reports.service.ts:47-57, 322-332, 478-486`; `dashboard.service.ts:916-941, 1246-1251`: one `findMany(take:3)` **per student** per request; diocese multiplies by school count; uncached. *Fix: window-function SQL (ROW_NUMBER) + TTL cache (60s–15min).*

### Important
- **R-I1. Deleted/cancelled sessions distort at-risk & health** — at-risk queries lack `attendanceSession.deletedAt/status` filters and order by `createdAt` not `scheduledDate` (`reports.service.ts:48-53`; `dashboard.service.ts:917-921, 1246-1250`). Same deletedAt gaps in `getStats` completedSessions, upcomingSessions, weeklyStats, classTrend, recentGrades. *Fix: mirror the parents.service deletedAt fix across dashboard.service.*
- **R-I2. Reports open to all staff** — priest-pulse/liturgical-engagement/servant-contributions callable by assistant_servant (`reports.controller.ts:10-34`). *Fix: restrict to super_admin/admin/principal; scoped variants for servants.*
- **R-I3. Unassigned servant falls back to whole school** — `dashboard.service.ts:295-306, 723-756`. *Fix: explicit empty state.*
- **R-I4. Duplicate diocese health formulas / dead code** — `reports.service.ts:305-351` vs `:489-494` different weights. *Fix: unify, delete dead `getDioceseDashboard`.*
- **R-I5. Hard-coded Gregorian liturgical seasons break mid-year** (`reports.service.ts:153-161`). *Fix: use existing coptic-calendar utility.*

### Minor
No CSV/PDF export anywhere; no date-range control; no drill-down on at-risk/pending counts (not clickable); parent leaderboard exposes school-wide ranking (privacy decision); `totalChurches` global not school-scoped; parent-view link path missing student.deletedAt filter; missing indexes (`XPTransaction[createdAt]`, `StudentBadge[awardedAt]`, `AttendanceRecord[studentId,createdAt]`, `Notification[userId,type,createdAt]`); serial 12-month loop.

**Missing reports (features):** named at-risk watchlist with parent contact links; term-over-term comparison; per-servant contribution trends; weekday/session heatmap; new-student retention/fade-out.

---

## 3. Announcements & Notifications

### Critical
- **N-C1. Parents can read DRAFT announcements** — `findAll` status filter optional; `findOne` never checks status (`announcements.service.ts:162, 188-195`); `@Roles(...STAFF_ROLES,'parent')`. *Fix: default status=published for non-staff; enforce in findOne; filter targetAudience/targetRoles.*
- **N-C2. Push backend does not exist** — frontend calls `/vapid-public-key` and `/push/subscribe` (`portal/layout.tsx:168-191`); **no push controller/service in backend** (404s). web-push installed but unused. *Fix: implement PushModule (subscriptions table, send on channels incl 'push', VAPID endpoint).*
- **N-C3. No WhatsApp opt-out** — every eligible event messages unconditionally; no STOP handling or preferences (`attendance.service.ts:347-355`). Compliance risk. *Fix: preference flag on Student metadata or table; check before send; honor STOP webhook.*

### Important
- **N-I1. wa.me regex bug** — `/[^\\d]/g` in a normal string strips backslashes+letter d → corrupt links (`attendance.service.ts:356`). *Fix: `/[^+\d]/g`.*
- **N-I2. Scheduled publishing broken** — future `publishedAt` publishes instantly; no cron (`announcements.service.ts:199-211`). *Fix: store as draft + cron promote.*
- **N-I3. Badge/grading events create no notifications** — gamification + grading flows never call notifications despite UI icons supporting them. *Fix: wire createNotification into badge award + grade flows.*
- **N-I4. Announcement publish fans out emails only** — no in-app notification rows. *Fix: fan out notifications (and/or WhatsApp) to targeted users.*
- **N-I5. Unread badge caps at 5** — client computes from 5-item page; `/notifications/unread-count` endpoint exists but unused (`portal/layout.tsx:143,215`). *Fix: call the endpoint.*
- **N-I6. Notification click doesn't deep-link** — `data.url` produced but never navigated (`layout.tsx:309-311`). *Fix: mark-read + router.push.*
- **N-I7. Phone normalization naive** — no default country code/E.164 validation (`whatsapp.service.ts:34-35`). *Fix: normalize + validate; skip with clear result.*
- **N-I8. No notification retention** — table grows unbounded. *Fix: cron prune read > 90 days.*

### Minor
Banner dismissal single-slot localStorage (older urgent banner resurfaces); audience targeting columns exist but ignored on read and hardcoded 'all' on create; expiry only in banner path; super_admin email-as-userId quirk; no rate limit on AI draft endpoint beyond global; no read receipts; panel polling continues when hidden.

---

## 4. Churches / Schools / Upload & Storage

### Critical
- **S-C1. Cross-school IDOR on school CRUD** — `GET/PATCH/DELETE /users/schools/:id` use `:id` param which TenantScopeGuard ignores (`tenant-scope.guard.ts:69-79` only inspects `schoolId/schoolIdentifier` params); any admin can read/rename/**soft-delete any other school** (`users.service.ts:433-458`). *Fix: ownership check in service (or extend guard).*
- **S-C2. Public SSRF-capable stream proxy** — `@Public()` `GET /curriculum/recordings/stream?src=<url>`; when `CLOUDFLARE_R2_PUBLIC_URL` unset, `allowHost=''` disables the allowlist → fetches and relays **any https URL** (`recording-stream.controller.ts:19-57`). No auth, no rate limit, advertises Range but doesn't implement it. *Fix: fail closed when R2 host unconfigured; require auth or signed URLs; real Range support.*
- **S-C3. Unauthenticated static uploads** — `/uploads/**` served with no auth (`main.ts:35-36`): student photos are PII, world-readable. *Fix: authenticated route or access-controlled CDN.*

### Important
- **S-I1. Silent local-disk fallback loses recordings** — R2-unconfigured → ephemeral disk, DB rows then point at nothing after redeploy (`storage/r2.ts:29-35`); public bucket = no signed URLs. *Fix: fail fast in prod; presigned URLs.*
- **S-I2. No file deletion anywhere** — subject-item recording DELETE clears DB URL but never deletes the R2/local object; school/church logos orphaned on delete. *Fix: delete objects on mutation; orphan sweeper cron.*
- **S-I3. School soft-delete leaves children active** — users/students of a deleted school still log in (`users.service.ts:453-458`). *Fix: cascade deactivate or block login on deleted school.*
- **S-I4. Any admin can create schools** — `POST /users/schools` is `@Roles('super_admin','admin')` (`users.controller.ts:50-55`); auto-creates/link-first church as fallback (`users.service.ts:397-406`). *Fix: super_admin only; require explicit churchId.*
- **S-I5. SystemConfig accepts arbitrary JSON** — no key whitelist/schema (`users.service.ts:468-474`); guard bypass for users without schoolId (`tenant-scope.guard.ts:44`). *Fix: whitelist keys; enforce schoolId presence.*

### Minor
Magic-byte check skipped under Cloudinary; pptx extension-only validation; `__dirname` path fragility in upload controller (breaks with dist nesting); slug collisions → unhandled 500; church delete orphans schools; logo upload errors only console.error'd + help text lies about SVG; hardcoded 7-timezone dropdown; no storage usage reporting; no audit wiring on school/church mutations; no restore flow.

---

## 5. Curriculum

### Critical
- **C-C1. Any servant can hard-delete academic years** — `DELETE /curriculum/academic-years/:id` under flat STAFF_ROLES does `prisma.academicYear.delete` (HARD delete, cascades allocations/weeks) (`curriculum.controller.ts:168`, `curriculum.service.ts:452-458`). Destroys curriculum history with one call. *Fix: soft-delete + admin/principal only.*
- **C-C2. Any servant can hard-delete lessons + their sessions** — `deleteLesson` hard-deletes lesson and deleteMany's sessions (`curriculum.service.ts:590-597`), flat STAFF_ROLES. *Fix: soft-delete; restrict to admin/curriculum_manager; warn when allocations reference the lesson.*
- **C-C3. Destructive routes have no cross-school check on id** — delete/reorder routes look up by bare `id` with no schoolId verification (`deleteLevel:379`, `reorderAllocations:391-398` — updates arbitrary allocation ids). *Fix: verify record.schoolId === resolved school in every mutation.*

### Important
- **C-I1. Orphaned allocations/lessons after subject soft-delete** — `deleteSubject:123-129` soft-deletes only the subject; its allocations and lessons remain active and render in grids. *Fix: cascade-soft-delete or filter joins on subject.deletedAt.*
- **C-I2. deleteLevel orphans students/groups** — level soft-deleted but students keep levelId; groups keep references; allocations remain. *Fix: block delete while students/allocations reference it, or cascade.*

### Minor
`updateItemStatus` allows arbitrary status strings; recording upload extension-only validation; no copy-curriculum-to-next-year feature; no import/export of allocations; unbounded `GET lessons`/`GET allocations` (no pagination).

---

## 6. Student Portal & Hymn Learning

### Critical
- **P-C1. Hymn-learning routes have no ownership verification** — `hymn-learning.controller.ts:8` uses JwtAuthGuard only, no @Roles, and service (per prior audits) doesn't verify caller↔student linkage: any authenticated user (e.g. a parent) can log practice/review **for any student id**. *Fix: verify parent↔child (reuse parents.service verifyParent) or servant↔class before any student-scoped write.*

### Important
- **P-I1. portalAccessKey never rotated & widely surfaced** — uuid v4 (fine entropy) but shown in student detail modal, QR, CSV exports; no rotation/regeneration flow; leaked key = recurring 12h sessions forever. *Fix: add regenerate endpoint (admin), lastRotatedAt, optional expiry.*
- **P-I2. Practice XP double-award window** — student portal `POST :code/practice` and parent `POST me/children/:id/practice` both award XP with weekly limits enforced per-path; no shared dedupe key across paths (same lesson can be XP'd via both in one week). *Fix: shared limit keyed by (studentId, lessonId, week) in one table.*

### Minor
Recorder hardcodes `audio/webm` in practice-recorder (Safari/iOS fails — take-assessment already has `pickRecorderMime` to copy); streak timezone uses server-local day; hymn-map payload unbounded (all levels × items with resources); no rate limit on portal GETs (login is throttled 10/min — good); Arabic partially wired in portal chrome (recently improved); no offline handling.

---

## 7. Role-Matrix §3 Fixes (cross-cutting RBAC)

From `docs/ROLE-MATRIX.md` §3 — validated gaps:

1. **Priest role** — doesn't exist; `Church.responsiblePriest` is text. *Decision needed: create role or document principal as the oversight role.*
2. **Servant publish gate** — `PATCH /announcements/:id/publish` → restrict to `admin, principal, super_admin`; curriculum destructive routes per C-C1/C-C2; `GET /reports/priest-pulse` → leadership only (overlaps R-I2).
3. **assistant_servant** — hidden in frontend `ROLES` picker but fully privileged in `STAFF_ROLES`. *Decision: expose in UI or remove from STAFF_ROLES.*
4. **student User role orphaned** — document; auth is portal-key only.
5. **Row-level scoping** — `GET /students`, `GET /reports/*` return whole school to servants (overlaps R-I3).

---

## Proposed Execution Batches

### Batch 1 — Security Criticals (est. 1-2 sessions)
| # | Item | Scope |
|---|---|---|
| 1 | S-C1 school CRUD IDOR | ownership check in users.service school routes |
| 2 | S-C2 stream proxy SSRF | fail-closed + auth on recording-stream |
| 3 | R-C1 viewRole escalation | intersect viewRole with user.roles (one-liner) |
| 4 | N-C1 drafts visible to parents | status default + audience filter |
| 5 | A-C2 impersonation | restrict + submittedByUserId |
| 6 | C-C1/C-C2 hard deletes | soft-delete + role restriction |
| 7 | P-C1 hymn-learning ownership | verify linkage before writes |

### Batch 2 — RBAC Hardening (role matrix §3)
- Reports RBAC (R-I2), servant whole-school fallback (R-I3), assistant_servant decision, publish gates, SystemConfig whitelist (S-I5), school-create restriction (S-I4).

### Batch 3 — Data Correctness
- deletedAt sweep across dashboard.service + at-risk queries (R-I1), assessment unique constraint + aggregate reconciliation (A-I1/A-I4), curriculum orphan handling (C-I1/C-I2), WhatsApp regex + normalization (N-I1/N-I7).

### Batch 4 — Performance
- At-risk N+1 → window SQL + TTL cache (R-C2), getStats SQL (A-I8), indexes (XPTransaction/StudentBadge/AttendanceRecord/Notification), hymn-map payload trim.

### Batch 5 — Features/UX (pick per priority)
- Push backend (N-C2), WhatsApp opt-out (N-C3), notifications on badge/grade (N-I3), deep links + unread-count (N-I5/N-I6), reports export + drill-down + at-risk watchlist, assessment timer/due enforcement (A-I2/A-I3), portal key rotation (P-I1), scheduled announcements (N-I2), storage orphan sweeper (S-I2).

---

## Open Decisions Needed From You

1. **Impersonated assessment submit (A-C2):** keep (admin marks on behalf) or remove? If keep, audit-log it?
2. **Priest role (§7.1):** create a real role or map oversight to principal?
3. **assistant_servant (§7.3):** expose in UI or drop from STAFF_ROLES?
4. **Parent leaderboard (R6):** school-wide ranking visible to all parents — keep or scope to own children?
5. **Batch order:** agree with Security-first, or reprioritize?
