# COHEP Role-Based Investigation
**Date:** 2026-08-24 · **Method:** backend RBAC extraction (`@Roles` decorators, global guards), frontend gating audit, live walkthroughs (super_admin, parent, student-portal, servant surfaces), report data inspection.
**Evidence keys:** [C]=code reference, [L]=live-tested, [I]=inferred (validation required).

## Global enforcement model
- Guard chain: Throttler → JwtAuthGuard → RolesGuard → TenantScopeGuard (`backend/src/app.module.ts`).
- **No `@Roles` on an endpoint = any authenticated user** (`roles.guard.ts:15-17`). super_admin bypasses everything (`roles.guard.ts:22`).
- Frontend nav gating (`dashboard-shell.tsx`, `use-permission.ts`) reads role from **localStorage** — cosmetic only; server does not enforce the fine-grained `perm:` strings.

---

## 1. super_admin (level 0)
- **Purpose:** system owner; multi-school oversight, approvals, configuration. [C]
- **Allowed:** everything; bypasses all role checks; only role that can export reports, approve pending church registrations, configure gamification, delete churches/church data. [C]
- **Restricted:** should NOT routinely record attendance/grades for a school (accountability) — currently nothing stops it. [I]
- **Visible:** all schools (diocese dashboard), analytics detail, subscriber lists. [C]
- **Strengths:** clean bypass model; sensitive caps (export, approvals) correctly reserved. [C]
- **Friction:** demo-login backdoor had to be disabled via env flag after being found open (commit 6045afa); no "acting as school X" audit trail distinct from normal use. [L]
- **Safeguarding:** can read all children's data incl. assessment answers — acceptable for platform owner, but access is unlogged at row level. [I]
- **Top recs:** (1) admin-facing "data hygiene" view listing zero-activity & seed-pattern accounts; (2) audit log entries for approval/export actions.
- **Validation required:** confirm diocese report excludes other churches' PII where not needed.

## 2. admin (level 1)
- **Purpose:** run one school: users, students, staff, announcements. [C]
- **Allowed:** user CRUD (except granting admin/super), student CRUD, announcements create→publish, view reports incl. servant contributions, parents' link/unlink oversight. [C]
- **Restricted:** cannot approve new church registrations or export reports (super only) — intentional segregation. [C]
- **Friction/failure:** users list shows seed accounts indistinguishable from real staff (live: `servant01…18@niangelos.org` mixed with real servants); no bulk deactivate; no last-login column → hygiene is guesswork. [L]
- **Permission observations:** can edit ANY staff user including level_leaders of other groups — no scope-by-ministry. [C]
- **Top recs:** user-table hygiene indicators (last login, activity, seed/test flag); confirm-dialog showing consequences when editing privileged staff.

## 3. principal (level 2)
- **Purpose:** oversight/approval counterpart to admin. [C]
- **Allowed:** same read/create surface as admin per decorators; cannot delete users. [C]
- **Gap:** principal has no distinct approval workflow anywhere (announcements publish, grade changes etc. don't require principal sign-off) — the role exists but has no unique job. [C/I]
- **Top recs:** either give principal the announcement-publication and report-export approval steps (governance win), or merge the role into admin until needed.

## 4. curriculum_manager (level 3)
- **Purpose:** owns hymns/items/allocation content. [C]
- **Allowed:** full curriculum CRUD, assessments CRUD, grades. [C]
- **Friction:** indistinguishable from any servant inside Curriculum UI — no ownership concept (who edited what last is not surfaced); allocations editable by every staff role simultaneously (last-write-wins conflicts). [C]
- **Top recs:** show editor/attribution on curriculum items; restrict allocation-grid writes to curriculum_manager + group/level leaders during term time.

## 5. servant / group_leader / level_leader / assistant_servant (levels 4–7)
- **Purpose:** teach, record attendance, assess, practice together. [C/L]
- **Allowed (all four identically):** attendance sessions+records, assessments create/grade, gamification awards, announcements create/edit/delete/publish, liturgy verification. [C]
- **Restricted:** user management, reports export, settings. [C]
- **Primary journeys (live/code):** dashboard → today's session → attendance → assessments → briefing. Servant Contributions report shows their totals. [L]
- **Friction:** (a) assistant_servant has identical write powers to a group_leader — least-privilege violated by class-level `STAFF_ROLES` decorators; (b) any servant can award XP/badges to any student of the school (gamification controller), enabling favoritism with no cap or co-sign; (c) verifier==recorder possible for liturgy when roles stack. [C]
- **Safeguarding:** attendance records imply child presence data — visible to all staff school-wide via broad endpoints; consider scoping records to own group/level. [I]
- **Top recs:** differentiate assistant_servant to attendance+read-only assessments; cap/co-sign gamification awards; scope attendance reads to assigned ministry.

## 6. student (portal, level 8)
- **Purpose:** learn hymns, self-practice, take assessments. [C/L]
- **Allowed:** view own progress/hymn map/due reviews, submit assessments, upload recordings, log practice. [L]
- **Auth:** access-key → 12h session JWT (hardened this cycle). Key entropy = UUID; no rotation/expiry policy; keys printed on QR cards = long-lived bearer capability. [C/L]
- **Friction:** English-only UI despite Arabic-speaking students (hardcoded `lang='en'`); no index route (fixed); deep-link session bug (fixed). [L]
- **Privacy:** portal exposes full name, church, level; "Hide Name" toggle is client-side only. [C]
- **Top recs:** Arabic UI; key rotation button for admins; move Hide Name server-side (redact in responses).

## 7. parent (level 9)
- **Purpose:** monitor child(ren)'s attendance/assessments/progress; practice together. [C/L]
- **Allowed:** link/unlink children by student code, read child dashboards, log family practice & liturgy, term reports, milestones, notifications. [L]
- **Restricted:** no grading, no other people's children (server enforces via verifyParent). [C]
- **Friction found & fixed this cycle:** unnamed icon buttons, orphan tablist, missing h1/main, sparse-groups crash, mastery visibility (was invisible), print popup CSP. [L]
- **Governance:** relationship field (father/mother/guardian) is self-declared, never verified — safeguarding-relevant if custody matters. [I]
- **Top recs:** school-side confirmation step for guardian claims; notify the second parent when linking occurs.

## 8. guest (level 10)
- Landing page, register/login, newsletter subscribe. Analytics overview endpoint is @Public — leaks aggregate metrics publicly. [C] → require auth or make it truly non-sensitive.

---

## A. Role–permission matrix (condensed; R=read W=write A=admin-only)

| Capability | sa | adm | prin | cur-mgr | grp/lvl leader | asst | parent | student |
|---|---|---|---|---|---|---|---|---|
| Users CRUD / role grant | A | W¹ | R/W | — | — | — | — | — |
| Students CRUD | A | W | W | W | W | W | — | — |
| Attendance write | A | W | W | W | W | **W⚠** | — | — |
| Assessments create+grade | A | W | W | W | W | **W⚠** | — | own take |
| Curriculum/allocation edit | A | W | W | W | W | W⚠ | — | — |
| Gamification awards | A | W | W | — | W | **W⚠** | R | R |
| Announcements publish | A | W | W | — | W⚠ | W⚠ | R | — |
| Reports view / export | A | R / — | R / — | R | R | R | — | — |
| Approvals (churches, exports) | A | — | — | — | — | — | — | — |
| Child data (own) | — | R² | — | — | — | — | R/W³ | R/W⁴ |

¹ except granting admin/super ² via parents page roster ³ link/unlink/practice ⁴ via session token

⚠ = broader than least privilege recommends.

## B. Cross-role journey (Sunday lifecycle)
curriculum_manager publishes term allocation → level_leader assigns servants → servant runs session (attendance) → servant grades assessment → gamification XP auto/awarded → parent sees progress + practices at home → student self-practices (SM-2) → principal/admin reviews reports → super_admin exports for diocese.
**Break points found:** attribution of sessions to servants is 0 for everyone in prod (report shows zeros) → the journey's reporting leg is broken; QA/seed entities pollute every stage.

## C. Handoff & approval map
- Church registration: applicant → super_admin approves (only real approval gate). [C]
- Announcement: author=approver (same STAFF set) — gap. [C]
- Assessment: creator=grader — acceptable for class quizzes, risky for formal exams. [I]
- Liturgy verification: recorder≠verifier nominally, but stacked roles allow self-verification. [C]

## D. Duplication & bottleneck analysis
- 4× child dashboards → converged this cycle (Phase A/B/C done); remaining: shared LinkChildForm (2 variants).
- super_admin bottleneck: exports, approvals, gamification config all queue on one person.
- Seed/QA data pollutes: users list, servant report (fixed), students, attendance.

## E. Access-risk register
| # | Risk | Sev | Status |
|---|---|---|---|
| R1 | Default-open endpoints: hymn-learning, progress, search (any auth user) | Med | Open |
| R2 | Analytics overview @Public | Med | Open |
| R3 | assistant_servant == group_leader write power | Med | Open |
| R4 | Any staff awards unlimited XP/badges school-wide | Med | Open |
| R5 | Student key = permanent bearer capability (UUID, no rotation) | Med-High | Partially mitigated (session JWT) |
| R6 | Self-declared parent relationship unverified | Low-Med | Open |
| R7 | Client-trusted perm strings diverge from server truth | Low | Open |
| R8 | Verifier==recorder possible (liturgy) | Low | Open |
| R9 | Newsletter unsubscribe public per known email | Low | Open |

## F. Shared vs role-specific capabilities
Shared (fine): auth, notifications, language, hymn audio player, TakeAssessment component.
Should-be-scoped: attendance reads, child lists, gamification writes.
Role-specific (keep): approvals/exports (super), curriculum ownership (cur-mgr), family practice (parent), SM-2 practice (student).

## G. Sequenced roadmap
1. **Now (data governance):** mark/deactivate seed accounts; add last-login + activity columns; keep zero-activity filter on reports (done).
2. **Next (least privilege):** narrow assistant_servant; scope attendance/child reads to own ministry; add @Roles to hymn-learning/progress/search; auth the analytics overview.
3. **Then (governance):** principal approval step for announcements/formal-exam grades; gamification award caps; verifier≠recorder check.
4. **Later:** student key rotation UX; verified-guardian flow; Arabic student portal; server-side redaction for Hide Name.
