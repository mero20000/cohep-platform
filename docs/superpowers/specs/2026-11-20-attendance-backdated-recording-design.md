# Backdated attendance recording — Design

**Date:** 2026-11-20
**Status:** Approved in conversation ("Proceed"), short design

## Why
Servants sometimes record a class after the day. Today `startClass` only ever creates/finds *today's* session (`scheduledDate = now`), so a missed class can only be recovered by an admin pre-creating a session in Manage Sessions.

## Decisions (agreed in conversation)
- The "No session today" screen gains **Record a past class** next to Start Class, and a **Missed** list with a **Record now** action per item.
- Any servant may pick any past date from the calendar and start recording; there is no limit on how far back (changed from the original 7-day cap).
- Backfilled data is labelled, so reports can tell live from late entry.

## Design
**Backend (`attendance` module, no migration)**
- `POST /attendance/start-class` takes optional `date` (`YYYY-MM-DD`). Same group/level/grade/gender logic and the same cross-servant "reuse that day's session" dedupe, but windowed on `date`. Future dates → 400. No limit on how far back a day may be, and no role restriction. If nobody was enrolled in that class on that day the request is refused (400) instead of leaving an empty session. `scheduledDate` = noon of that date.
- Roster for a past-day class session only includes students whose `createdAt` is on/before the end of that day (applies to the seed in `startClass` and to `syncSessionStudents`, so later joiners don't appear as absent).
- Late label: `session.metadata.lateEntry = { daysLate, recordedAt }`, set when a class is created for a past date and when `finalizeSession` completes a session whose day is before today.
- `GET /attendance/missed` (current user): last 7 days (this look-back only limits the Missed list, not the date picker), before today, class sessions:
  (a) existing sessions in `scheduled`/`in_progress` scoped like `getSessions` for servants, returned with `sessionId`;
  (b) inferred days: weekdays on which the servant had a non-cancelled class in the last 8 weeks, with no non-cancelled class for their group that day, returned with `date`, `groupId`, `levelId`.

**Frontend (`mark-client.tsx`)**
- Empty state: Start Class, Record a past class (date picker, yesterday back to 7 days ago; no lower bound for privileged roles), Missed list.
- Date flows through the existing group picker into `start-class?date=`.
- Header badge "Recorded N days late" for sessions with `metadata.lateEntry`.
- Mark All Present on a past-day session shows an extra warning line.

## Non-goals
Any approval workflow or cap for old dates; changing re-open rules; Insights changes; suppressing notifications.

## My calls (not discussed)
- Side effects (XP, badges, 3-absences alert) are left as they are: the alert query orders by `scheduledDate`, so a backfill lands in the right place.
- Inferred missed days come from the servant's own recent weekday pattern, since no schedule exists.
- All "which day is it" decisions (today, daysLate, day windows, roster cut-off, the Missed list) use the school's timezone (`School.timezone`), not the server clock.

## Known limits
- Nothing limits how far back a servant can record, and `POST`/`PUT /attendance/sessions` already let any staff role set a class date. A class finalized on a later day is always labelled `lateEntry`, so late data stays visible.
- The Mark-All warning on the Mark page compares the session's day with the browser's clock, so a browser in a different timezone from the school can disagree by a day around midnight.
