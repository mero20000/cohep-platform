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

## Addendum — the birthday gift (2026-11-01)
- **Decision:** the card has an "Open your gift 🎁" button (a tap, not automatic). It gives **+50 XP** and a **"Birthday Blessing {year}"** badge, once per birthday year, claimable from the birthday until 7 days after. The badge is from the school and church (no servant attribution).
- `POST /student-portal/:code/birthday/claim` → `GamificationService.claimBirthdayGift`. The XP rides on the badge (`xpReward = BIRTHDAY_GIFT_XP`), so badge and XP are paid in one transaction by the existing `awardBadge` (which also notifies the student). Repeats return `claimed: false` and pay nothing; `student_badges` is unique per student and badge, which also covers a racing double tap.
- The yearly badge is created per school on first claim (`category: 'birthday'`, `criteria.rule: 'birthday'`).
- **Grant-only rule:** a `birthday` badge is never auto-awarded and is skipped by the "recheck" that revokes badges a student no longer qualifies for, so it and its XP can't be clawed back after an unrelated attendance change.
- The portal birthday signal gains `giftClaimed`; the card then shows "Your gift is already opened".
- Portal data refreshes quietly after the gift so XP and badges update behind the card.
- Also fixed: the card crashed on `null` when a student hides their name (now "Happy birthday, friend!"), and a symbolic badge icon (`cake`, seed icons like `footprints`) could throw in `next/image`; a tolerant `BadgeIcon` now renders those as emoji.
- Not changed: seasonal badges (`rule: 'seasonal'`) look exposed to the same recheck revocation; worth a separate look.
