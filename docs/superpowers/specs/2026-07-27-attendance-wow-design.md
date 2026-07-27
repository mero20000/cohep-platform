# Attendance Module — Future State (WOW Features)

Date: 2026-07-27  
Status: Design (pre-implementation)

---

## Overview

Three improvements to the existing attendance module based on the audit:
1. **Arrival Tap** — one-tap "Start class" that pre-fills all-present
2. **Absence Cascade** — auto-notify parent + servant after 3 consecutive absences
3. **Liturgy Heat Map** — visual showing liturgy vs. class attendance patterns

No new database tables or migrations are required. All data already exists in `AttendanceSession`, `AttendanceRecord`, and `Student`.

---

## 1. Arrival Tap

### Backend: `POST /attendance/start-class`

- **Auth**: `@Roles(...STAFF_ROLES)` — servants and above
- **Auto-detect**: Queries `AttendanceSession` for sessions where `servantId = currentUser` in the current academic year, groups by `groupId` to find the servant's group(s). If only one group found → auto-select. If multiple or none → return list of groups for client to pick.
- **Flow**:
  1. Look for a session for today where `servantId = currentUser` and `scheduledDate = today`
  2. If found → return existing session (resume, no duplicate)
  3. If not found → create `AttendanceSession` with `status: 'in_progress'`, `scheduledDate: today`, `scheduledTime: now`
  4. For each student in the group, insert `AttendanceRecord` with `status: 'present'`, `recordedBy: currentUser`
  5. Return full session with records
- **Error states**: servant has no groups → 400 "No groups assigned"; multiple groups → return list for client to pick

### Frontend: Servant Dashboard

- Add a "Start Class" card to the ministry dashboard in `dashboard-client.tsx`
- Shows: today's date, servant's group name(s), prominent button
- On click → `POST /attendance/start-class` → redirect to `GET /attendance/sessions/:id` attendance page with `?mode=exceptions`
- Attendance page in exceptions mode: hides "Mark All" buttons, shows student list with status toggles for fixing exceptions only, Save + Complete buttons remain

---

## 2. Absence Cascade

### Backend: Hook in `AttendanceService.markAttendance()`

After records are saved via `POST /attendance/sessions/:id/mark`:

1. For each record with `status === 'absent'`:
   - Query the last 3 attendance records for that student ordered by `attendanceSession.scheduledDate DESC`
   - If all 3 are `absent` (including current):
     - Create in-app notification for **parent** (type `attendance`, userId from parent link)
     - Create in-app notification for the **servant** who marked it (type `attendance`)
     - Send **email** to `student.parentEmail` via `MailService` with a gentle template
2. The consecutive counter resets when a `present` or `late` record appears in that student's history
3. New private method `checkAbsenceCascade(studentId, servantId)` — called after mark, wrapped in try/catch so it never blocks the attendance save

### Notifications

- **Parent**: in-app + email via MailService
- **Servant**: in-app only
- Email template: simple bilingual (English/Arabic) — "[Student] hasn't attended [group] for 3 weeks. We miss them!"

### MailService addition

New method `sendAttendanceAlert(to: string, studentName: string, groupName: string)` using existing nodemailer setup.

---

## 3. Liturgy Heat Map

### Backend: `GET /attendance/liturgy-heatmap`

- **Auth**: `@Roles(...STAFF_ROLES)`
- **Query params**: `groupId` (optional — defaults to servant's group for servants, all groups for principals), `weeks` (default 8)
- **Returns**:
```json
{
  "totalStudents": 30,
  "weeks": ["2026-07-06", "2026-07-13", ...],
  "students": [
    {
      "name": "George",
      "nameAr": "جورج",
      "liturgyCount": 6,
      "classCount": 10,
      "weeks": [
        { "week": "2026-07-06", "classStatus": "present", "liturgy": true },
        ...
      ]
    }
  ]
}
```
- **Logic**: Query `AttendanceRecord` joined with `AttendanceSession` for the group, grouped by ISO week. `classStatus` from `status` field, `liturgy` from `attendedLiturgy` field. Current academic year only.

### Frontend: CSS Grid Heatmap Card

- **Servant dashboard**: small card showing their group's heatmap
- **Principal dashboard**: larger card with group filter dropdown
- Rendered as a **styled CSS grid table**:
  - Y-axis: student names (scrollable if >15)
  - X-axis: week labels
  - Cell colors: green (present+liturgy), amber (present only), red (absent), gray (no session)
  - Summary row at top: "X attend liturgy regularly" / "Y attend class only"

---

## Files Changed

### Backend
| File | Change |
|------|--------|
| `attendance.controller.ts` | Add `POST /start-class` and `GET /liturgy-heatmap` endpoints |
| `attendance.service.ts` | Add `startClass()`, `liturgyHeatmap()`, `checkAbsenceCascade()` methods |
| `mail.service.ts` | Add `sendAttendanceAlert()` method |
| `mail.module.ts` | Export `MailService` (may already be exported) |
| `attendance.module.ts` | Import `MailModule` and `NotificationsModule` |

### Frontend
| File | Change |
|------|--------|
| `dashboard-client.tsx` | Add "Start Class" card to ministry dashboard |
| `dashboard/attendance/page.tsx` | Add exceptions mode (`?mode=exceptions`) |
| `dashboard/dashboard-client.tsx` | Add Liturgy Heatmap card |
| `dashboard/page.tsx` (or principal dashboard) | Add Liturgy Heatmap card with group filter |

---

## Dependencies

- `@nestjs/schedule` — NOT needed (absence cascade fires on-mark, not cron)
- No new npm packages — Chart.js already available; using CSS grid for heatmap
