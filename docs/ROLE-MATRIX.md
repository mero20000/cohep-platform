# Role – Scope – Journeys – Permissions Matrix

> Last updated: 2026-08-24
> **Validated against codebase** — `backend/prisma/seed.ts:11 roles`, `RolesGuard`, and every `@Roles(...)` decorator. User-provided table filed below as §1 (verbatim), §2 is the validated version.

## §1 — As provided (verbatim, for reference)

| Role | Test account | Scope | Core journeys | Can create | Can approve | Can publish | Sensitive data visible |
|---|---|---|---|---|---|---|---|
| Student | Test account | Assigned class | Learn, practise, submit | Limited | No | No | Own information only |
| Parent | Test account | Linked child | Monitor, support, consent | Limited | Where applicable | No | Linked child only |
| Servant | Test account | Assigned class | Prepare, teach, review | Yes | Limited | According to policy | Assigned learners |
| Priest | Test account | Church scope | Review, oversee, approve | According to policy | Yes | According to policy | Defined church scope |
| Administrator | Test account | Organization scope | Configure, manage | Yes | Administrative only | According to policy | Defined organization scope |

---

## §2 — Validated (actual platform)

> **Key finding:** codebase has **11 seeded roles** (`super_admin, admin, principal, curriculum_manager, servant, group_leader, level_leader, assistant_servant, student, parent, guest`). RBAC is **flat**: `STAFF_ROLES = 8` (`super_admin`→`assistant_servant`) share the same `@Roles` on most controllers. There is **no `priest` role** — `Church.responsiblePriest` is a text field; the closest is `principal`. `student` User role is **orphaned** — students authenticate via `portalAccessKey` (12h JWT), not `@Roles('student')`.

### 2a — Simplified view (mapped to your 5 rows) — validated

| Role (your label → actual) | Scope (actual) | Core journeys (actual) | Can create | Can approve | Can publish | Sensitive data visible | Correction vs §1 |
|---|---|---|---|---|---|---|---|
| **Student** → `student` (portal) | Own record only (via `student-portal/:code` + `portalAccessKey`) | Learn, practise, submit; view hymn map / take assessments | **Limited — portal only** (`POST :code/practice`, `POST :code/recordings`) — **No dashboard create** (no `@Roles('student')` exists) | No | No | Own record only (`getPortalData` — attendance, XP, badges) | §1 "Limited" overstated for dashboard; true only via portal |
| **Parent** → `parent` | Linked children only (`StudentParent` link table, `ParentsService.getChildren`) | Monitor, support, consent; log practice/liturgy together | **Limited — family rituals only** (`POST me/children/:id/practice`, `POST .../liturgy` pending, `POST me/children/link`, `POST .../report-assessment`) — cannot create assessments/attendance/announcements/curriculum | No (liturgy `pending` → servant verifies via `PATCH liturgy/:id/verify`) | No (announcements read-only) | Linked children only (`getChild`, `getChildHome`, `getTermReport`) | §1 "Where applicable" approve is false — never approves |
| **Servant** → `servant` (+ `group_leader`, `level_leader`, `assistant_servant` identical) | **Intended** assigned class; **actual** school-wide (flat `STAFF_ROLES` — `GET /students` returns all) | Prepare, teach, review; record attendance, grade assessments | **Yes — full** (assessments, attendance sessions, curriculum, announcements, badges/XP) — not limited | **Yes — full** (verify liturgy, mark attendance) — not limited | **Yes — direct** (`PATCH announcements/:id/publish`, `POST lessons status=published`) — no principal approval gate | **Intended** assigned learners; **actual** all school students + reports (`priest-pulse`, XP leaderboards) — over-broad; row-level scoping not enforced | §1 understates servant — code is not Limited/According to policy |
| **Priest** → **no role** (closest: `principal`) | Church scope (text field `Church.responsiblePriest`), not RBAC | Review, oversee, approve (management) | According to policy — **but flat**: `principal` can create same as servant (`STAFF_ROLES`) | Yes (`principal` can `GET /servants`, `runAbsenceCascade`) | According to policy — but flat: `principal` can publish directly | Defined church scope — but code scopes by `schoolId`, not church; `principal` sees same as `admin` minus `POST /churches` | §1 fictional role — map to `principal`; policy gating not enforced (flat RBAC) |
| **Administrator** → `admin` (school) / `super_admin` (diocese) | `admin`: Organization (school) scope (`schoolId`); `super_admin`: Global (bypasses `RolesGuard`, sees `diocese` report, `totalChurches`) | Configure, manage | Yes (full — plus user/role/school management; `POST /users`, `PATCH schools/:id/config` gated to `super_admin,admin`) | Yes — full; `super_admin` only for `DELETE badges/:id`, `DELETE students/:id/badges`, `GET diocese` | Yes — direct | `admin`: all students/users in school; `super_admin`: all schools/churches, PII, audit logs | §1 "Administrative only" approve/publish understates — both can publish directly; distinction is only `super_admin` diocese scope |

### 2b — Full 11-role matrix (authoritative)

| Role | Level | Test account | Scope | Core journeys | Can create | Can approve | Can publish | Sensitive data visible |
|---|---|---|---|---|---|---|---|---|
| `super_admin` | 0 | Test account | Global (all schools/churches, bypasses guard) | Diocese health, church/school provisioning, role permissions, leaderboard reset | Yes — everything + `POST /churches`, `POST /roles/:role/permissions`, `DELETE leaderboard` | Yes — everything + `GET diocese`, `DELETE badges` | Yes — everything (diocese aggregates, all PII, `priest-pulse`) | All — global PII, `diocese` health |
| `admin` | 1 | Test account | School (`schoolId`) | School admin, user management, curriculum, reports | Yes — full staff + `POST /users`, `POST /users/schools`, `PATCH schools/:id/config` | Yes — full (verify liturgy, mark attendance) | Yes — direct | All students/users in school |
| `principal` | 2 | Test account | School (oversight) | Oversee school, `GET /servants`, `runAbsenceCascade` | Yes — full staff (same as servant) — cannot `POST /users` (admin only) | Yes — same as admin | Yes — direct | All in school (same as admin, minus user-create) |
| `curriculum_manager` | 3 | Test account | School (curriculum) | Levels, subjects, items, lessons, allocations, recordings | Yes — full staff | Yes — `updateItemStatus` | Yes — direct | All curriculum, all students (via `GET /students`) |
| `servant` | 4 | Test account | Assigned class (intended) / school-wide (actual) | Teach, attendance, grading, hymn review | Yes — full staff | Yes — verify liturgy, mark | Yes — direct | Intended assigned; actual all |
| `group_leader` | 5 | Test account | Group | Group management, attendance, `getGroupMates` | Yes — full staff | Yes | Yes | Group (intended) / all (actual) |
| `level_leader` | 6 | Test account | Level (+ can `GET /servants`) | Level management, assignments | Yes — full staff | Yes | Yes | Level (intended) / all (actual) |
| `assistant_servant` | 7 | Test account | Assigned class (hidden in UI `ROLES` list but privileged in `STAFF_ROLES`) | Same as servant | Yes — full staff | Yes | Yes | Same as servant — **UI/backend mismatch** |
| `student` | 8 | Test account (portal key) | Own record (`student.portalAccessKey` → 12h JWT) | `GET :code/*`, take assessments, hymn map, practice | Limited — portal only (`POST :code/practice`, `POST :code/recordings`) | No | No | Own only |
| `parent` | 9 | Test account | Linked children (`StudentParent`) | `GET me/children/*`, log practice/liturgy, term report, archive | Limited — family rituals only | No | No | Linked children only |
| `guest` | 10 | — | None (unauthenticated fallback `effectiveRole='guest'`) | None (no controller allows `guest`) | No | No | No | None |

## §3 — What to fix to match §1 intent

1. **Priest** — create `priest` role or map to `principal` and document `Church.responsiblePriest` is not RBAC.
2. **Servant Limited** — introduce hierarchical guards: `PATCH announcements/:id/publish` → `admin,principal,super_admin`; `DELETE curriculum/*` → `curriculum_manager+`; `GET reports/priest-pulse` → `principal/admin` (today any servant can call all three).
3. **Assistant servant** — either expose in `frontend/src/lib/roles.ts:ROLES` or remove from `STAFF_ROLES`.
4. **Student** — document that `student` User role is orphaned; auth is portal-key only.
5. **Scope enforcement** — add row-level filtering on `GET /students`, `GET /reports/*` for `servant/group_leader/level_leader` (today they see all).
