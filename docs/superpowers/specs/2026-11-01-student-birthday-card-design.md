# Student Portal Birthday Card — Design

**Date:** 2026-11-01
**Status:** Implemented. Step 2 of the birthday flow (step 1: servant flow, `2026-11-01-servant-birthday-flow-design.md`).

## Decisions (agreed in conversation)
- **Main event:** a personal greeting from the school and church. The XP gift, yearly badge and "your year" recap are out of scope for this step.
- **When:** opens by itself the first time the student opens the portal on their birthday; for the following 7 days a "Your birthday card" banner reopens it.
- **Words:** one **standard message** (not the servant's own text), English only, **signed by the school and church only**, never by an individual servant. Church and school logos at the top.
- **Privacy:** shown only on the student's own private link; the server sends a `birthday` signal instead of the date of birth.

## Implementation
- `getPortalData` returns `birthday: { daysSince, turningAge, year } | null`, computed in the school's timezone from the birthday day to 7 days after.
- Null when the family opted out (`student.metadata.birthdayOptOut === true`) or the implied age is outside 2-30 (guards bogus dates, e.g. the bulk-import default of "today" for a missing date of birth). The same guard now applies to the servant birthday list and notification.
- `StudentBirthdayCard` (dialog + banner), wording in `frontend/src/lib/student-birthday-message.ts`.
- "Seen" is remembered per device and birthday year in localStorage.

## My calls (not discussed)
- Escape and the "Thank you" button close it; focus moves to the button; confetti respects reduced motion.
- No screen exists yet to set the family opt-out flag; it can be set on the student's metadata.
- The banner label is bilingual; the card itself is English only.
- Known data issue: students imported without a date of birth got "the import date" as their birthday. The age guard hides the first years of these, but they will eventually look plausible; the real fix is to fix the import default and clean the data.
