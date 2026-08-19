# Servant Weekly Briefing — "This Sunday" Screen Design

> **Date:** 2026-08-19
> **Status:** Approved (approach A) via delegated execution
> **Module:** Module 3 — Servant empowerment
> **Parent spec:** `docs/superpowers/specs/2026-08-19-servant-my-class-design.md` (the My Class feature this extends)

## Problem

Servants already see a weekly digest on their main dashboard (`getServantDigest` → `ServantWellbeingPanel`) and a "My Class" at-a-glance screen (`getClassOverview`). What they do **not** have is a single "This Sunday" prep view that tells them: what day/season it is liturgically, what lesson is coming up next to prepare, their next class session, and which students to follow up on before it. Coptic calendar/season data is the biggest gap — the dashboard module has zero Coptic awareness, while real Coptic-calendar helpers already exist (private) in `hymn-learning.service.ts`.

## Goals & Non-Goals

### Goals
- One read-only "This Sunday" screen that answers: *What's the liturgical context? What lesson should I prepare? When is my next class? Which students should I check on?*
- Reuse existing digest/roster machinery via shared helpers — no duplicated logic.
- Surface the real Coptic date + liturgical season + feast/fast.

### Non-Goals
- No new DB tables / migrations (read-only; reuses existing models).
- No AI, no community feed, no outreach/persistence (the deferred follow-up *workflow*).
- No changes to the existing `getServantDigest` or main dashboard.

## Confirmed decisions (from brainstorm)
1. **Coptic banner** — include real Coptic date + season + feast/fast (recommended).
2. **"This Sunday's lesson"** = the **next upcoming** `CurriculumAllocation` (`scheduledDate >= now`, earliest first) for the servant's levels — the lesson to *prepare*. If today is the teaching day and the lesson hasn't passed, it naturally returns today's lesson.
3. **Follow-up section** = a **read-only checklist** reusing the class-overview roster flags (likelyAbsent / needsFollowUp) + reasons + notes. No persistence.

---

## Architecture

**Approach A** — new `GET /dashboard/weekly-briefing` endpoint composed from shared helpers.

### Components

1. **`backend/src/common/utils/coptic-calendar.ts`** (new shared util)
   - Move from `hymn-learning.service.ts`: `gregorianToJD`, `jdToCoptic`, `COPTIC_MONTHS`, `getCopticSeason`, `getUpcomingSundayDate`. `hymn-learning.service.ts` is updated to import these from the util (no behavior change).
   - Add `COPTIC_MONTHS_AR` (Arabic month names) and `getCopticDateLabel(coptic)` → `{ en, ar }` label, e.g. "5 Koiak 1742" / "5 كيهك 1742".
   - Add `getFeastOrFast(month, day)` → `{ key, en, ar } | null` using a conservative feast/fast table (below).
   - Add `SEASON_LABEL: Record<season, { en, ar }>` for `kiahk | nativity | great_lent | bright_week | regular`.
   - Add `getCopticContext(date: Date)` → `{ coptic: { month, day, year, monthName, monthNameAr }, season, seasonLabel: { en, ar }, feastFast: { key, en, ar } | null }` — the single convenience the dashboard service calls.

2. **`backend/src/modules/dashboard/dashboard.service.ts`** (modify)
   - Extract the roster assembly from `getClassOverview` (records scan, overdue scan, ungraded scan, per-student loop incl. `likelyAbsent` + `followUpReasons` + notes, flagged-first sort) into a shared private helper:
     `private async buildClassRoster(studentIds, followUpLessonId, nextSessionWeekday)` → the roster array. `getClassOverview` calls it with `todayLesson?.lessonId ?? null` and the next-session weekday — **behavior unchanged** (existing `getClassOverview` tests must still pass).
   - Add `private async findNextUpcomingLesson(levelIds, schoolId)` → the next `CurriculumAllocation` (`scheduledDate >= now`, `orderBy scheduledDate asc`, include lesson/level/subject) or `null`.
   - Add `async getWeeklyBriefing(user, schoolIdentifier)`:
     - `schoolId = resolve`, `{ groupIds, levelIds, studentIds } = resolveServantClass`.
     - `nextSession` = next scheduled `attendanceSession` (same query as `getClassOverview`).
     - Teaching date = `nextSession.scheduledDate` if present else `new Date()`; `coptic = getCopticContext(teachingDate)`.
     - `nextLesson = findNextUpcomingLesson(levelIds, schoolId)`.
     - `roster = await buildClassRoster(studentIds, nextLesson?.lessonId ?? null, nextSession weekday)`.
     - Returns `{ generatedAt, coptic, nextSession, nextLesson, roster }`.

   **Return shapes (exact):**
   ```
   coptic: { coptic: {month, day, year, monthName, monthNameAr}, season, seasonLabel: {en, ar}, feastFast: {key, en, ar} | null }
   nextSession: { id, scheduledDate, levelId, levelName?, levelNumber?, groupId, groupName? } | null
   nextLesson: { lessonId, title, titleAr?, titleCoptic?, levelId, levelName, levelNumber, subjectName, scheduledDate } | null
   roster: [{ studentId, firstName, lastName, firstNameAr?, lastNameAr?, photoUrl?, attendanceRate, lastAttendanceStatus, likelyAbsent, needsFollowUp, followUpReasons: string[], notes: [{category?, note?, isPrivate, createdAt}] }]
   ```

3. **`backend/src/modules/dashboard/dashboard.controller.ts`** (modify)
   - Add `@Get('weekly-briefing')` with `@Roles(...STAFF_ROLES)`, `@CurrentUser() user`, `@Query('schoolId')` → `service.getWeeklyBriefing(user, schoolId)`.

4. **`frontend/src/components/dashboard-shell.tsx`** (modify)
   - Add nav item after `My Class`: `{ name: 'This Sunday', nameAr: 'أحد الأسبوع', href: '/dashboard/briefing', icon: Sun, perm: 'attendance:record' as const }`. Import `Sun` from lucide.

5. **`frontend/src/app/dashboard/briefing/page.tsx`** (new)
   - Fetches `GET /dashboard/weekly-briefing` via `http.get` in `useEffect` (mounted guard), `error` state with Retry (mirror the My Class page patterns).
   - Sections (bilingual en/ar, RTL-aware):
     - **Header:** "This Sunday" / "أحد الأسبوع".
     - **Coptic banner card:** Coptic date label (e.g. "5 Koiak 1742"), season label, and feast/fast label when present (feast/fast styled as an accent chip).
     - **Next session card:** date/time + group + level, with a "Start Class" CTA linking to the attendance page with `?sessionId=<id>&prefill=present` (mirror the digest's `nextSession` CTA). Hidden if no next session.
     - **"Prepare this lesson" card:** next lesson title (Ar/En), `titleCoptic` (styled `coptic-text`), subject, level, scheduledDate. Empty-state text if none scheduled.
     - **"Follow up before Sunday" checklist:** flagged roster (`likelyAbsent || needsFollowUp`), each row = avatar + name + reason chips (`REASON_LABEL` keys: `overdue_review`, `low_mastery`, `absent_3plus`, `ungraded_assessment`) + last status + expandable notes. Empty-state "All caught up" when nothing flagged. A "View full class" link → `/dashboard/my-class`.
     - Skeleton while loading; distinct error state + Retry on failure.

6. **Tests**
   - Backend: `coptic-calendar.spec.ts` (jdToCoptic known values, season mapping, feast/fast table boundaries incl. precedence of exact-day feasts over ranges, `getCopticDateLabel`). `dashboard.service.spec.ts` — add `getWeeklyBriefing` tests (coptic context, next-lesson selection incl. "none scheduled" → null, roster reuse via `buildClassRoster`, empty cases) + confirm existing `getClassOverview`/`getMine`/digest tests still pass after the `buildClassRoster` extraction. Controller route test.
   - Frontend: `briefing/page` test file — banner, next-session CTA, lesson card, checklist badges, empty state, error→retry.

---

## Feast/Fast table (`getFeastOrFast`)

Coptic month numbers (1=Thout, 2=Paopi, 3=Hathor, 4=Koiak, 5=Tobi, 6=Amshir, 7=Paremhotep, 8=Parmouti, 9=Pashons, 10=Paoni, 11=Epip, 12=Mesori, 13=Nasie). **Exact-day feasts take precedence over ranges.**

| Month | Day(s) | key | en | ar |
|---|---|---|---|---|
| 1 | 1 | nayrouz | Nayrouz (New Year / Martyrs) | النيروز (رأس السنة / عيد الشهداء) |
| 3 | 1–15 | theotokos_fast | Fast of the Theotokos | صوم السيدة العذراء |
| 3 | 16 | assumption | Feast of the Assumption | عيد صعود العذراء |
| 3 | 16 – 4 | 28 | nativity_fast | Nativity Fast (Advent) | صوم الميلاد |
| 4 | 29 | nativity_paramoun | Paramoun of the Nativity | برمون الميلاد |
| 5 | 1 | nativity | Feast of the Nativity | عيد الميلاد |
| 5 | 6 | epiphany_paramoun | Paramoun of the Epiphany | برمون الغطاس |
| 5 | 11 | epiphany | Feast of the Epiphany | عيد الغطاس |
| 5 | 21–23 | nineveh_fast | Fast of Nineveh | صوم نينوى |
| 7 | 25 | annunciation | Feast of the Annunciation | عيد البشارة |
| 11 | 1–5 | apostles_fast | Apostles' Fast | صوم الرسل |
| 11 | 5 | apostles_feast | Feast of Sts. Peter & Paul | عيد الرسل |

Precedence rule (evaluate in this order):
1. Exact single-day feasts first (nayrouz, assumption, nativity_paramoun, nativity, epiphany_paramoun, epiphany, annunciation, apostles_feast).
2. Then day ranges (theotokos_fast, nativity_fast, nineveh_fast, apostles_fast).

Note: on Hathor 16 (Assumption) and Epip 5 (Peter & Paul), the exact-day feast wins over the overlapping range (nativity_fast / apostles_fast).

## Season labels (`SEASON_LABEL`)

| season | en | ar |
|---|---|---|
| kiahk | Month of Kiahk | شهر كيهك |
| nativity | Nativity Season | زمن الميلاد |
| great_lent | Great Lent | الصوم الكبير |
| bright_week | Bright Week | أسبوع الفرح |
| regular | Ordinary Time | زمن عادي |

---

## Error handling
- API failure → error state + Retry (same pattern as My Class).
- `nextLesson` null → "No lesson scheduled yet" empty card.
- `nextSession` null → hide the next-session card (the Coptic banner falls back to today's date).
- No flagged roster → "All caught up" empty checklist.
- No class at all (no students) → full-page empty state.

## Testing strategy
- **Unit (backend):** coptic-calendar util (pure functions — date conversion, season, feast/fast precedence + boundaries, date label); `buildClassRoster` behavior preserved (existing getClassOverview tests green); `getWeeklyBriefing` composition + empty cases; controller route.
- **Unit (frontend):** page renders banner/lesson/checklist from a mocked payload; empty + error→retry flows.
- **Gate:** backend `jest dashboard.service.spec.ts` + `coptic-calendar.spec.ts`; frontend `tsc --noEmit` + `vitest run` + `next build`.

## Out of scope (explicit)
- Outreach/persistence workflow (deferred).
- AI Sunday-prep (deferred).
- Community feed (deferred).
- Changes to `getServantDigest` or the main ministry dashboard.
