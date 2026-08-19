# Servant "My Class" At-a-Glance — Design

**Date:** 2026-08-19
**Module:** 3 — Servant empowerment
**Status:** Approved design

## Goal

A servant opens `/dashboard/my-class` on Sunday morning and in one screen sees, within ~30 seconds, the answers to: *who is likely absent, which students need follow-up, what is today's lesson, and are there any personal notes I should know about.* This directly addresses the vision's "My class at a glance" WOW factor and the servant's Sunday-morning stress of "what do I teach today?".

This build **does not** include the AI Sunday-prep assistant (no LLM integration exists in the stack) nor the servant community feed (requires new DB schema). Both are explicitly out of scope for this iteration.

## Context / existing assets

- Servant → group linkage is not a first-class relation: it is derived from `AttendanceSession.servantId` + `groupId`, with fallback to `User.metadata.groupId`. Students in the group are resolved via `Student.groupId`.
- `GET /dashboard/servant-digest` (`dashboard.service.ts getServantDigest`) already computes the servant's groups/students inline and returns `studentStory`, `classTrend`, `milestone`, `absenceAlerts`, `nextSession`.
- Rich per-student data exists: `AttendanceRecord` (status, behavior, participation, note, isPrivateNote), `MedicalNote`, `LessonProgress` (masteryStatus, nextReviewAt, spaced-repetition), `AssessmentSubmission` + `Grade`.
- `CurriculumAllocation` is keyed by `AcademicYear`/`Level`/`Subject`/`groupNumber`/`scheduledDate` — the source for "today's lesson", resolved by level + date.

## Approach (chosen: B — dedicated endpoint + shared helper)

Keep `getServantDigest` untouched in behavior; add one focused, testable endpoint reusing a shared helper. This follows the small, well-bounded unit principle and avoids bloating a ~230-line method.

## Backend

### 1. Shared helper — `resolveServantClass`
Extract the existing inline group/student derivation from `getServantDigest` into `private async resolveServantClass(userId, schoolId)` returning `{ groupIds, levelIds, studentIds }`. Refactor `getServantDigest` to call it. **No behavior change to the digest.**

### 2. New endpoint — `GET /dashboard/class-overview`
New method `getClassOverview(user, schoolId)` in `dashboard.service.ts`, exposed via `@Get('class-overview')` in `dashboard.controller.ts`. Returns:

```ts
{
  servant: { id, firstName, lastName },
  nextSession: { id, scheduledDate, levelId, levelName, levelNumber, groupId, groupName } | null,
  todayLesson: {
    lessonId, title, titleAr, titleCoptic,
    levelId, levelName, levelNumber,
    subjectName,
    scheduledDate,
  } | null,
  roster: [{
    studentId, firstName, lastName, firstNameAr, lastNameAr, photoUrl,
    attendanceRate,            // % present/late over history (0-100)
    lastAttendanceStatus,      // 'present' | 'absent' | 'late' | null
    likelyAbsent,              // boolean
    needsFollowUp,             // boolean
    followUpReasons,           // string[] from the set below
    notes: [{ category, note, isPrivate, createdAt }],  // last N per student
  }],
}
```

### 3. Deterministic rules

**`likelyAbsent`** = true when any of:
- attendance rate < 60%, **or**
- the last 2 recorded sessions are absent, **or**
- historically absent on the weekday of the next session.

**`needsFollowUp`** = true when any of:
- overdue spaced-repetition review (`LessonProgress.nextReviewAt < now`), or
- low mastery on the **today's / next allocated lesson** for the group's level (`masteryStatus` in `not_started`/`introduced`), or
- 3+ consecutive absences, or
- an ungraded `AssessmentSubmission`.

`followUpReasons` uses tokens: `overdue_review`, `low_mastery`, `absent_3plus`, `ungraded_assessment`.

**Roster ordering:** students flagged likely-absent or needs-follow-up first, then by last name (locale-agnostic alphabetical).

### 4. Empty / edge states
- No groups / no students → `roster: []`.
- No allocation for today → `todayLesson: null`.
- No scheduled session → `nextSession: null`.

### 5. Backend tests — `dashboard.service.spec.ts`
Verify: group/student derivation; each `likelyAbsent` branch; each `followUpReasons` token; roster ordering; `todayLesson` resolution; empty states. Follow the repo's existing Jest spec conventions (mocked Prisma).

## Frontend

### 6. Route — `/dashboard/my-class`
New page `frontend/src/app/dashboard/my-class/page.tsx`. Fetches `GET /dashboard/class-overview` via `http.get`.

Layout:
- **Header:** "My Class" (`أنا صفي`) + next-session line ("Next session: Sunday 10:00 · Level 3").
- **Today's lesson card:** title (+ Coptic), level, subject, scheduled date. Friendly empty state when null.
- **Roster:** each student row/card shows name, attendance-rate bar, last-status badge, likely-absent chip, follow-up chips, and an expandable section listing recent notes (private notes styled distinctly).
- Follow-up / likely-absent students grouped at top with a subtle background tint.

### 7. Nav item
Add to `navigation` in `components/dashboard-shell.tsx`, gated by `perm: 'attendance:record'` (held by servant, group_leader, level_leader, admin, principal — every teacher role). Icon: `Users` or `School`.

### 8. Frontend tests — `my-class.test.tsx`
Empty state, roster render, badge rendering (mocked `http.get`), loading skeleton. Match repo's vitest + testing-library conventions.

## Error handling
- API returns empty collections/null gracefully; page renders skeleton while loading and a friendly empty state when there is no data.
- API failure → error state with retry.

## Data flow
`GET /dashboard/class-overview` → `resolveServantClass` → attendance/lesson/notes queries → `classOverview` payload → React Query `http.get` → `/dashboard/my-class` renders roster + today lesson.

## Out of scope (future)
- AI Sunday-prep assistant (requires new LLM backend + keys).
- Servant community feed (requires new Post/Thread/Comment schema).
- Making servant→group a first-class relation.