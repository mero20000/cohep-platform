# Execution Plan Tracking — Student Learning Journey (Journey #1)

**Branch**: `phase-0-immediate-wins` → `phase-1-servant-support` → ... → `main`

**Target**: 16 weeks (Oct 2026 – Dec 2026)

---

## Phase 0: Immediate Wins (Weeks 1–2)

**Status**: 🔄 IN PROGRESS

### Task 0.1: Reduce Practice Friction ⏳ STARTING NOW
- **Effort**: 1 day (0.5 FE + 0.5 BE)
- **Goal**: Replace mandatory star-rating after every practice with optional daily check-in
- **Files**:
  - `frontend/src/components/hymn-learning/practice-recorder.tsx`
  - `backend/src/modules/curriculum/hymn-learning.service.ts`
- **Status**: Starting
- **Assigned**: (awaiting dev assignment)

### Task 0.2: Inline Practice History
- **Effort**: 2 days (FE only)
- **Goal**: Show last 3 attempts in hymn detail modal
- **Files**:
  - `frontend/src/components/hymn-learning/hymn-detail-modal.tsx` (new)
  - `frontend/src/components/hymn-learning/practice-history.tsx` (refactor)
- **Status**: Queued (starts after 0.1)
- **Assigned**: (awaiting dev assignment)

### Task 0.3: XP/Badge Governance Documentation
- **Effort**: 3 days (product + clergy)
- **Goal**: Clarify badge criteria; document theological risks
- **Files**:
  - `docs/BADGE_GOVERNANCE.md` (new)
- **Status**: Queued
- **Assigned**: (product lead + clergy review)

### Task 0.4: Moderation Guidelines for User Recordings
- **Effort**: 2 days (product + backend)
- **Goal**: Document retention, privacy, moderation workflow
- **Files**:
  - `docs/RECORDING_MODERATION_GUIDELINES.md` (new)
  - `backend/prisma/schema.prisma` (soft delete feature)
- **Status**: Queued
- **Assigned**: (product lead + backend dev)

---

## Phase 1: Servant Support & Feedback (Weeks 3–4)

**Status**: ⏸️ NOT YET STARTED (depends on Phase 0)

### Task 1.1: Teacher Feedback Loop
- **Effort**: 1 week (3 BE + 4 FE + 1 QA)
- **Goal**: Servants review student recordings and leave feedback
- **Status**: Blocked (waiting for Phase 0)

### Task 1.2: Post-Liturgy Verification
- **Effort**: 1 week (3 BE + 4 FE + 1 QA)
- **Goal**: Clergy/servants mark students "verified ready for liturgy"
- **Status**: Blocked (waiting for Phase 0)

---

## Phase 2: Servant Quick-Check & Parent Engagement (Weeks 5–6)

**Status**: ⏸️ NOT YET STARTED

### Task 2.1: Servant "Ready for Sunday" Dashboard
- **Effort**: 1 week
- **Goal**: Quick readiness view for Sunday liturgy
- **Status**: Blocked

### Task 2.2: Weekly Parent Digest
- **Effort**: 3 days
- **Goal**: Automated email summaries to parents
- **Status**: Blocked

---

## Phase 3: Liturgical Reframing (Weeks 7–12)

**Status**: ⏸️ NOT YET STARTED

### Task 3.1: Clergy Review & Calendar Mapping
- **Effort**: 2 weeks (product + clergy)
- **Goal**: Get approval; map hymns to Church calendar
- **Status**: Blocked (waiting for Phase 0 completion)

### Task 3.2: Discovery UI Redesign
- **Effort**: 2 weeks
- **Goal**: Replace Level-based discovery with Season-based discovery
- **Status**: Blocked (waiting for 3.1)

### Task 3.3: "This Sunday" Expansion
- **Effort**: 1 week
- **Goal**: Show liturgical context + group readiness
- **Status**: Blocked (waiting for 3.1)

---

## Phase 4: Group Engagement & Accessibility (Weeks 13–16)

**Status**: ⏸️ NOT YET STARTED

### Task 4.1: Group Progress Dashboard
- **Effort**: 2 weeks
- **Goal**: Collective mastery map; group milestones; photos
- **Status**: Blocked

### Task 4.2: Accessibility Audit & Improvements
- **Effort**: 2 weeks
- **Goal**: WCAG 2.1 AA compliance; hearing-impaired pathway
- **Status**: Blocked

### Task 4.3: Offline Sync Testing & Documentation
- **Effort**: 1 week
- **Goal**: End-to-end offline testing; conflict resolution
- **Status**: Blocked

---

## Notes

- All phases blocked on Phase 0 completion (governance, moderation, etc.)
- Clergy meeting scheduled for Week 6 (Phase 3.1 dependency)
- Pilot church identified for Week 7 liturgical reframing rollout

