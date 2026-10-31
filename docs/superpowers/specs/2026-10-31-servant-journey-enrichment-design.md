# Servant Journey Enrichment — Design

**Date:** 2026-10-31
**Status:** Implemented
**Module:** 3 — Servant empowerment

## 1. Milestone celebration, notifications, next milestone
- `servant_milestones.seen_at` (null = not yet celebrated). The migration backfills existing rows as seen.
- The nightly job notifies the servant (in-app `Notification`, type `servant_milestone`, EN + AR, links to the profile) for each newly crossed milestone. A servant's **first-ever** profile run is a silent backfill (seen, no notifications).
- `GET /servants/profile/me` (and own profile) returns `nextMilestone` (closest by progress) and `newMilestones` (unseen). `POST /servants/milestones/seen` dismisses the celebration.
- Thresholds extended (years to 30, students/sessions to 1000, hymns to 200). English ordinals fixed (11th, 21st); milestone `labelAr` is derived on read.
- The journey card and profile page show a dismissible "Thank you for your service" banner and a next-milestone progress bar.

## 2. Persistent follow-up checklist
- New `servant_follow_ups` (one row per servant + student): `status` open/done, private `note` (≤500), `completedAt`.
- `PUT /dashboard/follow-ups/:studentId` `{ done?, note? }`; the student must be in the caller's class (404 otherwise).
- `weekly-briefing` and `class-overview` rosters include `followUp`. A done tick counts for 7 days, then the student reappears as open if still flagged.
- Briefing: "x of y done" counter, done students sink to the bottom. My Class: done badge. Both: tick + note in the expanded row.

## 3. Visibility and scoping
- `GET /servants/:id/profile` now allows only the servant themselves, `admin`, `principal`, `super_admin`, and `level_leader` (same school). The timeline was already self-only.
- `GET /servants/school/summary` is leadership-only (it was open to every servant; unused by the UI).
- `GET /reports/servant-contributions` is leadership-only; the Reports page hides the Servant Report tab for others.
- Student list scoping for servants was already enforced in `StudentsService.getAccessScope`. **Still open:** `priest-pulse` remains available to all staff because servants have `reports:view` and use that page; tightening it needs a servant-facing reports design.
