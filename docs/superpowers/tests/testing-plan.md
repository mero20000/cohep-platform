# Platform Testing Plan — Full Endpoint Validation

**Date:** 2026-08-01
**Status:** In Progress
**Environment:** Production (Render) — `https://niangelos-backend.onrender.com/api`
**Test account:** `admin@niangelos.app` / `Admin123!` (super_admin)

## Purpose

Validate **every API function** across all 19 active modules (progress & search controllers are empty stubs with no routes). Covers create/read/update/delete, read-only reports/dashboards, public flows (auth, newsletter, student-portal), multipart uploads, and role-gated admin/users/churches flows. Every created record is tracked in `results/tracked-data.md` for deletion after validation.

## Test Data Naming Convention

- `QA-<MODULE>-<SUFFIX>` naming on all created records.
- Every created record's `id` is tracked in `results/tracked-data.md`.
- Deletion order: dependents first (attendance records, grades, badges/XP, allocations, weeks, calendar events), then hard deletes (subjects/items/lessons/allocations), then soft deletes (students, levels, assessments, groups).

## Approach

1. **API harness** (`harness/*.mjs`) authenticates as admin (or parent/throwaway users created per-test) and exercises every endpoint, capturing PASS/FAIL.
2. **Throttle handling** — `ThrottlerGuard` (200 req/60s) is mitigated via spacing + 429-retry in the runner.
3. Results JSON + tracked-data sheet are written under `results/` after each run.

## Module Test Matrix

### Auth (`/auth`)
| Test | Endpoint | Expected |
|------|----------|----------|
| AUTH1 | `POST /auth/register` (public, new church) | 201, pending school created |
| AUTH2 | `POST /auth/login` | token issued |
| AUTH3 | `POST /auth/refresh` | new accessToken |
| AUTH4 | `POST /auth/logout` | ok |
| AUTH5 | `GET /auth/me` | current user |
| AUTH6 | `PATCH /auth/me` | profile updated |
| AUTH7 | `POST /auth/change-password` (throwaway user) | new password works |

### Students (`/students`)
| Test | Endpoint | Expected |
|------|----------|----------|
| S1 | `GET /students/stats` | ok |
| S2 | `GET /students/levels/all` | ok |
| S3–S5 | `POST/PATCH/DELETE /students/groups` | group CRUD |
| S6 | `POST /students/bulk` | N students created |
| S7 | `PATCH /students/bulk` | updated |
| S8 | `POST /students/bulk-delete` | deleted |
| T1/T4a-e | `POST /students`, `GET/PUT /students/:id`, attendance/progress/activity | persisted |

### Student Portal (`/student-portal`, public)
| Test | Endpoint | Expected |
|------|----------|----------|
| PORTAL1 | `POST /student-portal/login` (studentCode) | portal data |
| PORTAL2 | `GET /student-portal/:studentCode` | portal data |

### Servants (`/servants`)
| Test | Endpoint | Expected |
|------|----------|----------|
| T7 | `GET /servants/liturgy-pending` | array |
| SV-2 | `PATCH /servants/liturgy/:id/verify` | verified |
| SV-3 | `DELETE /servants/liturgy/:id` | rejected |

### Curriculum (`/curriculum`)
| Test | Endpoint | Expected |
|------|----------|----------|
| C-L1–3 | `GET/POST/PATCH/DELETE /curriculum/levels` | level CRUD |
| T8/C-S1-2 | `GET/POST/PUT /curriculum/subjects` | subject CRUD |
| T9/C-I1-3 | subject items create/read/update/status | item CRUD |
| C-I4 | `GET /curriculum/items` (flat list) | list |
| T10/T11/C-LS1-2 | lessons create/update/read/patch-audio | lesson CRUD |
| C-LS3 | `POST /curriculum/lessons/bulk` | bulk lessons |
| C-LS4 | `POST /curriculum/parse-html` | parsed |
| T12/C-Y1-2 | academic years create/read/update | year CRUD |
| T15 | `POST /academic-years/:id/generate-weekends` | weeks created |
| C-CAL1 | `GET /curriculum/calendar` | ok |
| C-W1-3 | weeks read/update/bulk-update | ok |
| C-CAL2-5 | calendar events CRUD | ok |
| T13/C-A1-4 | allocations create/read/update/reorder/delete | ok |

### Hymn Learning (`/hymn-learning`)
| Test | Endpoint | Expected |
|------|----------|----------|
| HL1 | `GET /hymn-learning/this-sunday` | ok |
| HL2 | `POST /hymn-learning/practice` | session (SM-2) |
| HL3–HL5 | `GET map/due-review/stats` | ok |
| HL6 | `GET /hymn-learning/history/:lessonId` | ok |
| HL7 | `GET /hymn-learning/review-queue` | ok |
| HL8 | `PATCH /hymn-learning/sessions/:id/review` | reviewed |

### Attendance (`/attendance`)
| Test | Endpoint | Expected |
|------|----------|----------|
| A-1–A-5 | sessions list, stats, student-search, level-stats, group-stats | ok |
| T16–T18 | sessions create/mark/read | records saved |
| A-6/A-7 | `PUT/DELETE /attendance/sessions/:id` | ok |
| A-8 | `POST /attendance/sessions/generate` | generated |
| A-9 | `POST /attendance/qr-checkin` | present |
| T19 | `POST /attendance/start-class` | session/groups |
| A-10 | `GET /attendance/liturgy-heatmap` | ok |

### Assessments (`/assessments`)
| Test | Endpoint | Expected |
|------|----------|----------|
| AS-1/AS-2 | list + stats | ok |
| T20/AS-3 | create + read-back | persisted |
| T21–T23 | submit / assign / mark | saved |
| AS-4 | `POST :id/students/:studentId/reassess` | reopened |
| AS-5 | `DELETE :id/students/:studentId` | unassigned |
| AS-6 | `PUT /assessments/:id` | updated |

### Gamification (`/gamification`)
| Test | Endpoint | Expected |
|------|----------|----------|
| G-1 | `GET /gamification/leaderboard` | ok |
| G-2/G-3 | seasonal status + create | ok |
| T24/G-4/G-5 | badges create/read/update | persisted |
| T25/G-6/T25b | XP add + growth + transactions | ok |
| T26/G-7 | award badge + student badges | linked |
| T25c/T27 | stats + compute student | ok |
| G-8/G-9 | group trophy + servant milestones | ok |
| G-10 | `POST /gamification/compute/school` | ok |

### Announcements (`/announcements`)
| Test | Endpoint | Expected |
|------|----------|----------|
| T28 | `POST /announcements/draft` | draft or documented GEMINI config error |

### Reports (`/reports`)
| Test | Endpoint | Expected |
|------|----------|----------|
| R-1–R-4 | priest-pulse, liturgical-engagement, servant-contributions, diocese | ok |

### Dashboard (`/dashboard`)
| Test | Endpoint | Expected |
|------|----------|----------|
| D-1–D-5 | stats, mine, leaderboard, servant-digest, practice-stats | ok |
| D-6 | `POST /dashboard/absence-cascade` | ok |

### Parents (`/parents`, parent-role user)
| Test | Endpoint | Expected |
|------|----------|----------|
| P-1/P-2 | create parent user + login | token |
| P-3 | `POST /parents/me/children/link` (studentCode) | linked |
| P-4/P-5 | children list + get child | ok |
| P-6–P-10 | attendance/assessments/progress/home/current-lesson | ok |
| P-11/P-12 | log practice + summary | ok |
| P-13/P-14 | log liturgy + read records (feeds servants) | ok |
| P-15–P-17 | milestones/archive/term-report | ok |
| P-18 | `DELETE /parents/me/children/:id` | unlinked |

### Notifications (`/notifications`)
| Test | Endpoint | Expected |
|------|----------|----------|
| N-1/N-2 | list + unread-count | ok |
| N-3 | `POST /notifications` | created |
| N-4/N-5 | mark-read + read-all | ok |

### Users & Schools (`/users`)
| Test | Endpoint | Expected |
|------|----------|----------|
| U-1–U-3 | users list, roles, permissions | ok |
| U-4/U-5 | schools list + schools/me | ok |
| U-6–U-8 | schools create/get/update | persisted |
| U-9/U-10 | config set/get | ok |
| U-11–U-13 | user create/get/update | persisted |
| U-14/U-15 | assign/remove role | ok |

### Admin (`/admin`, super_admin)
| Test | Endpoint | Expected |
|------|----------|----------|
| AD-1 | `GET /admin/pending-registrations` | ok |
| AD-2 | `POST :id/reject` | rejected (cleanup path) |
| AD-3 | `POST /admin/reset-password` | reset works |

### Churches (`/churches`)
| Test | Endpoint | Expected |
|------|----------|----------|
| CH-1–CH-5 | list/get/create/update/delete | CRUD |

### Newsletter (`/newsletter`, public)
| Test | Endpoint | Expected |
|------|----------|----------|
| NW-1 | `POST /newsletter/subscribe` | ok |

### Upload (`/upload`, multipart)
| Test | Endpoint | Expected |
|------|----------|----------|
| U-* | church-logo, school-logo, avatar, student-photo, presentation | url returned |

## Prerequisites

- Admin token obtained via `POST /auth/login` (harness does this automatically).
- `schoolId` resolved from login response.
- Reuse existing seeded data (levels, subjects, academic year, students) as parent references.
- Cross-module dependencies: students module creates the student whose code feeds portal/parents; parents module creates the liturgy record that feeds servants verify.

## Cleanup

After the user validates the tracked data, test records are deleted in reverse dependency order. IDs for cleanup are in `results/tracked-data.md`. Hard deletes use `schoolId` query param on subject/item deletes; most other curriculum deletes are per-ID.
