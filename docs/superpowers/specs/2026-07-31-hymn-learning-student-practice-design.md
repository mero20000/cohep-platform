# Module 1 — Hymn Learning Engine: Student Practice View

**Date:** 2026-07-31
**Status:** Approved for implementation

## Overview

The backend hymn-learning engine (SM-2 spaced repetition, hymn map, due-for-review, This Sunday, servant review) already exists and is complete. The problem: **it has no student-facing surface.**

The student portal (`/student-portal/[code]`) logs in via code — no JWT — but every `hymn-learning` endpoint is behind `JwtAuthGuard` and resolves `studentId` from `req.user.id` (a User id), while `LessonProgress.studentId` references a **Student** id. Additionally, the existing `PracticeRecorder` component uploads recordings to `/api/upload/audio`, which does not exist in the upload controller.

This feature wires the engine into the student portal via a new **Practice** tab on `/student-portal/[code]`.

## Approach

**Student-code-scoped endpoints** — add public routes to the existing `StudentPortalController` keyed by student code (same auth model as `getPortalData`). They resolve `studentId` + `schoolId` from the code and delegate to `HymnLearningService`.

## Backend Changes

### 1. New endpoints in `backend/src/modules/students/student-portal.controller.ts`

All delegate to `HymnLearningService`, resolving student + school from `:code`:

| Method | Route | Delegate |
|--------|-------|----------|
| `POST` | `student-portal/:code/practice` | `hymnLearning.logPracticeSession({ studentId, schoolId, lessonId, selfRating, recordingUrl?, durationSec? })` |
| `GET` | `student-portal/:code/hymn-map` | `hymnLearning.getStudentHymnMap(studentId, schoolId)` |
| `GET` | `student-portal/:code/this-sunday` | `hymnLearning.getThisSundayHymns(schoolId)` |
| `GET` | `student-portal/:code/due-review` | `hymnLearning.getDueForReview(studentId, schoolId)` |
| `GET` | `student-portal/:code/stats` | `hymnLearning.getStudentStats(studentId, schoolId)` |
| `POST` | `student-portal/:code/recordings` | multipart audio upload → `uploads/recordings/` → returns `{ url }` |

`StudentsModule` already exports `HymnLearningService` via `CurriculumModule`. Add `CurriculumModule` to `StudentsModule`'s `imports` array so `StudentPortalController` can inject `HymnLearningService` (inject into the existing `StudentsService`, or directly into the controller — prefer `StudentsService` to keep controller thin).

### 2. Recording upload

- `POST /student-portal/:code/recordings` — `FileInterceptor('file')`, `diskStorage` → `uploads/recordings/`, uuid filename preserving extension.
- Accepted types: `.webm`, `.mp3`, `.m4a`, `.ogg`; limit 10MB.
- Returns `{ url: '/uploads/recordings/{uuid}.{ext}' }`. Express static serving already handles delivery.

### 3. Audio source for hymn map / this-sunday / due-review

`getStudentHymnMap()`, `getThisSundayHymns()`, `getDueForReview()` currently read audio from `resources[0].fileUrl`. Extend them to fall back to the new `lesson.audioUrl` (Module 4 field) when no audio resource exists:

```ts
const audioUrl = lesson.resources[0]?.fileUrl ?? lesson.audioUrl ?? null
```

## Frontend Changes

### 4. New student hooks: `frontend/src/components/hymn-learning/student-hooks.ts`

Reuses types from `hooks.ts`, but hits the student-scoped routes with the code:

- `useStudentHymnMap(code)`, `useStudentThisSunday(code)`, `useStudentDueReview(code)`, `useStudentStats(code)`
- `useStudentPractice(code)` mutation → `POST /student-portal/{code}/practice`
- `useStudentRecordingUpload(code)` → `POST /student-portal/{code}/recordings` (FormData)

### 5. New Practice tab on `/student-portal/[code]`

Add a tab switcher (Dashboard | Practice) to the student portal page. Practice tab layout:

- **This Sunday** — reuse `ThisSundayPanel` (updated to accept student hooks / pass data via props instead of self-fetching JWT endpoint).
- **Due for Review** — list of hymns with overdue days, mastery badge, "Practice" button.
- **All Hymns** — group by subject (name + color); each row: title (Coptic/Arabic/English), mastery status badge, "Practice" button.
- **Tap Practice** → inline `PracticeRecorder` modal.

### 6. PracticeRecorder wiring

- Change its upload call from `POST /api/upload/audio` to `POST /api/student-portal/{code}/recordings`.
- Reference audio: from hymn's `audioUrl` (already passed as `referenceAudioUrl`).
- On submit: upload recording (if any) → `useStudentPractice` mutation with `selfRating`, `recordingUrl`, `durationSec`.

### 7. `ThisSundayPanel` refactor

Currently self-fetches via `useThisSunday()` (JWT). Refactor to accept `data` + `isLoading` via props (presentational), so both the parent portal and student portal can feed it. Student portal passes data from `useStudentThisSunday(code)`.

## Data Flow

1. Student logs in with code → portal page shows Dashboard tab (existing).
2. Student taps **Practice** tab → fetches hymn-map, this-sunday, due-review, stats via code-scoped endpoints.
3. Student taps **Practice** on a hymn → `PracticeRecorder` opens with reference audio.
4. Student records, self-rates 1-5 → audio uploaded to `recordings/` → `POST practice` runs SM-2 → `LessonProgress` + `HymnPracticeSession` rows created → React Query invalidates map/due-review/stats.
5. Servant sees recording in existing `/hymn-learning/review-queue` (JWT endpoint, unchanged).

## Excluded (Deferred)

- AI pronunciation feedback / similarity score (V2)
- Coptic phoneme model (5-year)
- Gap analysis vs. upcoming liturgy
- "This Sunday" notifications (app-level, not page-level)

## Files

- Modify: `backend/src/modules/students/student-portal.controller.ts`
- Modify: `backend/src/modules/students/students.module.ts`
- Modify: `backend/src/modules/curriculum/hymn-learning.service.ts` (audioUrl fallback)
- Create: `frontend/src/components/hymn-learning/student-hooks.ts`
- Modify: `frontend/src/components/hymn-learning/hooks.ts` (only if shared type refactor needed)
- Modify: `frontend/src/components/hymn-learning/this-sunday.tsx` (presentational refactor)
- Modify: `frontend/src/components/hymn-learning/practice-recorder.tsx` (upload endpoint)
- Modify: `frontend/src/app/student-portal/[code]/page.tsx` (tab switcher + Practice tab)
