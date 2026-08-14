# Subject Item Recording → Cloudflare R2 (Design)

**Date:** 2026-08-14
**Status:** Approved (design)
**Author:** opencode (with user)

## Goal

Let servants (teachers) upload a **recording** (hymn reference) for a **Curriculum Subject Item**, store it in **Cloudflare R2**, surface it in the **parents and students portals** as a reference for the hymn, and let the servant **attach** that recording to an **Assessment item** as a reference.

## Decisions (from brainstorming)

- **Storage:** Cloudflare R2 (S3-compatible object storage).
- **Access:** Public read URL. The R2 bucket is made public (or served via custom domain / `r2.dev`); the backend stores a permanent public URL — no presigned/expiry logic.
- **Attachment model:** Upload once on the SubjectItem. The Assessment references an existing SubjectItem recording via a picker (single source of truth). Assessment stores a reference URL, not a copy.
- **File types:** Audio (`.mp3`, `.m4a`, `.ogg`, `.webm`); max 15 MB. (Video out of scope.)
- **Out of scope:** Migrating existing `Lesson.audioUrl` (local disk) to R2. Existing lesson audio is left as-is.

## Architecture

```
Servant (admin)
  subjects-tab.tsx  ──upload──▶  POST /curriculum/subjects/items/:id/recording
                                                      │  multer memoryStorage (audio ≤15MB)
                                                      ▼
                                            r2.ts → S3 client → R2 bucket
                                                      │  public URL
                                                      ▼
                                            SubjectItem.recordingUrl (+ recordingMeta)

Assessment form (admin)
  assessments/page.tsx ──picker──▶  GET /curriculum/subjects/:id/items (filter recordingUrl)
                       stores referenceRecordingUrl on Assessment

Portals (read-only)
  student-portal/[code]  ──<audio src={subjectItem.recordingUrl}>──  "Reference recording"
  parents portal         ──<audio src={subjectItem.recordingUrl}>──  hymn / assessment reference
```

## Data model (Prisma)

`SubjectItem` — add:
- `recordingUrl   String?  @map("recording_url")`
- `recordingMeta  Json?    @map("recording_meta")`  // { originalName, sizeBytes, contentType, durationSec? }

`Assessment` — add:
- `referenceRecordingUrl  String?  @map("reference_recording_url")`
- `referenceRecordingName String?  @map("reference_recording_name")`

New migration required. No breaking changes to existing columns.

## Backend

### `src/common/storage/r2.ts` (new)
- Reads env:
  - `CLOUDFLARE_R2_ACCOUNT_ID`
  - `CLOUDFLARE_R2_BUCKET`
  - `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - `CLOUDFLARE_R2_PUBLIC_URL`  (e.g. `https://<bucket>.r2.dev` or custom domain)
- `isR2Configured` boolean.
- `uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string>` →
  - if not configured: **fall back to local disk** `./uploads/audio` (existing pattern) and return `/uploads/audio/<filename>` so local dev works without R2 creds. (No throw — keeps dev usable.)
  - if configured: `new S3Client({ region: 'auto', endpoint: https://<accountId>.r2.cloudflarestorage.com, credentials })`, `PutObjectCommand` with `ACL: 'public-read'`, returns `${PUBLIC_URL}/${key}`.
- Key format: `recordings/subject-items/<subjectItemId>-<uuid>.<ext>`.
- Add `@aws-sdk/client-s3` dependency.

### `curriculum.controller.ts`
- `POST curriculum/subjects/items/:id/recording`
  - `@UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), fileFilter: audio-only, limits: { fileSize: 15MB } }))`
  - Loads SubjectItem, uploads buffer to R2 via `uploadToR2`, updates `recordingUrl` + `recordingMeta` (originalName, size, contentType).
  - Returns `{ recordingUrl, recordingMeta }`.
  - **Dev fallback:** if `!isR2Configured`, write to `./uploads/audio` (existing local pattern) and return `/uploads/audio/<filename>` so local dev still works without R2 creds.
- `DELETE curriculum/subjects/items/:id/recording` → clears `recordingUrl`/`recordingMeta` (does not delete the R2 object in v1; documents manual cleanup).
- `getSubjectItems` already returns full SubjectItem rows → `recordingUrl` is included automatically.

### `curriculum.service.ts`
- `updateSubjectItem` / `createSubjectItem` already accept `data: any`; ensure `recordingUrl`/`recordingMeta` pass through (they already spread into the update). No change beyond the new controller endpoints.

### `assessments` module
- `CreateAssessmentDto` / `UpdateAssessmentDto`: add optional `referenceRecordingUrl`, `referenceRecordingName`.
- `assessments.service.ts`: persist those fields on create/update.
- `GET /assessments` and detail return them.

## Frontend (admin)

### `src/app/dashboard/settings/_components/subjects-tab.tsx`
- `SubjectItem` interface: add `recordingUrl?`, `recordingMeta?`.
- In the SubjectItem edit form, add a **Recording** section:
  - If `recordingUrl` present: render `<audio controls src={recordingUrl}>` + filename + **Replace** (file input) / **Remove** buttons.
  - Else: a file input (`accept="audio/*"`) + **Upload** button.
  - Upload via `http.upload('/curriculum/subjects/items/<id>/recording', formData)`; on success update local `items` state. Remove via `http.delete(...)`.
  - Reuse the existing `http.upload` pattern used for presentations.

### `src/app/dashboard/assessments/page.tsx`
- Add `referenceRecordingUrl`, `referenceRecordingName` to the form state.
- When a `subjectId` is selected, fetch that subject's items (`/curriculum/subjects/<id>/items`) and build a dropdown of items that have `recordingUrl`.
- Dropdown: label = item name (+ originalName), value = item's `recordingUrl`. On select, store `referenceRecordingUrl` and `referenceRecordingName`.
- Show an inline `<audio controls>` preview of the chosen reference.
- On save, send `referenceRecordingUrl`/`referenceRecordingName` in the payload (both create and update).

## Frontend (portals)

### Student portal — `src/app/student-portal/[code]/page.tsx` (hymn-learning)
- Hymn map items are linked to SubjectItems. When the resolved SubjectItem has `recordingUrl`, render an audio player labelled **"Reference recording"** near the hymn (reuse the existing audio player style used for `resources` audio, or a plain `<audio controls>`).
- The `useStudentHymnMap` / hymn data must carry `recordingUrl`. Confirm the hymn→SubjectItem join returns `recordingUrl`; if the hymn map is a separate table, extend the query/type to include it. (Implementation plan step will verify the exact join.)

### Parents portal — `src/app/dashboard/parents/page.tsx` (and any child detail view)
- Surface the same `SubjectItem.recordingUrl` on the child's hymn/assessment reference views, using an `<audio controls>` player. Scope: at minimum the child's hymn list and assessment reference; follow existing portal layout.

## Access control / auth
- Upload endpoints require the existing servant/admin auth (same guards as other curriculum writes).
- Public playback URLs require no auth (R2 public bucket) — acceptable for non-sensitive hymn references.
- Assessment `referenceRecordingUrl` is returned only as part of assessment data the user is already authorized to see.

## Environment / config
- Add to `.env.example`:
  ```
  CLOUDFLARE_R2_ACCOUNT_ID=
  CLOUDFLARE_R2_BUCKET=
  CLOUDFLARE_R2_ACCESS_KEY_ID=
  CLOUDFLARE_R2_SECRET_ACCESS_KEY=
  CLOUDFLARE_R2_PUBLIC_URL=
  ```
- Document: create R2 bucket, enable public access (or custom domain), create API token with Object Read/Write, set env.

## Testing
- **Backend unit:** `r2.ts` — mock `S3Client.send`, assert key + returned URL; assert throw/fallback when unconfigured.
- **Backend e2e (dry):** `POST .../recording` with a fake audio file when unconfigured → local-disk fallback returns `/uploads/audio/...`; when configured (mocked) → returns R2 URL. Avoid real network.
- **Frontend:** `subjects-tab` renders upload control, replaces, removes (mock `http.upload`/`http.delete`). Assessment picker lists only items with `recordingUrl` and stores the chosen URL.

## Rollout
1. Add migration + `r2.ts` + env docs.
2. Backend endpoints + assessment DTO fields.
3. Admin UI (subjects-tab + assessments).
4. Portal UI (student + parent).
5. Tests.
6. Commit + push (main, rebase before push). Provide user with env steps to enable R2 in their environment.

## Risks / notes
- R2 object deletion on Remove is deferred (manual cleanup) in v1 to keep scope tight.
- If the hymn map is not currently joined to SubjectItem, the portal step needs a small query/type addition — flagged for the plan, not a blocker.
- `Lesson.audioUrl` remains local-disk (explicitly out of scope).
