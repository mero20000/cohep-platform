# Phase 1: Servant Support & Feedback — Implementation Progress

**Branch**: `phase-1-servant-support`

**Timeline**: Weeks 3–4

**Goal**: Enable servants to review student recordings and leave feedback, personalizing guidance and strengthening teacher-student relationships.

---

## Task 1.1: Teacher Feedback Loop

**Status**: 🔄 IN PROGRESS

### Implementation Plan

#### Backend (3 days)

**Step 1: Schema Updates** (Day 1)
- Add to `LessonProgress` model:
  - `servantFeedback: String?` (max 200 chars)
  - `servantFeedbackAt: DateTime?`
  - `servantId: String?` (who gave feedback)

**Step 2: New Endpoints** (Day 1–2)
- `GET /api/curriculum/lessons/:lessonId/submissions` (servant-scoped)
  - Returns list of student submissions for a specific lesson
  - Filters: by group, by status (awaiting feedback / reviewed)
  - Fields: student name, date submitted, recording URL, current mastery, feedback status
  
- `POST /api/curriculum/lessons/:lessonId/submissions/:submissionId/feedback` (servant-scoped)
  - Body: `{ feedbackText: string (max 200 chars) }`
  - Response: updated submission with feedback

**Step 3: Permissions** (Day 2–3)
- Servant can only access submissions from their own group
- Servant can only add feedback (not delete or edit)
- Admin/clergy can override

#### Frontend (4 days)

**Step 1: Servant Feedback Dashboard** (Day 1–2)
- New page: `/dashboard/feedback`
- Shows recent submissions needing review
- Table: Student | Date | Recording | Mastery | [View] [Feedback]
- Click [View] → opens recording player
- Click [Feedback] → modal to enter feedback text (max 200 chars)

**Step 2: Feedback Display** (Day 2–3)
- Update `practice-history.tsx` to show servant feedback
- Format: "Teacher feedback: [text] — [servant name]" + date
- Visible to learner + parent

**Step 3: Integration** (Day 3–4)
- Add "Feedback" tab to servant dashboard
- Notification badge showing count of awaiting-feedback submissions
- Test with mock servant account

---

## Task 1.2: Post-Liturgy Verification (Starting Day 5)

**Effort**: 1 week (3 BE + 4 FE + 1 QA)

**Goal**: After a student leads a hymn at church, servant/clergy marks them "verified ready for liturgy."

**Will include**:
- New `LiturgyService` model (tracks who led what when)
- Servant UI to record after-Sunday liturgy services
- Student view showing liturgy service history
- Clergy query to aggregate who's led at Church

---

## Current State

**On branch**: `phase-1-servant-support`

**Next actions**:
1. Create backend DTOs for feedback endpoints
2. Update Prisma schema
3. Implement submission query + feedback endpoints
4. Create servant feedback dashboard UI

---

## Blockers / Dependencies

None - can proceed immediately after Phase 0 merges.

---

## Estimated Completion

- **Task 1.1**: End of Week 4
- **Task 1.2**: End of Week 4
- **Phase 1 ready**: End of Week 4 (all code, tests, and integration complete)

