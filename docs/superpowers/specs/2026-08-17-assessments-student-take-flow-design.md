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

### 1. Question-fetch endpoints (two surfaces)

The `assessments` controller is `@Roles(...STAFF_ROLES)` and the app installs `JwtAuthGuard` globally, while the portal is `@Public()` and authenticated by the `portalAccessKey`. So the take flow is split across two surfaces:

**Portal (student self-service)** — new routes on the existing `@Public()` `student-portal` controller (`student-portal.controller.ts`), resolving the student server-side from the access key via the existing `resolveStudent(code)` pattern:
- `GET /api/student-portal/:code/assessments/:id` → assessment header + questions (no `correctAnswer`).

**Dashboard (servant on a student's behalf)** — new route on the staff-gated `assessments` controller:
- `GET /api/assessments/:id/questions?studentId=<uuid>` → assessment header + questions (no `correctAnswer`).

Both call a single shared service method `getTakeQuestions(assessmentId, studentId)` (the portal controller resolves `studentId` from the access key first).

Response shape (both):
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

Gates (in `getTakeQuestions`):
- 404 if the assessment is missing or deleted.
- 400 if `assessment.status !== 'published'`.
- 400 if the student is not assigned (no `assessmentSubmission` row with that `studentId`) or already `completed`.
- Portal identity is resolved server-side from the access key (never trusted from a raw client ID); dashboard identity is the authenticated servant's chosen `studentId` (school-scoped, mirroring `getStudentsForAssessment`).

### 2. Harden `submit()`

Before creating the submission, require an existing `assessmentSubmission` for `(assessmentId, studentId)` with `status` not in `['submitted', 'completed']` (i.e. an `assigned`/`pending` assignment). If none, throw `BadRequestException` ("This student is not assigned to this assessment"). Keep the existing published + double-submit checks. This ensures a student can only submit an assessment they were assigned, and secures the portal path where the client passes its own `studentId`.

### 3. Opt-in timer

Add an optional `durationMinutes?: number | null` to the assessment, stored in the existing `metadata` JSON (`metadata.durationMinutes`), read/written through the existing create/update `metadata` handling (same pattern as `term`/`grade`). No schema migration. Timer is a **client** concern; the backend does not auto-submit. When `durationMinutes` is null/0, no timer is shown.

- `create()` / `update()`: accept `durationMinutes`; set `metadata.durationMinutes` when provided.
- Questions endpoint: surface `durationMinutes` from `metadata`.

### 4. Submission + result exposure

- **Dashboard (servant):** reuse the existing staff-gated `POST /api/assessments/:id/submit?studentId=<uuid>`.
- **Portal (student self-service):** add `POST /api/student-portal/:code/assessments/:id/submit` on the `@Public()` controller; resolve `studentId` from the access key, then call the same hardened `submit()` service method.

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
  - `getTakeQuestions` returns questions without `correctAnswer` and the assessment header (incl. `durationMinutes`).
  - `getTakeQuestions` 400 for non-`published`; 400 when the student is not assigned or already `completed`.
  - `submit()` rejects when no assignment exists (new test) and still blocks double-submit.
  - `create()`/`update()` persist `durationMinutes` into `metadata`; `getTakeQuestions` surfaces it.
- **Frontend:**
  - `npx tsc --noEmit` clean.
  - vitest for a pure helper that maps `grades` → per-question { correct / incorrect / pending } and computes the overall score, and for the countdown logic.
  - Existing suites stay green.

## Open decisions / assumptions

- No auto-save or resume on navigation away (restart is acceptable) — flagged as a future enhancement.
- Timer auto-submit is client-side only (a determined student can bypass it); acceptable for the current scope.
