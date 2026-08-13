# Servant Role Improvements — Design

Date: 2026-08-13

## Context

Three servant-role usability issues:

1. Servants can start a class but there is no explicit "End Class" option.
2. In the Mark Attendance form, the group is shown as read-only text; it should
   be a dropdown that reflects the logged-in servant's assigned group and can be
   updated when needed.
3. The "Your Ministry Journey" years counter uses a cached `yearsOfService`
   refreshed by a nightly cron; it should be calculated from the servant's
   joined date.

## 1. End Class

### Current state

- `AttendanceSession.status` is `in_progress` while a class is open.
- Closing a class happens only via the "Completed" button in the Mark
  Attendance panel (`frontend/src/app/dashboard/attendance/attendance-client.tsx:694-698`),
  which sends `PUT /attendance/sessions/:id` with `{ status: 'completed' }`.
- `actualStartTime` and `actualEndTime` exist on `AttendanceSession`
  (`backend/prisma/schema.prisma:692-693`) but are never written anywhere.

### Design

- **Backend** — `updateSession` (`backend/src/modules/attendance/attendance.service.ts:800`):
  - When status transitions to `in_progress` and `actualStartTime` is null,
    set `actualStartTime` to now.
  - When status transitions to `completed`, set `actualEndTime` to now.
  - No new endpoint. Both the existing "Completed" button and the new
    "End Class" button send `PUT /sessions/:id` with `{ status: 'completed' }`.
- **Frontend — dashboard Active Session card** (`TodaysSessionCard`,
  `frontend/src/app/dashboard/dashboard-client.tsx:789`):
  - Add an "End Class" button next to the Attendance link.
  - It calls `PUT /attendance/sessions/:id` with `{ status: 'completed' }`,
    shows a toast, and reloads the card so the session disappears.
- **Frontend — attendance page**:
  - Rename the green "Completed" button in the Mark Attendance panel
    (`attendance-client.tsx:694-698`) from "إكمال وإنهاء / Completed" to
    "إنهاء الفصل / End Class". Behavior is unchanged (save + status completed).

### Data flow

```
End Class button → PUT /attendance/sessions/:id { status: 'completed' }
  → updateSession sets actualEndTime = now
  → sendPracticeGuideNotifications fires for present students
  → dashboard/attendance reloads; session no longer in_progress
```

## 2. Mark Attendance — group dropdown

### Current state

- Mark Attendance panel (`attendance-client.tsx:534`) shows level/group as
  read-only text (`attendance-client.tsx:553`), derived from the selected session.
- Servant's assigned group is stored in `user.metadata.groupId`.
- Group dropdowns exist only in the New/Edit Session modals
  (`attendance-client.tsx:888-899, 951-964`).

### Design

- **Backend** — `updateSession` (`attendance.service.ts:800`):
  - Currently `syncSessionStudents` runs only when `status` changes (line 823).
  - Change it so `syncSessionStudents` also runs when `groupId` changes, so the
    student roster re-syncs to the newly selected group: students no longer in
    the group are removed, new students get `unmarked` records.
- **Frontend — attendance page**:
  - In the Mark Attendance panel header (line 553), replace the read-only group
    text with a group `<select>` when the session is not completed.
  - Default value: the session's current group.
  - When the logged-in servant has an assigned group
    (`localStorage.user.metadata.groupId`), pre-select it if it matches a group
    in the dropdown, and show an "assigned" hint.
  - On change: call `PUT /attendance/sessions/:id` with `{ groupId }`, then
    re-fetch the session detail to refresh the student list.
  - When the session is completed, show read-only text as today.

### Data flow

```
Change group select → PUT /attendance/sessions/:id { groupId }
  → updateSession updates groupId
  → syncSessionStudents reconciles attendanceRecords to new group roster
  → frontend re-fetches session detail; student list refreshes
```

## 3. Ministry Journey years from joined date

### Current state

- `yearsOfService` is served from cached `ServantProfile.yearsOfService`,
  refreshed nightly by a cron using `metadata.dateJoined` with fallback to
  `user.createdAt` (`backend/src/modules/servants/servants.service.ts:320-322`).
- Journey card (`frontend/src/components/dashboard/servant-journey-card.tsx:34`)
  displays the cached value.

### Design

- **Backend**:
  - Add `dateJoined: string | null` to `ServantProfileData`
    (`servants.service.ts:8-22`).
  - Populate it in both response builders (`getServantProfile` line 238 and
    `getSchoolServantSummary` line 290) from
    `metadata.dateJoined ?? user.createdAt`.
- **Frontend**:
  - Add `dateJoined: string | null` to the client `ServantProfileData` type
    (`frontend/src/components/servants/hooks.ts:6-20`).
  - In `servant-journey-card.tsx:34`, compute years live:
    `Math.floor((Date.now() - new Date(profile.dateJoined).getTime()) / (365.25 * 24 * 3600 * 1000))`.
    Fall back to `profile.yearsOfService` when `dateJoined` is absent.

### Data flow

```
GET /servants/profile/me
  → ServantProfileData.dateJoined = metadata.dateJoined ?? user.createdAt
  → journey card computes years from dateJoined (fallback to cached value)
```

## Scope / Non-goals

- No new database columns; no migrations required.
- `actualStartTime`/`actualEndTime` use the existing schema fields.
- No changes to the admin servant form or the servant profile page.
- The dashboard quick-attendance PATCH path
  (`dashboard-client.tsx:832`) is known-broken (no backend PATCH endpoint) but is
  out of scope for this task.

## Testing

- Backend: unit/integration tests for `updateSession` recording
  `actualStartTime`/`actualEndTime` and re-syncing students on `groupId` change.
- Frontend: keep existing attendance tests green; add coverage for the group
  select behavior in the Mark Attendance panel where a test harness exists.