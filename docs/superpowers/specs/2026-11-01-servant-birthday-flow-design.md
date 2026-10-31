# Servant Birthday Flow — Design

**Date:** 2026-11-01
**Status:** Implemented (servant side only; student portal, parent message and class moment are later steps)

## Decisions (agreed in conversation)
- **Finding out:** a "Birthdays" section in the Sunday briefing (past 7 days to next 7 days), plus one in-app notification at 07:00 school time on the day. Passed birthdays stay listed until greeted.
- **Message:** addressed to the **student**, English only, signed with the servant's name, school and church on separate lines. Four versions: Warm (default), Blessing, Personal (real hymn/session counts), and "We miss you" (preselected after 3 absent weeks). Editable before sending.
- **Recipient number:** the student's own number (`metadata.studentPhone`) if saved, otherwise the parent's (`parentPhone` / `parentWhatsApp` / `phone`). Sent by the servant from their own phone via `wa.me`; a number without a country code opens WhatsApp's contact picker (never guessed).
- **After sending:** the servant marks the student greeted (optional private note). One greeting per student per birthday year, visible to the whole team.

## Implementation
- `GET /dashboard/birthdays`, `PUT /dashboard/birthdays/:studentId/greeted` (class-scoped; only students with a birthday in the window).
- `student_birthday_greetings` table (additive migration `20261101000000`).
- `BirthdayNotifier` hourly cron; acts when a school's local time is 07:00 (`School.timezone`); idempotent per servant per day.
- Templates live in `frontend/src/lib/birthday-message.ts`.

## My calls (not discussed)
- "Personal" counts hymns with mastery known/mastered and sessions present/late since the previous birthday.
- The notification reaches servants whose profile has a group (or level) matching the student; servants whose class is derived only from sessions are covered by the briefing section, not the notification.
- Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
- School and church names come from `School.name` and `School.church.name`.

## Addendum — "Birthdays this week" on the dashboards (2026-11-01)
- The same card (`BirthdaysSection`) now sits on the **servant dashboard** (own class) and the **admin dashboard** (whole school: admin, principal, super admin), with the same WhatsApp / call / mark-greeted actions and message sheet as the briefing.
- **Admins can send greetings**, signed with their own name plus school and church.
- `GET /dashboard/birthdays?scope=school` and `PUT /dashboard/birthdays/:id/greeted?scope=school` widen to the whole school only for school-wide roles; anyone else keeps their class.
- School view: level filter chips, first 8 shown with "Show all".
- **Double greetings:** a row shows "Greeted by {name}"; opening an already-greeted student shows a notice but still allows sending.
- The card renders nothing in weeks without birthdays (mounted without a wrapper so it leaves no gap). Admins get no morning notification.
- No migration; the response gains level/group names and `greeted.by`.
