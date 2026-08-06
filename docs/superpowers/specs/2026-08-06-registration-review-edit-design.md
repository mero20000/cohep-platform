# Registration Review & Edit — Design

Date: 2026-08-06
Status: Approved

## Overview

Extend the super-admin registration review flow so that (1) details can be
modified before approving or rejecting, (2) processed records stay visible with
their status (Pending Review / Approved / Rejected), and (3) decisions are
reversible. Uses the existing data model — a pending registration *is* the
`School` row (with `registrationStatus`) plus its admin `User`.

## Requirements

1. Super admin can edit all registration fields before/after a decision:
   church name, country, city, education language, and the admin account's
   first/last name, email, phone.
2. Records remain listed after processing with status: Pending Review,
   Approved, Rejected.
3. Decisions are reversible:
   - Rejected records can be edited and re-approved.
   - Approved records can be edited, re-rejected (deactivates school + locks
     admin), or deleted.
4. Super admin can soft-delete a registration record.
5. Emails: only the existing approve/reject emails (approval goes to the
   current, possibly edited, email). No emails on edits.

## Approach

Reuse the existing `School.registrationStatus` + admin `User` records
(Approach A). No schema changes.

## Backend (`admin` module — super_admin only)

### GET /admin/registrations?status=pending|approved|rejected|all

Returns all non-deleted registrations, ordered by `createdAt desc`:

```ts
{
  id, schoolName, churchName, country, city, educationLanguage,
  registrationStatus, isActive, createdAt,
  users: [{ id, firstName, lastName, email, phone, isActive }]  // take 1
}
```

`status` derives from `registrationStatus`. `status=all` (or omitted) returns
every non-deleted record. The existing `GET /admin/pending-registrations`
remains for backward compatibility (frontend switches to the new endpoint).

### PATCH /admin/registrations/:id

Edits details before/after a decision. Optional body:

```ts
{
  churchName?: string,
  country?: string,
  city?: string,
  educationLanguage?: string,
  admin?: { firstName?: string, lastName?: string, email?: string, phone?: string }
}
```

Applied in one `$transaction`:
- Church: name (+ nameAr kept in sync with name), country, city
- School: name, country, city, educationLanguage
- Admin User: firstName, lastName, email, phone

Email change on the admin account applies instantly (no re-verification). Only
the single admin account for that school is touched. Returns the updated record
in the same shape as the list.

### POST /admin/registrations/:id/approve

Reversible. Sets school `registrationStatus=approved, isActive=true`; admin
`isActive=true`; sends the approval email to the current (possibly edited)
admin email. Works from `pending` or `rejected` state (re-approve).

### POST /admin/registrations/:id/reject

Reversible. Sets school `registrationStatus=rejected, isActive=false`; admin
`isActive=false`; sends the rejection email. Works from `pending` or `approved`
state (re-reject deactivates the school and locks the admin login).

### DELETE /admin/registrations/:id

Soft-delete: sets `deletedAt` on the School, its Church, and the admin User
(matches the app's soft-delete convention). Record disappears from the list;
data retained for recovery. Returns `{ message }`.

## Frontend (`pending-registrations/page.tsx`)

- **Status tabs**: All / Pending Review / Approved / Rejected (default:
  Pending). Backed by the `status` query param on the new endpoint.
- **Status badge** per card (amber pending / green approved / red rejected),
  replacing the always-amber badge.
- **Edit button** → modal with all editable fields (church name, country,
  city, education language, admin first/last name, email, phone). Saves via
  PATCH; stays on the current tab.
- **Approve / Reject / Delete** per card:
  - Approve: available on Pending and Rejected (re-approve).
  - Reject: available on Pending and Approved (re-reject), with the existing
    typed-confirm pattern.
  - Delete: always available, typed-confirm step.
- **Empty states** per tab ("No pending requests" etc.).
- Approved/rejected cards get a subtle processed tint; all remain visible.

## Testing

- Backend: new spec for the admin service/controller (none exists yet):
  list-by-status, edit (incl. email change), approve-from-rejected,
  re-reject deactivates school + admin, soft-delete.
- Frontend: `tsc --noEmit` clean; manual check of tab switching + edit flow.

## Out of Scope

- Re-verifying edited emails before login.
- Notifying the church about edits (no edit emails).
- Editing beyond the listed registration fields (e.g., school slug, church
  metadata).
