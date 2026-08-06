# Servants Card View, Contact Links & Role Access — Design

Date: 2026-08-06
Status: Approved

## Overview

Upgrade the servant module so super admins and admins get a proper card view of
servants with quick edit + contact actions, while principals and level leaders
get a strict **view + contact** experience (no add/edit/delete). Servants are
`User` records holding servant roles (`servant`, `group_leader`, `level_leader`)
managed through the Users module — there is no dedicated servant entity.

Three changes:

1. **Backend:** a dedicated `GET /servants` endpoint that returns only
   servant-role users, school-scoped, role-gated — so granting leaders access
   never exposes non-servant accounts (the current `GET /users` returns all
   users in a school, which is why we do NOT just widen its role gate).
2. **Frontend:** a table ⇄ card **view toggle** on the servants page
   (persisted per user, default **cards**), a card grid with the existing
   `PhoneLink` contact component (Call `tel:` + WhatsApp `wa.me/` dropdown),
   and the table's plain-text phone upgraded to `PhoneLink`.
3. **Access control:** super_admin + admin = full CRUD (unchanged); principal +
   level_leader = **view-only + contact** (edit/add/delete hidden). Backend
   already restricts `PATCH/DELETE /users/:id` to super_admin/admin, so the UI
   gating is defense-in-depth.

## Requirements

1. Super admin and admin can toggle between table and card views on the
   servants page; the choice persists (localStorage) and defaults to cards.
2. Servant cards show: avatar, name + active dot, role badge, level/group,
   teaching subjects (max 2 + "N"), a contact row using `PhoneLink` (Call /
   WhatsApp), and edit/delete actions when the role allows.
3. The table's Contact column renders `PhoneLink` (was plain text).
4. Servants page uses `GET /servants` instead of `GET /users` + client-side
   role filter.
5. principal + level_leader can view the servants list and use Call/WhatsApp
   but see no Add/Edit/Delete controls.
6. Backend `GET /servants` returns **only** users whose roles are in
   `['servant', 'group_leader', 'level_leader']`, soft-deletes excluded.
7. Arabic labels are provided for all new UI.

## Approach

Dedicated `GET /servants` endpoint (Approach B, approved). Keeps `GET /users`
private while giving leaders a safe, servant-only view.

## Backend (`servants` module)

### GET /servants

- **Roles:** `super_admin`, `admin`, `principal`, `level_leader`
  (`@Roles(...)` + existing `JwtAuthGuard, RolesGuard` on
  `servants.controller.ts`).
- **School scoping** mirrors `users.service.ts` `listUsers` rules:
  - `super_admin`: sees all schools (no `schoolId` filter).
  - everyone else: scoped to `requestingUser.schoolId`.
- **Role filter:** `userRoles.some(role => ['servant','group_leader','level_leader'].includes(role.name))`.
- **Excludes** `deletedAt !== null` users.
- **Query params (all optional):** `search` (matches firstName/lastName/email,
  case-insensitive), `role` (single role name), `levelId`, `groupId`
  (via `metadata.levelId` / `metadata.groupId`), `teachingSubject` (via
  `metadata.teachingSubjects`).
- **Response shape** (matches what the servants page already consumes):

```ts
{
  id, firstName, lastName, firstNameAr, lastNameAr, email, phone, avatarUrl,
  isActive, lastLoginAt,
  userRoles: [{ role: { id, name, displayName } }],
  metadata: { teachingSubjects?, levelId?, groupId? }
}
```

- `levelId`/`groupId` query params are filtered in JS on `metadata` (Prisma
  `Json` fields can't be filtered portably); the filter set is small so this is
  fine for a school-sized dataset.

### Implementation location

`servants.service.ts` (currently liturgy-verification logic) gains a
`listServants(requestingUser, query)` method; `servants.controller.ts` gains the
route. `ServantsModule` already imports `DatabaseModule`, so `PrismaService` is
available.

## Frontend (`servants/page.tsx`)

Keep the existing page as the shell (filters, stats, edit modal, delete flow).
Add:

### Data source

- Fetch `GET /servants` instead of `GET /users` + `SERVANT_ROLES` filter.
  The page's `ServantUser` interface already matches the response shape.

### View toggle

- Segmented control (Table / Cards) rendered near the search/filter bar.
  Icons: `Rows3` (table), `LayoutGrid` (cards).
- Persisted under localStorage `servants_view` = `'table' | 'cards'`,
  default `'cards'`. Read on mount; write on toggle.
- State: `view` in the page component; drives which render block is shown.

### Card grid (cards view)

- `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
- Card contents:
  - Header: avatar (reuse `Image` logic), name + active dot, role badge
    (`ROLE_BADGE`), edit/delete buttons if role has `servant:edit`/`servant:delete`.
  - Meta row: level/group text (same derivation as the table's
    "Level / Group" cell).
  - Teaching subjects chips (max 2, then "+N").
  - Contact row: `<PhoneLink phone={s.phone} lang={lang} />` (import from
    `@/app/dashboard/students/_components/phone-link`).
- Edit button reuses the existing `openEdit` modal flow (no new form).
- Delete reuses `setDeleting`/`setShowDelete` ConfirmDialog flow.

### Table view

- Unchanged layout, except the Contact cell (`servants/page.tsx` ~line 502)
  replaces the plain-text phone with `<PhoneLink phone={s.phone} lang={lang} />`.

### View-only gating (principal + level_leader)

- Page requires `servant:view` (nav already gates this).
- Hide when `!hasPermission(role, 'servant:create')`: "+ Add Servant" button.
- Hide Edit (Pencil) buttons when `!hasPermission(role, 'servant:edit')`.
- Hide Delete (Trash) buttons when `!hasPermission(role, 'servant:delete')`.
- When neither edit nor delete is allowed (principal/level_leader), hide the
  entire Actions column (both `<th>` and the per-row `<td>`) in table view and
  omit the action row in card view — nothing renders empty.
- All existing Arabic strings preserved; new strings (view toggle labels,
  empty-card-state) get ar/en labels.

## Testing

- **Backend:** new `servants.service.spec.ts` with mock Prisma:
  - returns only servant-role users (mixed roles fixture → only servant ones).
  - school scoping: super_admin no filter; others filtered by schoolId.
  - `search`, `role`, `levelId`, `groupId`, `teachingSubject` filters.
  - soft-deleted users excluded.
  - controller route is role-gated to the four allowed roles (assert the
    `@Roles` metadata via the existing RolesGuard pattern, or rely on the
    controller decorators being present).
- **Frontend:** `tsc --noEmit` clean; manual: toggle persists across reload,
  cards render, PhoneLink opens Call/WhatsApp correctly (`+`-stripped for
  wa.me), view-only role hides actions, Arabic labels render.

## Out of Scope

- Editing servants from the card (edit stays in the existing modal).
- SMS sending — WhatsApp/Call only, via device `wa.me`/`tel:` links.
- Role editing for principal/level_leader (backend already denies it).
- Changing `GET /users` role gate.
- Servant assignment screens outside this page.
