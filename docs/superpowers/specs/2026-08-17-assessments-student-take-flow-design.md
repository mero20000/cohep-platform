# Unit C — Assessments: Student Take Flow — Design

**Date:** 2026-08-17
**Status:** Approved
**Prerequisites:** Unit A (foundation: type field, question-id upsert, validations) is complete on `main`.

## Goal

Let a student actually **take** an assessment — open a published, assigned assessment, answer all questions on one page, submit, and see an instant result (auto-graded questions marked correct/incorrect; essay questions labeled "awaiting grading" until a servant grades them). The flow is available from **both** the student-portal (self-service) and the dashboard (a servant taking on a student's behalf, e.g. oral/classroom quizzes). Includes an **opt-in countdown timer** per assessment.

## Out of scope

- Unit B (analytics dashboard), Unit D (bulk actions + export).
- Server-side session state / draft persistence / resume (a student who navigates away mid-take restarts).
- Changing the existing auto-grading logic in `submit()` beyond the assignment check described below.

## Context (verified from deployed code)

- Backend `submit()` already exists at `POST /api/assessments/:id/submit` (`assessments.service.ts:219`). It auto-grades each answer by exact, case/whitespace-insensitive match of the student's answer against the question's `correctAnswer`, creating `grade` rows, and returns the submission with `grades` and student. It rejects non-`published` assessments and double-submissions.
- The student-portal (`student-portal/[code]`) lists "Assigned Assessments" as read-only status cards (Pending / Done / Overdue) via `getPortalData(portalAccessKey)`. It exposes `submissionStatus`, `submissionId`, `totalPoints`, `passingScore`, `dueDate`, subject/level/type — but **no questions**, and there is no way to open or take one.
- Identity in the portal is the unguessable `portalAccessKey` (the URL `[code]` segment); `getPortalData` returns the bound `student.id`.
- `Assessment.status`/`Assessment.type` are `String` columns; `metadata` is a JSON column already used to store `academicYearId`, `term`, `grade` (no Prisma migration needed for a new optional metadata field).
- Frontend is Next.js App Router; bilingual AR/EN via a `lang` value; `http()` client at `@/lib/http-client`.

## Approach

Build **one** reusable React "TakeAssessment" component and surface it in both the portal and the dashboard. Add a single backend endpoint to fetch an assessment's questions (stripped of `correctAnswer`) scoped to the student, and harden `submit()` to require an existing assignment. Reuse the existing `submit()` auto-grader unchanged.

## Backend

All in `backend/src/modules/assessments/`.

### 1. New: `GET /api/assessments/:id/questions`

Returns the assessment's questions **without `correctAnswer`**, plus assessment header info.

Response shape:
```ts
{
  assessment: {
    id: string; title: string; titleAr?: string; type: string;
    subject: { id: string; name: string; nameAr?: string } | null;
    totalPoints: number; passingScore: number; dueDate?: string;
    durationMinutes: number | null;   // read from metadata
  },
  questions: Array<{
    id: string; text: string; type: string;
    options: string[] | null; points: number; orderIndex: number;
    // correctAnswer intentionally omitted
  }>,
}
```

Authorization / gates:
- 404 if the assessment is missing or deleted.
- 400 if `assessment.status !== 'published'`.
- The requester must be an assigned student with a non-`completed` submission. Identity is resolved **server-side**, not trusted from a raw client ID:
  - **Portal:** accept the `portalAccessKey`; resolve the student from it; use that student's id.
  - **Dashboard:** the caller is an authenticated servant (JWT); authorize the `studentId` query param within the same school (mirrors the existing `getStudentsForAssessment` scoping).
- 400 if the student is not assigned (no `assessmentSubmission` row) or already `completed`.

### 2. Harden `submit()`

Before creating the submission, require an existing `assessmentSubmission` for `(assessmentId, studentId)` with `status` not in `['submitted', 'completed']` (i.e. an `assigned`/`pending` assignment). If none, throw `BadRequestException` ("This student is not assigned to this assessment"). Keep the existing published + double-submit checks. This ensures a student can only submit an assessment they were assigned, and secures the portal path where the client passes its own `studentId`.

### 3. Opt-in timer

Add an optional `durationMinutes?: number | null` to the assessment, stored in the existing `metadata` JSON (`metadata.durationMinutes`), read/written through the existing create/update `metadata` handling (same pattern as `term`/`grade`). No schema migration. Timer is a **client** concern; the backend does not auto-submit. When `durationMinutes` is null/0, no timer is shown.

- `create()` / `update()`: accept `durationMinutes`; set `metadata.durationMinutes` when provided.
- Questions endpoint: surface `durationMinutes` from `metadata`.

### 4. Result exposure

`submit()` already returns the submission with `grades`. The take flow reads those grades (per-question `score`/`maxScore`) to render the result. No grading logic changes.

## Frontend

### New component: `frontend/src/components/assessments/take-assessment.tsx`

Client component; props: `{ assessmentId, mode: 'portal' | 'dashboard', accessKey?: string, studentId?: string }`.

- On mount, `GET /api/assessments/:id/questions` (portal sends `?accessKey=`; dashboard sends `?studentId=`).
- Renders all questions on one scrollable page, each by type:
  - `multiple_choice` → radio group from `options`
  - `true_false` → True/False radio
  - `short_answer` → single-line text input
  - `essay` → textarea
- Sticky header: title/subject, answered count (e.g. "5/8"), and a live countdown when `durationMinutes` is set (auto-submits at 0:00).
- Single **Submit** button. If unanswered questions exist, prompt to confirm submitting.
- On success, render the **result view**: overall auto-graded score, per-question correct/incorrect for graded types, "awaiting grading" for essays.
- Loading state while fetching; friendly error if closed/unassigned/already completed.

### Surfacing

- **Student-portal** (`student-portal/[code]/page.tsx`): Pending (published, assigned, not completed) assessment cards become a link to a new route, e.g. `student-portal/[code]/assessment/[assessmentId]/take`, rendering the component in `mode: 'portal'` with `accessKey = code`. Completed/overdue cards stay read-only.
- **Dashboard** (`dashboard/assessments/page.tsx`): in the students modal, add a "Take for student" action that opens the component for the selected student (a route such as `dashboard/assessments/[id]/take?student=<studentId>`, `mode: 'dashboard'`), for oral/classroom quizzes.

Bilingual AR/EN labels for all controls, matching existing portal/dashboard style.

## Security

- `correctAnswer` is never sent to clients (stripped in the questions endpoint).
- Portal identity is resolved server-side from `portalAccessKey`, not a raw client-supplied `studentId`.
- Dashboard path is JWT-authenticated and school-scoped.
- `submit()` requires an existing assignment, blocking unassigned submission and double-submit.

## Error handling

- 404 missing/deleted; 400 not published / not assigned / already completed / double-submit.
- Frontend: loading state, friendly errors for closed/unassigned/completed, confirm-before-submit when questions are unanswered, clear success state.

## Testing

- **Backend** (extend `assessments.service.spec.ts`):
  - questions endpoint returns questions without `correctAnswer` and returns assessment header.
  - questions endpoint 400 for non-`published`; 400/403 when not assigned.
  - `submit()` rejects when no assignment exists (new test) and still blocks double-submit.
  - `create()`/`update()` persist `durationMinutes` into `metadata`; questions endpoint surfaces it.
- **Frontend:**
  - `npx tsc --noEmit` clean.
  - vitest for a pure helper that maps `grades` → per-question { correct / incorrect / pending } and computes the overall score, and for the countdown logic.
  - Existing suites stay green.

## Open decisions / assumptions

- No auto-save or resume on navigation away (restart is acceptable) — flagged as a future enhancement.
- Timer auto-submit is client-side only (a determined student can bypass it); acceptable for the current scope.
