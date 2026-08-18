# Servant Module Enhancements — Design

**Date:** 2026-08-18
**Status:** Approved

## Overview

Four enhancements to the servant module:

1. **Gender** on the servant form (Female / Male), stored as a first-class column.
2. **Import / export** of the selected servant list (CSV).
3. **Church & School** read-only linkage displayed in the servant form and list.
4. **Group-mates widget** on the servant dashboard: other servants in the same group, with Call / WhatsApp contact.

**Approaches chosen:** A1 (new `User.gender` column) + B1 (new `GET /servants/group-mates` endpoint) + C1 (import via looping `POST /users`). Workstream A (features 1, 3) is implemented first, then Workstream B (features 2, 4).

---

## Workstream A — Gender + Church/School display

### Backend

#### `User.gender` column
Add to `backend/prisma/schema.prisma`:

```prisma
gender   String   @map("gender")
```

- Stored lowercase: `'female' | 'male'` (consistent with `Student.gender`).
- **Migration safety:** add the column as **nullable** in the migration, then **backfill** existing rows with `'male'`, so existing users are never broken. At the API layer the DTO enforces it as effectively required.
- `backend/prisma/schema.prisma` `User` model gains `gender String`.

#### DTO validation
- `CreateUserDto` (`backend/src/modules/users/dto/users.dto.ts`): add `gender` with `@IsIn(['female','male'])` — **required** on create.
- `UpdateUserDto`: add `gender` with `@IsIn(['female','male'])` — **optional** on update.
- `UsersService.createUser` / `updateUser` persist `gender` to the column (not metadata).

#### `GET /servants` — include gender + church/school
In `backend/src/modules/servants/servants.service.ts` `listServants`:
- Add `gender` to the `select` of user fields.
- Enrich each returned servant with the linked **church + school** (read-only) by including:

```ts
school: { select: { id, name, nameAr, logoUrl, church: { select: { id, name, nameAr, logoUrl } } } }
```

Response rows gain `gender` and `school` (with nested `church`).

#### New endpoint `GET /servants/group-mates` (feature 4)
In `backend/src/modules/servants/servants.controller.ts` + `servants.service.ts`:
- Route: `GET /servants/group-mates`, guarded `@Roles('servant', 'group_leader', 'level_leader')`.
- Logic:
  1. Read caller's `user.metadata.groupId`; if absent → return `[]`.
  2. Query `User` where `metadata` has `groupId` equal to mine, `id != caller.id`, `deletedAt: null`, and a servant role present.
  3. Return `{ id, firstName, lastName, firstNameAr, lastNameAr, avatarUrl, phone }`, sorted by name.

### Frontend

#### Servant form (`frontend/src/app/dashboard/servants/page.tsx`)
- Add **Gender** field: required segmented control with `Female` / `Male` (bilingual). Required on create; pre-filled from `user.gender` on edit.
- Add a read-only **Church & School** display block (church name + logo, school name + logo) derived from the logged-in user's school → church (reusing the existing `schoolIdentity` data already fetched at `page.tsx:171`). Not editable.
- Extend the form `state` and reset helpers (`openCreate` at line ~289, `openEdit` at ~299) with `gender`.
- `handleSave` (~330): include `gender` in the `POST /users` / `PATCH /users` body (alongside `metadata`).

#### Servants list (`frontend/src/app/dashboard/servants/page.tsx`)
- Add a **Gender** column (badge: Female/Male, bilingual).
- Add a **Gender filter** dropdown (All / Female / Male) alongside existing filters.
- Add a **Church/School** column showing linked church + school names (read-only), and filter client-side by resolved church/school.
- Extend the `ServantUser` interface with `gender?: string` and `school` (with nested `church`) fields.

---

## Workstream B — Import/export + group-mates widget

### Export (feature 2) — `servants/page.tsx`
- Button **"Export"** shown when `selectedIds.length > 0`, gated by `servant:export` permission.
- Exports **only the selected servants** to CSV with UTF-8 BOM, mirroring the students CSV pattern (`students-client.tsx:186`).
- Columns: `Name, Name (Ar), Email, Phone, Gender, Role, Level, Group, Teaching Subjects, Church, School, Date Joined, Date of Birth`.
- Uses already-loaded servant data (no extra fetch).
- CSV escaping mirrors students: quote fields, double internal quotes, prefix `'` for cells starting with `= + - @`.

### Import (feature 2) — `servants/page.tsx`
- Button **"Import"** (permission `servant:import`) opens a modal with a **downloadable CSV template** + file picker (`.csv`).
- Template columns: `FirstName, LastName, FirstNameAr, LastNameAr, Email, Phone, Gender, Role, Level, Group, TeachingSubjects`.
- On upload:
  - Parse CSV.
  - Map **Level** and **Group** by name → ID (they are already loaded for the form).
  - Map **TeachingSubjects** names → values.
  - Validate each row: required first/last name, valid email, gender `female`/`male`.
  - Show a preview of valid vs invalid rows.
  - On confirm: **loop `POST /users`** per valid row (approach C1), storing assignments in `metadata` as the form does; report created count + per-row errors.
- No new backend endpoint for import.

### Group-mates widget (feature 4) — servant dashboard
File: `frontend/src/app/dashboard/dashboard-client.tsx`, inside `MinistryDashboard`.
- New card **"My Group · Servants"** listing other servants with the same `metadata.groupId`.
- Fetches `GET /servants/group-mates`.
- Each row: avatar, name (bilingual), and **`PhoneLink`** (Call / WhatsApp) for servants with a phone. Reuses `frontend/src/app/dashboard/students/_components/phone-link.tsx`.
- Empty state when no group-mates.
- Placed alongside the existing ministry stats/cards.

---

## Testing & verification

- **Backend:**
  - `backend/src/modules/servants/servants.service.spec.ts`: extend for `gender` in `listServants`; new `getGroupMates` cases (returns same-group servants excluding self; empty when no `metadata.groupId`).
  - Users DTO: unit test gender validation (only `female`/`male`, required on create).
- **Frontend:**
  - `frontend/src/app/dashboard/servants/__tests__/page.test.tsx`: gender field renders + required on save; export button hidden without selection; import modal opens; gender filter filters rows.
  - Ministry dashboard: group-mates card renders servants with `PhoneLink`; empty state when none.
- **Manual:** `npx tsc --noEmit`, `npx vitest run` (frontend), backend `jest` on affected specs.
- **Migration application:** Render runs `prisma migrate deploy` on start, so the `User.gender` migration applies on next deploy.

---

## Out of scope
- Multi-school / multi-church assignment per servant (church + school display is read-only from existing linkage).
- In-app messaging shortcuts in the group-mates widget (Call/WhatsApp only).
- Excel (`.xlsx`) output — CSV chosen to match the students module.
- Bulk-create backend endpoint for import (loops `POST /users` instead).