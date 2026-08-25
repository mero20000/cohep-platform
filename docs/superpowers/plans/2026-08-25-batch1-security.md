# Batch 1 — Security Criticals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Close the 7 security criticals from the platform audit (plus leaderboard scoping per decision 4).

**Architecture:** Small, targeted fixes — each item is one service/controller file change + test. No schema changes except where noted.

**Tech Stack:** NestJS + Prisma, Jest.

## Global Constraints

- Backend tests must stay green: `npx jest --runInBand` (268 baseline) + `npx tsc --noEmit`.
- Follow existing code style per file; no drive-by reformatting.
- Do NOT push — commit locally on main; controller pushes at the end.
- Every fix needs a regression test where the code path is testable in unit scope.

---

### Task 1: School CRUD IDOR (S-C1)

**Files:**
- Modify: `backend/src/modules/users/users.service.ts` (getSchool, updateSchool, deleteSchool)
- Test: `backend/src/modules/users/users.service.spec.ts` (create if absent, following existing spec patterns)

**Fix:** `getSchool(id, requestingUser?)`, `updateSchool(id, data, requestingUser?)`, `deleteSchool(id, requestingUser?)` — after loading the school, if `requestingUser` is not super_admin and `school.id !== requestingUser.schoolId`, throw NotFoundException. Update controller routes (`users.controller.ts:68-87`) to pass `req.user`.

- [ ] Write failing test (admin of school A cannot get/update/delete school B)
- [ ] Implement ownership checks + pass req.user from controller
- [ ] Tests pass, commit `fix(security): school CRUD cross-tenant IDOR`

### Task 2: Stream proxy SSRF (S-C2)

**Files:**
- Modify: `backend/src/modules/curriculum/recording-stream.controller.ts`

**Fix:** (a) If `CLOUDFLARE_R2_PUBLIC_URL` unset → 503 "Storage not configured" BEFORE any fetch (currently allowHost='' disables allowlist). (b) Require JWT auth: remove `@Public()`, add `@UseGuards(JwtAuthGuard)` — students use portal key so add portal JWT acceptance OR keep public but ONLY allow bare R2 keys (never absolute URLs) when unauthenticated. Preferred: require auth for absolute-URL src; bare keys stay public (portal needs them). Implement: if `src` is absolute URL → must have valid staff/parent JWT; if bare key → allowed public (host derived from configured R2 URL only). (c) Reject when R2 not configured regardless.

- [ ] Implement fail-closed + auth-for-absolute-URLs
- [ ] Test: unauthenticated absolute URL → 401; unauthenticated bare key → works when configured; unset R2 → 503
- [ ] Commit `fix(security): recording stream fail-closed + auth for absolute URLs`

### Task 3: viewRole escalation (R-C1)

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.service.ts:250-270` (getMine)

**Fix:** `const requested = viewRole || roles[0]; if (viewRole && !roles.includes(viewRole)) throw new ForbiddenException('Invalid viewRole');` — one-line intersect. Parent calling viewRole=admin → 403.

- [ ] Test: caller with roles ['parent'] + viewRole='admin' → ForbiddenException
- [ ] Implement, commit `fix(security): dashboard viewRole privilege escalation`

### Task 4: Draft announcements visible to parents (N-C1)

**Files:**
- Modify: `backend/src/modules/announcements/announcements.service.ts` (findAll:155-186, findOne:188-195)
- Modify: `backend/src/modules/announcements/announcements.controller.ts` (pass req.user)

**Fix:** In findAll — if caller lacks staff roles, force `status='published'` and filter `targetAudience`: if `targetAudience !== 'all'`, only return when caller's roles intersect `targetRoles` (schema fields `targetAudience`, `targetRoles`). In findOne — non-staff get 404 unless `status==='published'`. Staff (STAFF_ROLES) see all.

- [ ] Test: parent findAll excludes drafts; parent findOne draft → 404; staff sees drafts
- [ ] Implement, commit `fix(security): block parents from draft/unfiltered announcements`

### Task 5: Assessment impersonation audit + restrict (A-C2, decision 1: KEEP)

**Files:**
- Modify: `backend/src/modules/assessments/assessments.controller.ts:101-107, 164-171` (submit, getTakeQuestions studentId paths)
- Modify: `backend/src/modules/assessments/assessments.service.ts` (submit signature + AuditLog write)

**Fix:** Restrict proxy-submit (explicit studentId different from caller context) to `['servant','group_leader','level_leader','curriculum_manager','principal','admin','super_admin']` (exclude assistant_servant per decision 3 keep-as-is? — decision 3 says keep assistant_servant AS IS, i.e. still full STAFF powers, so include it: use STAFF_ROLES). Write AuditLog row `{action:'PROXY_SUBMIT', entityType:'assessment_submission', entityId, userId: req.user.id, newValues:{studentId, assessmentId}}` on every proxied submit. Add `submittedByUserId` to submission metadata if cheap (metadata Json exists) — optional.

- [ ] Test: staff proxy submit creates audit row; parent/student role cannot proxy submit
- [ ] Implement, commit `fix(security): assessment proxy-submit audited + staff-only`

### Task 6: Curriculum hard deletes (C-C1, C-C2)

**Files:**
- Modify: `backend/src/modules/curriculum/curriculum.controller.ts:162-177, 270-275` (@Roles on academic-years/:id DELETE, allocations DELETE, lessons/:id DELETE)
- Modify: `backend/src/modules/curriculum/curriculum.service.ts` (deleteAcademicYear:452, deleteLesson:590, deleteLevel:379 cross-school check)

**Fix:** (a) `DELETE academic-years/:id` and `DELETE lessons/:id` → `@Roles('curriculum_manager','principal','admin','super_admin')`. (b) `deleteAcademicYear` → soft-delete pattern: add `deletedAt DateTime?` to AcademicYear model if absent (check schema first — if absent, add migration `20260825000000_academic_year_deleted_at`), filter `deletedAt: null` in getAcademicYears. (c) `deleteLesson` → soft-delete (Lesson likely has deletedAt? check schema; if absent add) + block when CurriculumAllocation references it (BadRequest 'Unlink allocations first'). (d) All three deletes + `deleteLevel` + `reorderAllocations`: verify record.schoolId matches resolved/requesting school, else NotFoundException.

- [ ] Schema check + migration if needed
- [ ] Tests: servant cannot delete academic-year/lesson (403); cross-school delete → 404; lesson with allocation → 400
- [ ] Commit `fix(security): curriculum destructive routes — soft-delete, RBAC, cross-school check`

### Task 7: Hymn-learning ownership (P-C1)

**Files:**
- Modify: `backend/src/modules/curriculum/hymn-learning.controller.ts` + its service (all student-scoped writes: practice log, review)

**Fix:** For every write taking a studentId: if caller has parent role → verify linkage via StudentParent (reuse pattern from parents.service.verifyParent); if servant roles → verify student's groupId/levelId ∈ caller's assignment metadata (reuse resolveServantSessionGroupIds pattern or simpler: student.groupId === caller.metadata.groupId OR caller has admin/principal/super_admin → allow). Admin/principal/super_admin bypass. Reject others with ForbiddenException.

- [ ] Test: parent logging practice for unrelated student → 403; for own child → OK; servant for own group → OK
- [ ] Implement, commit `fix(security): hymn-learning student-scoped writes verify ownership`

### Task 8: Leaderboard scoped to own children (decision 4)

**Files:**
- Modify: `backend/src/modules/gamification/gamification.controller.ts:20-27` (getLeaderboard) + service getLeaderboard

**Fix:** When caller is parent-only (has 'parent' and no staff roles): return top 3 (school-wide, minimal fields: rank, firstName, lastInitial, xp — NO photos) + caller's own children with full rank. Add `?scope=children` handling server-side; ignore client scope param from parents. Staff unchanged.

- [ ] Test: parent-only caller gets top3 + own children, no photos of others
- [ ] Implement, commit `feat(security): leaderboard scoped for parents — top3 + own children`
