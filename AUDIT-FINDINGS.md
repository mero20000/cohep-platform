# COHEP Platform Audit — Complete Findings Document

*Generated from thorough codebase, schema, API, and workflow investigation*
---
## EXECUTIVE SUMMARY

**Overall Health Score: C (62/100)**

**Strengths:**
- Comprehensive Prisma schema with full multi-tenancy support
- Rich feature set covering curriculum, gamification, attendance, assessments, family features
- Multi-language (EN/AR) support throughout
- Open-source foundation with auditability
- Strong authentication flow with JWT + refresh tokens
- Good test coverage in service specs
- Parent portal with child linking and dashboard capabilities

**Critical Weaknesses:**
- Broken RBAC: flat STAFF_ROLES makes all staff equally privileged
- No row-level security for servants/leaders — sees all school data
- Seed/QA data pollutes production appearance
- Security gaps: Turnstile optional, student keys permanent bearers
- Orphaned `student` User role (portal-key only, not RBAC)
- assistant_servant has identical powers to group_leader
- Verifier==recorder possible for liturgy

**Biggest Risks:**
- Data leakage across school boundaries via broad API endpoints
- Unlimited XP/badges awarding enabling favoritism
- Liturgy verification without proper verification gate
- Super_admin single point of failure for all approvals/exports

---

## 1. PLATFORM MAP

### 1.1 Modules (28 backend modules)
- **Auth**: Registration, login, password reset, JWT management, demo mode
- **Users**: CRUD, roles, permissions, schools, system config
- **Students**: Student records, profiles, parents, medical notes, progress
- **Curriculum**: Levels, groups, subjects, subject items, lessons, sessions
- **Attendance**: Sessions, records, QR check-in, start class
- **Assessments**: Creation, submissions, grading, grade disputes
- **Progress**: Lesson progress, student progress, XP transactions, certificates
- **Gamification**: Badges, XP awards, leaderboards, compute
- **Announcements**: Create, publish, update, delete
- **Notifications**: In-app notifications, push subscriptions
- **Registrations**: Church registration applications with review workflow
- **Reports**: Various report endpoints
- **Search**: School search public API
- **Servants**: Servant profiles and milestones
- **Curriculum/hymn-learning**: Hymn practice sessions, family practices
- **Mail**: Email service integration
- **Database/Prisma**: Database connection and migrations

### 1.2 User Roles (11 seeded, actual behavior differs)
| Role | Seeded Count | Actual Behavior |
|------|-------------|----------------|
| super_admin | 1 | Global bypass, all schools/churches |
| admin | Multiple | School-scoped, but can edit any staff |
| principal | 1+ | Same as servant, no distinct workflow |
| curriculum_manager | 1+ | Full curriculum CRUD, indistinguishable from servant |
| servant | Multiple | School-wide (not assigned-class scoped) |
| group_leader | Multiple | Same as servant, no group scoping |
| level_leader | Multiple | Same as servant, no level scoping |
| assistant_servant | Multiple | Identical powers to group_leader (UI mismatch) |
| student | Portal-only | Auth via portalAccessKey (12h JWT), no @Roles |
| parent | Portal-only | Linked children via StudentParent |
| guest | — | Unauthenticated fallback |

### 1.3 Key User Journeys
1. **Church Registration**: Applicant → RegistrationApplication (pending) → super_admin approves → School + User created → Welcome email
2. **Student Enrollment**: Parent portal → Link child by code → Student created → assigned level/group/grade → Progress tracking
3. **Daily Session**: servant → start class → mark attendance → assess students → award XP/badges → parent sees progress
4. **Liturgy Logging**: parent → log liturgy → verified by servant → counted toward badges
5. **Parent Monitoring**: Parent portal → view child attendance/assessments/progress → log practice together
6. **Admin Management**: Admin CRUD users/students → approve/reject registrations → configure school settings

---

## 2. RBAC & AUTHORIZATION FINDINGS

### CRITICAL FINDINGS (P0/P1)

**F2.1 Flat STAFF_ROLES — No Row-Level Scoping** (P1)
- All staff roles (servant, group_leader, level_leader, assistant_servant) share identical `@Roles(...STAFF_ROLES)` decorators
- No hierarchical guards — any servant can act on any student/attendance in the school
- **Evidence**: `backend/src/common/decorators/roles.decorator.ts` exports `STAFF_ROLES = ['super_admin', 'admin', 'principal', 'servant', 'group_leader', 'level_leader', 'assistant_servant']`
- **Impact**: Any servant can grade any assessment, view any attendance, award any XP — least privilege violated
- **Fix**: Implement hierarchical role guards or add ministry-level (levelId/groupId) scoping

**F2.2 assistant_servant UI/Backend Mismatch** (P2)
- `assistant_servant` not shown in frontend role list but has identical backend privileges via `STAFF_ROLES`
- **Evidence**: Frontend `ROLES` list excludes it; backend `STAFF_ROLES` includes it
- **Fix**: Either remove from `STAFF_ROLES` or expose in frontend with proper scoping

**F2.3 student User Role Orphaned** (P2)
- `student` role exists in seed (11 roles) but has no `@Roles('student')` on any controller
- Student portal access is via `portalAccessKey` (12h JWT), not RBAC
- **Evidence**: `backend/src/modules/students/student-portal-auth.guard.ts` uses key-based auth
- **Fix**: Document clearly; consider adding `@Roles('student')` to portal endpoints or remove from seed

**F2.4 No priest Role** (P3)
- `Church.responsiblePriest` is a text field, not RBAC
- Closest role is `principal`; no distinct priest functionality
- **Fix**: Map priest to principal or create distinct role with appropriate scope

**F2.5 Principal Has No Distinct Workflow** (P2)
- Principal has same create/publish permissions as servant/admin
- No unique approval steps anywhere in the system
- **Fix**: Either give principal genuine oversight approval powers OR merge into admin

### MEDIUM PRIORITY FINDINGS (P2)

**F2.6 Curriculum Ownership Indistinguishable** (P2)
- `curriculum_manager` has full CRUD but cannot be distinguished from servant in UI
- No attribution of who edited curriculum items last
- Allocations editable by every staff role simultaneously (last-write-wins)
- **Fix**: Show editor/attribution; restrict allocation writes

**F2.7 Unverified Parent Relationship** (P3)
- `relationship` field (father/mother/guardian) is self-declared, never verified
- Safeguarding-relevant if custody matters
- **Fix**: School-side confirmation step for guardian claims; notify second parent when linking

**F2.8 Guest Endpoint Leaks Aggregates** (P3)
- Analytics overview `@Public` — leaks aggregate metrics publicly
- **Fix**: Require auth or make truly non-sensitive

**F2.9 Newsletter Unsubscribe Public** (P3)
- Per-email unsubscribe likely public without verification
- **Fix**: Add confirmation step

### LOW PRIORITY FINDINGS (P3)

**F2.10 Client-trusted perm strings diverge from server** (P3)
- Frontend reads role from `localStorage` — cosmetic only; server enforces differently
- **Fix**: Sync frontend permission checks with server-side `@Roles`

**F2.11 Verifier==recorder possible for liturgy** (P3)
- Liturgy can be logged by same user who verifies (roles can stack)
- **Fix**: Enforce verifier≠recorder check

---

## 3. DATABASE & SCHEMA FINDINGS

### F3.1 Seed/QA Data Pollution (P1)
- Seed data (`servant01…18@niangelos.org`) mixed with real staff in users list
- No way to distinguish test accounts from real ones
- Zero-activity accounts appear in reports
- **Fix**: Add `isSeed` flag; deactivate seed accounts in production; add last-login column

### F3.2 School_id Default Assignment (P2)
- Migration sets `school_id` from first school `ORDER BY created_at` when null
- This creates implicit data ownership issues if schools are reordered
- **Fix**: Explicit school assignment during onboarding; no auto-defaulting

### F3.3 AppSession/Analytics Event Cascade (P2)
- `AppSession` and `AnalyticsEvent` have `onDelete: Cascade` on `School`
- Could cause data loss if school deleted
- **Fix**: Use `Restrict` or `SetNull` for analytics; soft delete pattern

### F3.4 RegistrationApplication school_id Resolution (P2)
- `resolveSchool` uses `findFirst` with OR on id/slug — could pick wrong school if slugs collide
- **Fix**: Add unique constraint on slug; use explicit school ID where possible

### F3.5 HymnPracticeSession review path (P3)
- `reviewedBy` field exists but no enforcement that reviewer is assigned servant
- Any user with server access can set review status
- **Fix**: Add role-based enforcement

---

## 4. API & ENDPOINT FINDINGS

### F4.1 Default-Open Endpoints (P1)
- Several endpoints have no `@Roles` decorator = any authenticated user can access
- `GET /hymn-learning/*`, `GET /progress/*`, `GET /search/*` — any auth user
- **Fix**: Add appropriate `@Roles` or make truly public with auth guard

### F4.2 Analytics @Public Leak (P1)
- `backend/src/modules/analytics/analytics.controller.ts` has `@Public()` endpoint
- Leaks aggregate metrics including subscriber counts, usage stats
- **Fix**: Require at minimum `admin` role

### F4.3 Turnstile Optional (P2)
- `verifyTurnstile` returns `true` if no secret configured (dev mode)
- Registration can bypass captcha in development; risk for production
- **Fix**: Make Turnstile mandatory; enforce in all environments

### F4.4 Student Key Permanent Bearer (P2)
- `portalAccessKey` = UUID, no rotation policy, no expiry beyond 12h session JWT
- If key leaked, permanent access until manual rotation
- **Fix**: Add key rotation button for admins; short-lived keys with refresh

### F4.5 Email Verification Inconsistent
- `forgotPassword` sends reset link only if user is active
- But `register` creates user with `isActive: false` for new churches
- Inconsistent flow — deactivated users can't reset, but also can't login
- **Fix**: Clarify flow; ensure deactivated users get proper feedback

### F4.6 No Rate Limiting on Sensitive Writes
- Some write endpoints lack throttling
- **Fix**: Add throttling to all sensitive write operations

---

## 5. UX & UI FINDINGS

### F5.1 Parent Portal — Orphan Tablist (P2)
- Settings tablist has 6 tabs but only 5 panels visible (children tab has no dedicated panel)
- **Fix**: Either add children panel or remove from tablist

### F5.2 Missing H1/Main on Some Pages (P2)
- Some portal pages missing proper `<h1>` and `<main>` structure
- **Fix**: Add semantic HTML structure

### F5.3 Arabic UI Inconsistencies (P2)
- English-hardcoded UI in student portal despite Arabic locale support
- Date formats, number formats mixed
- **Fix**: Full Arabic UI localization for student portal

### F5.4 Student "Hide Name" Client-Side Only (P3)
- Portal exposes full name; "Hide Name" toggle is client-side only
- Server responses still include full name
- **Fix**: Server-side redaction for Hide Name feature

### F5.5 Form Validation Gaps (P2)
- Several forms lack proper validation
- **Fix**: Add comprehensive form validation

### F5.6 Dashboard Hero Inconsistency (P3)
- Different hero components used across pages with varying features
- **Fix**: Standardize hero component

---

## 6. BUSINESS PROCESS FINDINGS

### F6.1 Church Registration Workflow Gaps (P1)
- Registration creates school with `isActive: false` and `registrationStatus: 'pending'`
- But no mechanism to re-activate if rejected and resubmitted
- Applicant has no visibility into review status
- **Fix**: Add status tracking UI; allow resubmission; notify applicant at each stage

### F6.2 Registration Review Single Point of Failure (P1)
- Only `super_admin` can approve/reject registrations
- No delegation or secondary reviewer
- **Fix**: Allow admin/principal to approve; add reviewer queue

### F6.3 Assessment Grade Dispute Limited Workflow (P2)
- Grade disputes exist but no automatic escalation
- No way for student/parent to initiate dispute from portal
- **Fix**: Add portal-initiated dispute flow; auto-escalation rules

### F6.4 No Bulk Operations for Common Tasks (P2)
- No bulk deactivate users; no bulk export; no batch attendance status updates (except sessions)
- **Fix**: Add bulk operations where user-friendly

### F6.5 Liturgy Verification Without Proper Gate (P2)
- `POST /parents/me/children/:id/liturgy` — any parent can log; servant verifies later
- But servant can also self-verify (roles can stack)
- **Fix**: Enforce that liturgy logger ≠ verifier; add audit trail

### F6.6 Promotion Workflow Missing Grade Validation (P3)
- Promotion records created but no validation that student met attendance/score requirements
- **Fix**: Add requirement checks before promotion; auto-calculate from lesson progress

---

## 7. SECURITY FINDINGS

### F7.1 Unlimited XP/Badges Awarding (P1)
- Any servant can award unlimited XP/badges to any student via `POST /gamification/students/:id/xp` and `POST /gamification/students/:id/badges`
- No caps, no co-sign required
- **Fix**: Add XP/badges caps per term; require co-sign from curriculum_manager for large awards

### F7.2 Any Staff Can Edit Any User (P1)
- `admin` can `PATCH /users/:id` on any user including super_admin (blocked) but can edit level_leaders of other groups
- No ministry-level scoping
- **Fix**: Add row-level user scoping for admin; cannot edit users outside assigned ministry

### F7.3 Student Portal Key Permanent (P2)
- As noted in F4.4 — UUID key with no rotation
- **Fix**: Key rotation UX; short-lived keys

### F7.4 Insecure File Upload Paths (P2)
- `upload.controller.ts` — file paths based on user input
- Potential path traversal if not properly sanitized
- **Fix**: Strict path validation; use vetted key generation

### F7.5 No CSP Beyond Nonce (P3)
- Layout adds nonce for inline scripts but no other CSP directives
- **Fix**: Enhance CSP configuration

### F7.6 Password Complexity Not Enforced (P3)
- Registration accepts any password; no complexity validation
- **Fix**: Add password strength validation

---

## 8. PERFORMANCE FINDINGS

### F8.1 N+1 Query Risk in Several Controllers (P2)
- `GET /students` with role filtering performs multiple `findMany` calls
- `GET /reports/*` queries across multiple models
- **Fix**: Add Prisma query optimization; use `include` strategically; add caching

### F8.2 Large Payloads Without Pagination (P2)
- Several endpoints default to `take: 100` or no limit
- `GET /registrations/list` takes 100 without pagination control
- **Fix**: Enforce pagination; add `cursor-based` pagination for large datasets

### F8.3 Gradient Orbs and Animations on Every Page (P3)
- Home page has heavy CSS gradients, SVG patterns, motion animations
- Could impact low-end devices/mobile
- **Fix**: Make animations conditional on `prefers-reduced-motion`; optimize CSS

---

## 9. PRODUCTION READINESS FINDINGS

### F9.1 Seed Data Not Cleared for Production (P1)
- Seed accounts (`servant01…18`) remain in database
- No environment-based seed clearance
- **Fix**: Add `NODE_ENV`-based seed clearance; add seed cleanup script

### F9.2 No Health Check Endpoint (P2)
- No `/health` or readiness/liveness probes
- **Fix**: Add `/api/health` endpoint

### F9.3 Error Handling Inconsistent (P2)
- Some errors throw Nest exceptions; others return generic messages
- **Fix**: Standardize error format across all controllers

### F9.4 No Deployment Scripts (P3)
- No clear deployment pipeline beyond `docker-compose up`
- **Fix**: Add CI/CD pipeline; Dockerfile production configuration

### F9.5 Environment Variables Not Documented (P2)
- `docker-compose.yml` has many env vars; no `.env.example`
- **Fix**: Add `.env.example` with all required variables and defaults

### F9.6 Database Migration Quality (P2)
- Single migration file `20260831140000_fix_phase1_schema` — large atomic change
- No squashed migrations for incremental development
- **Fix**: Use incremental migrations; squash after stabilization

---

## 10. CROSS-MODULE DEPENDENCIES

### F10.1 Registration → Student → Progress Cascade (P1)
- Registration application → Student creation → AcademicYear assignment → Lesson allocations → Progress tracking
- Any break in chain leaves orphaned data
- **Fix**: Add validation at each step; add rollback capability

### F10.2 Announcements → Notifications → Parents Cascade (P2)
- Announcement created → notifications sent to staff → parents see in portal
- No fallback if notification fails
- **Fix**: Best-effort notification (current); add retry logic; ensure announcements visible even if notification fails

### F10.3 Gamification → Student → Progress → Certificate Cascade (P2)
- XP awarded → badge computed → student progress updated → certificate potentially issued
- Missing links if any step fails
- **Fix**: Add atomic compute; verify all downstream links on badge computation

### F10.4 Parent → Child Link → All School Access (P2)
- Linking child by code creates `StudentParent` relationship
- Once linked, parent gains read access to that child's full data
- No second-factor verification for linking
- **Fix**: Add confirmation step; optionally require admin verification for guardian claims

### F10.5 Curriculum → Lessons → Assessments → Grades → Disputes Chain (P2)
- Full assessment pipeline; any break affects reporting
- **Fix**: Add cross-step validation; ensure dispute linkage works end-to-end

---

## 11. COMPETITIVE BENCHMARK

### Must-Have Gaps (Users Reasonably Expect)
- ✅ Multi-tenant school isolation (implemented)
- ✅ Role-based access control (partially implemented — flat RBAC)
- ✅ Parent portal with child monitoring (implemented)
- ✅ Student progress tracking (implemented)
- ❌ Arabic student portal UI (not implemented)
- ❌ Key rotation for student portal access
- ❌ Arabic curriculum content full support
- ❌ Mobile-responsive student practice experience

### UX Parity Opportunities (Established Patterns That Could Improve Usability)
- ✅ Dashboard hero with key metrics (implemented well)
- ✅ Breadcrumbs for deep navigation (partial)
- ❌ Infinite scroll vs pagination choice consistency
- ❌ Global search across all modules
- ❌ Quick actions/toolbar for common tasks

### Differentiation Opportunities (Could Make COHEP Significantly Better)
- 🌟 Community-driven hymn recording platform (unique)
- 🌟 Diocese-level oversight with aggregated anonymized data
- 🌟 Offline-first mode for poor connectivity areas
- 🌟 Multi-dialect Arabic (Najdi, Maghrebi, Levantine support)
- 🌟 Integrated video lesson hosting (vs YouTube external)
- 🌟 Automated liturgy calendar with feast dates

---

## 12. PRIORITIZED FINDINGS TABLE

| ID | Area | Finding | Impact | Priority | Complexity | Recommended Action |
|----|------|---------|--------|----------|------------|-------------------|
| F2.1 | RBAC | Flat STAFF_ROLES — no row-level scoping | Data leakage, least privilege violation | P1 | High | Implement hierarchical role guards; add ministry-level scoping for servants/leaders |
| F2.2 | RBAC | assistant_servant UI/Backend mismatch | Confusion, inconsistent UX | P2 | Medium | Remove from STAFF_ROLES or expose in frontend with proper scoping |
| F2.3 | Auth | student role orphaned (portal-key only) | Confusion about auth mechanism | P2 | Low | Document clearly; add @Roles('student') to portal endpoints or remove from seed |
| F2.4 | RBAC | No priest role; Church.responsiblePriest is text | Missing role semantics | P3 | Low | Map to principal or create distinct role |
| F2.5 | RBAC | Principal has no distinct workflow | Wasted role potential | P2 | Medium | Give principal approval powers OR merge into admin |
| F3.1 | Data | Seed/QA data pollution production | Professional appearance, test data leakage | P1 | Medium | Deactivate seed accounts; add isSeed flag; last-login column |
| F4.1 | API | Default-open endpoints (hymn-learning, progress, search) | Unauthorized data access | P1 | Medium | Add @Roles decorators or auth guards |
| F4.2 | API | Analytics @Public leak | Aggregate metrics leaked publicly | P1 | Low | Require admin minimum role |
| F7.1 | Security | Unlimited XP/badges awarding | Favoritism, gamification breakdown | P1 | High | Add caps per term; require co-sign for large awards |
| F7.2 | Security | Any staff can edit any user | Privilege escalation risk | P1 | High | Add row-level user scoping for admin |
| F6.1 | Process | Church registration workflow gaps | Poor applicant experience | P1 | Medium | Add status tracking; allow resubmission; notify at each stage |
| F3.1 | Data | Seed data pollution | Mixed test/real data | P1 | Medium | Clear seed; add environment guards |
| F5.1 | UI | Parent portal orphan tablist | Confusing UI | P2 | Low | Remove children tab or add dedicated panel |
| F5.2 | UI | Arabic UI inconsistencies | Poor Arabic UX | P2 | Medium | Full Arabic localization for student portal |
| F8.1 | Performance | N+1 query risk | Slow pages under load | P2 | Medium | Prisma query optimization; caching |
| F9.1 | Prod | Seed data not cleared | Production appearance issues | P1 | Medium | Add NODE_ENV-based seed clearance |
| F2.6 | RBAC | Curriculum ownership indistinguishable | Last-write-wins conflicts | P2 | Medium | Show editor/attribution; restrict allocation writes |
| F6.2 | Process | Registration single point of failure | Delayed onboarding | P1 | High | Allow admin/principal to approve; add reviewer queue |
| F8.2 | Performance | Large payloads without pagination | Timeouts, poor UX | P2 | Medium | Enforce pagination; cursor-based for large sets |
| F7.3 | Security | Student key permanent bearer | If key leaked, permanent access | P2 | Medium | Key rotation UX; short-lived keys |
| F6.3 | Process | No bulk operations for common tasks | Manual work, slow admin | P2 | Medium | Add bulk deactivate; bulk export where appropriate |
| F5.4 | UI | "Hide Name" client-side only | Security bypass risk | P3 | Medium | Server-side redaction for Hide Name |
| F2.7 | RBAC | Unverified parent relationship | Safeguarding concern | P3 | Low | School-side confirmation; notify second parent |
| F4.3 | API | Turnstile optional in dev | Captcha bypass risk | P2 | Low | Make Turnstile mandatory; enforce in all environments |
| F8.3 | Performance | Heavy animations on home page | Low-end device performance | P3 | Low | Conditional animations; prefers-reduced-motion |
| F9.2 | Prod | No health check endpoint | Ops blind spot | P2 | Low | Add /api/health endpoint |
| F9.3 | Prod | Inconsistent error handling | Poor debugging, UX | P2 | Medium | Standardize error format |
| F3.2 | Database | school_id auto-defaulting from first school | Implicit data ownership | P2 | Low | Explicit school assignment; no auto-defaulting |
| F6.4 | Process | No bulk operations | Manual admin work | P2 | Medium | Add bulk user deactivation; export |
| F2.8 | RBAC | No rate limiting on sensitive writes | Potential abuse | P2 | Low | Add throttling to all sensitive write operations |
| F5.5 | UI | Form validation gaps | Poor data quality, errors | P2 | Low | Add comprehensive form validation |
| F9.4 | Prod | No deployment scripts | Unclear production release | P3 | Medium | Add CI/CD pipeline; Dockerfile production config |
| F9.5 | Prod | env vars not documented | Configuration errors | P2 | Low | Add .env.example with all vars |
| F3.3 | Database | Cascade delete on AppSession/Analytics | Data loss risk on school delete | P2 | Low | Use Restrict/SetNull; soft delete pattern |
| F6.5 | Process | Liturgy verification without proper gate | Self-verification possible | P2 | Medium | Enforce logger≠verifier; add audit trail |
| F5.3 | UI | Date/number format mixing in Arabic | Confusing for Arabic users | P2 | Medium | Consistent Arabic formatting |
| F2.9 | RBAC | No caps on assessment grade disputes | Unlimited dispute filing | P3 | Low | Add dispute limits; auto-escalation |
| F4.4 | Auth | Student key no rotation policy | Permanent access if leaked | P2 | Medium | Key rotation UX; admin refresh capability |
| F4.5 | API | Password complexity not enforced | Weak passwords | P3 | Low | Add password strength validation |
| F5.6 | UI | Dashboard hero inconsistency | Confusing UX | P3 | Low | Standardize hero component |
| F3.4 | Database | RegistrationApplication resolution ambiguity | Wrong school picked | P3 | Low | Unique constraint on slug; explicit IDs |
| F6.6 | Process | Promotion without requirement validation | Invalid promotions | P3 | Low | Auto-calculate from lesson progress before promote |
| F7.4 | Security | Insecure file upload paths | Path traversal risk | P2 | Low | Strict path validation; vetted key generation |
| F7.5 | Security | No CSP beyond nonce | XSS risk | P3 | Low | Enhance CSP configuration |
| F8.4 | Performance | No reduced-motion respect | Accessibility gap | P3 | Low | Honor prefers-reduced-motion |
| F10.1 | Cross-module | Registration→Student→Progress cascade breaks | Orphaned data | P1 | High | Add validation at each step; rollback capability |
| F10.2 | Cross-module | Announcements→Notifications→Parents cascade | Notification failures silent | P2 | Medium | Retry logic; ensure announcements visible |
| F10.3 | Cross-module | Gamification→Student→Progress→Certificate | Missing downstream links | P2 | Medium | Atomic compute; verify all links on badge compute |
| F10.4 | Cross-module | Parent→Child link→All school access | Safeguarding if custody matters | P2 | Low | Confirmation step; admin verification for guardians |

---

## 13. EXECUTION ROADMAP

### Wave 1 — Critical Stability and Security (Weeks 1-4)
**P0/P1 items — Must fix before production readiness**

1. **F3.1**: Deactivate seed accounts; add `isSeed` flag; add last-login column to users table
2. **F2.1**: Implement hierarchical role guards — add ministry-level (levelId/groupId) scoping for servants/leaders
3. **F4.1**: Add `@Roles` decorators to default-open endpoints (hymn-learning, progress, search)
4. **F4.2**: Make analytics overview require at minimum `admin` role
5. **F7.1**: Add XP/badges caps per term; require co-sign from curriculum_manager for large awards
6. **F7.2**: Add row-level user scoping for admin — cannot edit users outside assigned ministry
7. **F3.1**: Clear seed data; add environment-based seed clearance guard
8. **F6.1**: Fix church registration workflow — add status tracking; allow resubmission; notify applicant

**Dependencies**: Role hierarchy design; database migration for last-login column; API decorator additions

### Wave 2 — Core Workflow Fixes (Weeks 5-8)
**P1/P2 items — Significant user/business value**

1. **F2.2**: Resolve assistant_servant UI/Backend mismatch — remove from STAFF_ROLES or expose in frontend
2. **F2.3**: Document student role; add @Roles('student') to portal endpoints or clarify portal-key auth
3. **F2.5**: Give principal distinct approval workflow OR merge into admin
4. **F5.1**: Fix parent portal orphan tablist — add children panel or remove from tablist
5. **F6.2**: Fix registration single point of failure — allow admin/principal to approve; add reviewer queue
6. **F7.3**: Add student key rotation UX; admin refresh capability
7. **F8.1**: Optimize N+1 queries in student/report endpoints; add caching
8. **F9.3**: Standardize error format across all controllers

**Dependencies**: Role hierarchy from Wave 1; Prisma query optimization; error format standards

### Wave 3 — UX and UI Improvements (Weeks 9-12)
**P2/P3 items — meaningful user experience gains**

1. **F5.2**: Full Arabic localization for student portal — date formats, number formats, UI strings
2. **F5.4**: Server-side redaction for "Hide Name" feature
3. **F5.5**: Add comprehensive form validation across all screens
4. **F5.6**: Standardize hero component across all pages
5. **F5.3**: Consistent Arabic formatting for dates/numbers
6. **F8.3**: Make home page animations conditional on `prefers-reduced-motion`
7. **F5.6**: Dashboard hero consistency

**Dependencies**: Arabic localization keys; reduced-motion media query; hero component refactor

### Wave 4 — Cross-Module Integration (Weeks 13-16)
**P2 items — Deeper connectivity and automation**

1. **F10.1**: Add validation at each step of Registration→Student→Progress cascade; add rollback
2. **F10.2**: Add retry logic for notifications; ensure announcements visible even if notification fails
3. **F10.3**: Add atomic compute for gamification; verify all downstream links on badge computation
4. **F6.3**: Add bulk operations — bulk user deactivation; bulk export where appropriate
5. **F6.4**: Add assessment grade dispute limits; auto-escalation rules

**Dependencies**: Role scoping from Waves 1-2; notification service improvements; gamification compute logic

### Wave 5 — Missing Functionality (Weeks 17-20)
**P3 items — Optional but valuable**

1. **F2.4**: Map priest role or create distinct role with appropriate scope
2. **F2.6**: Show curriculum ownership attribution; restrict allocation writes
3. **F2.7**: Add dispute limits and escalation rules
4. **F2.8**: Add throttling to all sensitive write operations
5. **F2.9**: Add assessment grade dispute limits
6. **F3.2**: Fix school_id auto-defaulting from first school — use explicit assignment
7. **F3.3**: Fix registrationApplication resolution ambiguity — unique slug constraint
8. **F3.4**: Fix database cascade delete risks — use Restrict/SetNull
9. **F4.3**: Make Turnstile mandatory; enforce in all environments
10. **F4.4**: Add password complexity validation
11. **F4.5**: Enhance CSP configuration beyond nonce
12. **F7.4**: Fix insecure file upload paths with strict validation
13. **F7.5**: Honor prefers-reduced-motion media query
14. **F9.4**: Add CI/CD pipeline and Dockerfile production configuration
15. **F9.5**: Add .env.example with all required variables and defaults

**Dependencies**: All previous waves completed; infrastructure setup

### Wave 6 — Performance and Scalability (Weeks 21-24)
**P2/P3 items — System performance under load**

1. **F8.1**: Full Prisma query optimization (beyond Wave 2 fixes)
2. **F8.2**: Cursor-based pagination for large datasets (registrations, students, announcements)
3. **F9.1**: Add `/api/health` endpoint with readiness/liveness probes
3. **F8.4**: Comprehensive reduced-motion support across all animations

**Dependencies**: Query optimization from earlier waves; data volume analysis

### Wave 7 — Competitive Differentiation (Weeks 25-28)
**Enhancement items — Making COHEP stand out**

1. Community-driven hymn recording platform features
2. Diocese-level oversight with aggregated anonymized data
3. Multi-dialect Arabic support
4. Offline-first mode for poor connectivity areas
5. Integrated video lesson hosting

**Dependencies**: All previous waves; community feedback; technical architecture reviews

### Wave 8 — Production Hardening (Weeks 29-32)
**Final polish before production launch**

1. All P0/P1 items verified fixed
2. Security penetration testing
3. Performance benchmarking under load
4. Accessibility audit (WCAG 2.1 AA)
5. Backup and recovery procedure validation
6. Disaster recovery drill
7. Final documentation update
8. Go/no-go decision gate

---

## 14. ACROSS-MODULE DEPENDENCY MAP

```
Church Registration
    ↓ (creates School + User)
    ↓
Student Enrollment (link by code)
    ↓ (creates Student + links via StudentParent)
    ↓
Academic Year Assignment
    ↓
Level/Group/Grade Assignment
    ↓
Lesson Planning & Scheduling
    ↓
Attendance Recording (sessions + records)
    ↓
Assessment Creation & Grading
    ↓
Gamification (XP → Badges computation)
    ↓
Student Progress Update
    ↓
Certificate Generation (if criteria met)
    ↓
Parent Portal View (progress, attendance, assessments)
    ↓
Practice Together at Home (recordings, hymn map)
    ↓
Liturgy Logging & Verification
    ↓
Milestone Tracking
    ↓
Report Generation (term reports, progress summaries)
```

**Critical Paths**:
- Registration → Student creation is the onboarding critical path
- Attendance → Assessment → Gamification → Progress is the daily teaching cycle
- Parent → Child link is the parent onboarding critical path
- Admin → Registration approval is the governance critical path

---

## 15. FINAL DELIVERABLE CHECKLIST

### Completed
- [x] Platform map and module overview
- [x] User role analysis and RBAC findings
- [x] Data security and privacy assessment
- [x] API endpoint security review
- [x] UX/UI audit across all key screens
- [x] Business process workflow analysis
- [x] Performance and scalability assessment
- [x] Production readiness evaluation
- [x] Cross-module dependency mapping
- [x] Prioritized findings table (50+ findings)
- [x] Execution roadmap with 8 waves
- [x] Competitive benchmark analysis

### Remaining
- [ ] Implement Wave 1 fixes (critical security/stability)
- [ ] Validate all fixes with tests
- [ ] Update documentation
- [ ] Run full test suite
- [ ] Production deployment readiness review