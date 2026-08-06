# Tracked Test Data — Review Sheet

**Run:** 2026-08-01 (full platform endpoint validation)
**Environment:** Production (Render)
**Status:** ⏳ AWAITING VALIDATION (cleanup not yet performed)

## Summary

| Metric | Value |
|--------|-------|
| Endpoints tested | 177 (across 19 active modules) |
| Tests passed | 176 |
| Tests failed | 1 (G-3 seasonal badge — correct off-season behavior, not a code bug) |
| Records created | 34 |
| Records deleted | 0 (awaiting user validation) |

## New product bug found (1)

| ID | Module | Bug | Evidence |
|----|--------|-----|----------|
| AS-6 | Assessments | `UpdateAssessmentDto.totalPoints` / `passingPoints` are **required** (not `@IsOptional()`) in `assessment.dto.ts`, so a partial update (e.g. changing only `description`) returns 400. A UI that does partial edits of an assessment will fail. | `PUT /assessments/:id` with `{ description }` → 400 `totalPoints must not be less than 1` |

Workaround currently in harness: send `totalPoints` + `passingPoints` with every update.

## Documented env/config failures (1, not a code bug)

| Test | Module | Cause |
|------|--------|-------|
| G-3 Create seasonal badge | Gamification | `No active liturgical season at this time` — August is not a Coptic liturgical season; endpoint correctly returns 400 |

> T28 (AI draft announcement) previously failed with `GEMINI_API_KEY not configured`. Resolved on 2026-08-01:
> - Backend model made configurable (`GEMINI_MODEL`, default `gemini-2.0-flash`) — `announcements.service.ts`
> - Production set to `GEMINI_MODEL=gemini-3.5-flash` (the provided key has quota 0 for `gemini-2.0-flash`, works with `gemini-3.5-flash`)
> - `GEMINI_API_KEY` set as a Render env var (not committed to git — push protection blocks it); deployed via commit `d0fddf69`
> - Verified live: `POST /api/announcements/draft` → HTTP 201 with real bilingual draft

## Created Records (awaiting deletion)

| # | ID | Label | Module |
|---|----|-------|--------|
| 1 | `152ba06b-ef4b-45ef-8761-ef65b4c6a04f` | QA pending school (auth register) | Auth |
| 2 | `41a7e699-8808-4d1d-9075-54d991530e42` | QA throwaway user (change-password) | Auth |
| 3 | `0eb72464-d8e3-41a5-af3a-91cfdedb0ad5` | QA student group | Students |
| 4 | `00c76be3-3f59-4067-95df-ed12f5ffb3bf` | QA bulk-import student | Students |
| 5 | `6e1b1baf-c309-4da0-acea-9c6e72a8a1a7` | QA bulk-import student | Students |
| 6 | `6dd51361-6e62-44f9-ae4a-5a0db15472b2` | QA student (Peter Test) | Students |
| 7 | `STU-00027` | QA student code | Students |
| 8 | `9faff1a1-9f94-4ea3-bdfc-7f83ed99de46` | QA level | Curriculum |
| 9 | `c9f72843-e6b0-4726-8955-8524beb06407` | QA subject | Curriculum |
| 10 | `1dd07e61-fbfb-46f3-a5f7-2c6733c80799` | QA subject item | Curriculum |
| 11 | `fb5e60fc-aa2a-4a5c-930d-3220660240c6` | QA lesson | Curriculum |
| 12 | `223c559d-08ca-4826-9f2e-b1747a43a016` | QA bulk lesson | Curriculum |
| 13 | `207b29c7-3ac4-4c8c-bbd3-71771760d734` | QA bulk lesson | Curriculum |
| 14 | `2172dc0d-852e-4fe4-bd94-b0b4dfa71bb9` | QA academic year | Curriculum |
| 15 | `4469d92c-2578-48f9-bb66-46ed7038e120` | QA calendar event | Curriculum |
| 16 | `d7f7cf8a-e97b-4921-9f23-3c2e16133d6f` | QA allocation | Curriculum |
| 17 | `bf31c917-926a-48ee-b7de-711412d38731` | QA hymn practice session | Hymn Learning |
| 18 | `db7507a6-1e65-49d4-902a-ff64f07193a3` | QA attendance session | Attendance |
| 19 | `6c35aec2-9151-4d5e-bd10-278537434cda` | QA assessment | Assessments |
| 20 | `04a76fc4-14f1-4b81-9836-d294f451e444` | QA badge | Gamification |
| 21 | `a1294a3f-3fe8-48d3-aa8e-839bbfdb3a11` | QA student-badge | Gamification |
| 22 | `28334bc2-cd3a-4d28-93df-fccf0619a5e9` | QA parent user | Parents |
| 23 | `c3914880-8066-4839-950e-b51b87a72317` | QA family liturgy (verified) | Parents/Servants |
| 24 | `f4a337aa-6587-48c9-aa54-c3517e9c6744` | QA family liturgy (reject path) | Parents/Servants |
| 25 | `3cac3a7e-b75f-41f7-a06c-99b49ec7ce9f` | QA notification | Notifications |
| 26 | `1e81be1e-cff3-421b-b819-d1882733cdd5` | QA school | Users |
| 27 | `3582c176-5c2f-4262-b2be-daaafb09e408` | QA user | Users |
| 28 | `ad8d5b94-0c68-4395-884f-f3481de21c7a` | QA throwaway user (reset-password) | Admin |
| 29 | `c94ea21e-4354-48c6-926b-2f79099cb906` | QA church | Churches |
| 30 | `/uploads/church-logos/b0b83b06-….png` | QA uploaded file (church-logo) | Upload |
| 31 | `/uploads/church-logos/school-561b18c1-….png` | QA uploaded file (school-logo) | Upload |
| 32 | `/uploads/avatars/avatar-38a015cd-….png` | QA uploaded file (avatar) | Upload |
| 33 | `/uploads/student-photos/student-98cb617d-….png` | QA uploaded file (student-photo) | Upload |
| 34 | `/uploads/presentations/pres-576e25af-….pptx` | QA uploaded presentation | Upload |

## Module Coverage (PASS/FAIL)

| Module | Tests | Result |
|--------|-------|--------|
| Auth | 8 | ✅ all pass (register/login/refresh/logout/me/patch/change-password) |
| Students | 13 | ✅ all pass (stats, groups CRUD, bulk import/update/delete, student CRUD) |
| Student Portal | 2 | ✅ all pass |
| Curriculum | 30 | ✅ all pass (levels/subjects/items/lessons/years/calendar/weeks/events/allocations) |
| Hymn Learning | 8 | ✅ all pass |
| Attendance | 16 | ✅ all pass |
| Assessments | 11 | ✅ all pass (incl. partial-update workaround) |
| Gamification | 13 | ✅ 12 pass / 1 expected (seasonal off-season) |
| Announcements | 1 | ✅ pass (AI draft live after GEMINI fix) |
| Reports | 4 | ✅ all pass |
| Dashboard | 6 | ✅ all pass |
| Parents | 19 | ✅ all pass |
| Servants | 3 | ✅ all pass (verify + reject) |
| Notifications | 5 | ✅ all pass |
| Users/Schools | 15 | ✅ all pass |
| Admin | 4 | ✅ all pass |
| Churches | 5 | ✅ all pass |
| Newsletter | 1 | ✅ pass |
| Upload | 5 | ✅ all pass |

## Cleanup Plan

Deletion order (dependents first):

1. Attendance records (cascade via session delete) + hymn practice session
2. Assessment submissions/grades → then assessment delete (soft)
3. Student badges + XP transactions → then badge delete
4. Calendar event (already deleted in-test; confirmed)
5. Allocations (hard) + weeks → then academic year (soft)
6. Subjects / subject items / lessons (hard, `?schoolId=` on subjects+items)
7. Levels (soft), student group
8. Family liturgy records (delete via servants reject or direct)
9. Students (soft delete) + bulk students + student-parent link
10. Parent/throwaway/QA users (soft delete via `DELETE /users/:id`)
11. QA school (soft delete via `DELETE /users/schools/:id`)
12. QA pending school (reject via admin) + QA church (delete)
13. Newsletter subscriber + uploaded files (no delete API — noted as server-side residue)
