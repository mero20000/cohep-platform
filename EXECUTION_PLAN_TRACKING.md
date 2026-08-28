# Execution Plan Tracking — Student Learning Journey (Journey #1)

**Branch**: `phase-0-immediate-wins` → `phase-1-servant-support` → ... → `main`

**Target**: 16 weeks (Oct 2026 – Dec 2026)

---

## Phase 0: Immediate Wins (Weeks 1–2)

**Status**: 🔄 IN PROGRESS

### Task 0.1: Reduce Practice Friction ✅ COMPLETED
- **Effort**: 1 day (0.5 FE + 0.5 BE)
- **Goal**: Replace mandatory star-rating after every practice with optional daily check-in
- **Files**:
  - ✅ `frontend/src/components/hymn-learning/practice-recorder.tsx`
  - ✅ `backend/src/modules/curriculum/hymn-learning.service.ts`
  - ✅ `backend/src/modules/curriculum/hymn-learning.controller.ts`
- **Status**: ✅ DONE
- **Commits**: 9d90b8c

### Task 0.2: Inline Practice History ⏳ IN PROGRESS
- **Effort**: 2 days (FE only)
- **Goal**: Show last 3 attempts in hymn detail modal
- **Files**:
  - ✅ `frontend/src/components/hymn-learning/practice-history-inline.tsx` (new component created)
  - ⏳ `frontend/src/app/student-portal/[code]/page.tsx` (integrate into modal, TBD)
- **Status**: Component ready, integration pending
- **Commits**: 5f08c67
- **Next**: Integrate into practice recorder modal; test rendering

### Task 0.3: XP/Badge Governance Documentation ✅ COMPLETED
- **Effort**: 3 days (product + clergy)
- **Goal**: Clarify badge criteria; document theological risks
- **Files**:
  - ✅ `docs/BADGE_GOVERNANCE.md` (created, audit framework ready)
- **Status**: ✅ DONE (awaiting clergy review)
- **Commits**: 2c0bc55

### Task 0.4: Moderation Guidelines for User Recordings ✅ COMPLETED
- **Effort**: 2 days (product + backend)
- **Goal**: Document retention, privacy, moderation workflow
- **Files**:
  - ✅ `docs/RECORDING_MODERATION_GUIDELINES.md` (complete, GDPR/COPPA ready)
  - ⏳ `backend/prisma/schema.prisma` (soft delete, deferred to Phase 1)
- **Status**: ✅ DONE (docs complete; schema migration deferred)
- **Commits**: 2c0bc55

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

---

## Phase 0 Summary

✅ **Status**: 75% COMPLETE

### Completed ✅

| Task | Status | Commits | Notes |
|------|--------|---------|-------|
| 0.1 — Reduce Practice Friction | ✅ Done | 9d90b8c | Optional rating flow implemented |
| 0.2 — Inline Practice History | ⏳ 50% | 5f08c67 | Component created; integration TBD |
| 0.3 — Badge Governance | ✅ Done | 2c0bc55 | Audit framework + clergy questions |
| 0.4 — Recording Moderation | ✅ Done | 2c0bc55 | Privacy policy + moderation workflow |

### Remaining ⏳

- Task 0.2 integration into practice modal (1–2 days FE)
- Database audit for badges (query existing badges)
- Clergy review of badge governance (async, external dependency)
- Legal/safeguarding audit of GDPR/COPPA compliance

### Key Blockers & Dependencies

1. **Task 0.2 Integration**: Needs detailed inspection of student portal modal structure (currently blocked on time)
2. **Clergy Review**: Badge governance awaits priest/bishop/cantor review (schedule for Week 2)
3. **Database Audit**: Incomplete without querying actual badges in production (requires backend inspection)

---

## Notes

- All phases blocked on Phase 0 completion (governance, moderation, etc.)
- Clergy meeting scheduled for Week 2 (Phase 3.1 dependency)
- Pilot church identified for Week 7 liturgical reframing rollout
- Next session should complete Task 0.2 integration, run badge audit, and begin Phase 1

