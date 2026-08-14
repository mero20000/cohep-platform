# Design: Current-Week Attendance Summary on Ministry Dashboard

**Date:** 2026-08-14
**Status:** Approved (design), pending spec review

## Goal

Show a "This Week" attendance summary card on the servant/ministry dashboard with Present / Absent / Late / Excused counts (and total), scoped to the servant's assigned groups, covering the current week's Saturday + Sunday sessions.

## Problem

The ministry dashboard currently shows only an overall "Attendance %" stat that is computed from all records across all time. Servants need a quick view of how the current weekend's classes went — how many students were present, absent, late, or excused — without navigating to the attendance page.

## Decisions

- **Placement:** New card on the ministry dashboard (user-confirmed).
- **Week definition:** The academic week runs Saturday → Sunday (matches the curriculum calendar's generated weeks). The summary covers records from sessions whose `scheduledDate` falls on the current week's Saturday or Sunday (user-confirmed "Saturday and Sunday of that week").
- **Scope:** Only the servant's assigned group(s), reusing the `groupIds` already resolved in `getMinistryView` (user-confirmed "My assigned groups").
- **Approach:** Extend the `/dashboard/mine` ministry response (option 1) rather than a new endpoint or client-side aggregation.
- **No-data behavior:** `attendanceRate` = `0` when there are no records.

## Backend — `dashboard.service.ts` (`getMinistryView`)

1. Compute the current week's Sat/Sun bounds server-side:
   - `daysSinceSat = (now.getDay() + 1) % 7` (`getDay`: Sun=0 … Sat=6)
   - `saturday = now − daysSinceSat`, clamped to `00:00:00.000`
   - `sunday = saturday + 1 day`, clamped to `23:59:59.999`
2. Add one parallel query to the existing `Promise.all` in `getMinistryView`:
   - `attendanceRecord.findMany` with:
     - `where: { attendanceSession: { scheduledDate: { gte: saturday, lte: sunday }, groupId: { in: groupIds } }, student: { deletedAt: null } }`
     - `select: { status: true }`
3. Derive and return `thisWeek`:
   - `present`, `absent`, `late`, `excused` = counts by `status`
   - `total` = sum of the four
   - `attendanceRate` = `total > 0 ? Math.round(((present + late) / total) * 100) : 0`
4. Add `thisWeek` to the ministry response object.

## Frontend — `dashboard-client.tsx`

- New `WeekSummaryCard` component styled like existing cards (white rounded-xl, header with icon + "This Week" / "ملخص هذا الأسبوع", link to Attendance page).
- Reads `d.thisWeek` (props: `thisWeek`, `lang`).
- Renders stat chips: Present (green), Absent (red), Late (amber), Excused (gray), plus Total and the attendance rate.
- Returns `null` when `thisWeek` is missing — same pattern as `WeekScheduleCard`.
- Placed in `MinistryDashboard` right after the existing "This Week Schedule" card (dashboard-client.tsx:1743).

## Error Handling

- Backend: plain count query; no new failure modes. `total = 0` → rate `0`.
- Frontend: card hides when data missing. Data flows through the existing `/dashboard/mine` fetch, which already has `onRetry` error handling — no new fetch/error path.

## Testing

- Backend: add `backend/src/modules/dashboard/dashboard.service.spec.ts` (no dashboard spec currently exists; module specs are co-located, e.g. `attendance.service.spec.ts`). Assert:
  - `thisWeek` status counts when records exist inside the Sat/Sun window.
  - Records outside the window are excluded.
  - `attendanceRate` = `0` when no records.
- Frontend: type-check clean; extend existing dashboard test coverage if feasible.

## Out of Scope

- No changes to the management/parent dashboards.
- No changes to the overall all-time attendance stat (already fixed separately).
- No drill-down or per-session breakdown.