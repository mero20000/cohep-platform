# Subject Item Recording → Cloudflare R2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let servants upload a hymn recording on a Curriculum Subject Item, store it in Cloudflare R2 (public URL), show it as a reference in the student/parent portals, and let servants attach it to an Assessment as a reference.

**Architecture:** A new `r2.ts` storage helper uploads the buffered audio file to an R2 bucket (S3-compatible) and returns a permanent public URL, with a local-disk fallback when R2 env is unset. `SubjectItem` gains `recordingUrl`/`recordingMeta`; `Assessment` gains `referenceRecordingUrl`/`referenceRecordingName`. The student portal's hymn map (built from `Lesson`, which has `subjectItemId`) is enriched with the linked `SubjectItem.recordingUrl`. The assessment reference is returned by the existing assessment endpoints and surfaced in the parent portal.

**Tech Stack:** NestJS (backend), Prisma, `@aws-sdk/client-s3`, multer `memoryStorage`; React/Next.js + Vitest (frontend); Cloudflare R2.

## Global Constraints

- Storage target: **Cloudflare R2** (S3-compatible object storage).
- Access model: **public read URL** stored permanently in the DB (no presigned/expiry logic).
- Attachment model: upload once on SubjectItem; Assessment references an existing SubjectItem recording via a picker (single source of truth).
- File types: audio only — `.mp3`, `.m4a`, `.ogg`, `.webm`; max **15 MB**.
- Out of scope: migrating existing `Lesson.audioUrl` (local disk) to R2.
- Dev fallback: when `CLOUDFLARE_R2_*` env is not fully set, upload to local `./uploads/audio` and return `/uploads/audio/<file>` so local dev works.
- Env vars required (document in `.env.example`): `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_PUBLIC_URL`.
- Repo: branch `main`, push directly. Always `git pull --rebase --autostash` before pushing.
- Backend tests: Jest. Frontend tests: Vitest (run from `frontend/`). Do NOT modify the 17 pre-existing backend failures.
- Make small, independent commits per task.

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (SubjectItem + Assessment blocks)
- Run migration (creates `backend/prisma/migrations/...`)

**Interfaces:**
- Produces: `SubjectItem.recordingUrl`, `SubjectItem.recordingMeta`, `Assessment.referenceRecordingUrl`, `Assessment.referenceRecordingName` columns for all later tasks.

- [ ] **Step 1: Add fields to `SubjectItem`**

In the `model SubjectItem` block, after `metadata Json?` add:
```prisma
  recordingUrl   String? @map("recording_url")
  recordingMeta  Json?   @map("recording_meta")
```

- [ ] **Step 2: Add fields to `Assessment`**

In the `model Assessment` block, after `metadata Json?` add:
```prisma
  referenceRecordingUrl   String? @map("reference_recording_url")
  referenceRecordingName  String? @map("reference_recording_name")
```

- [ ] **Step 3: Generate client + migration**

Run:
```bash
cd backend && npx prisma generate && npx prisma migrate dev --name add_subject_item_recording
```
If the local DB schema drift blocks `migrate dev`, fall back to `npx prisma db push` (applies the diff without a migration file), then re-run `npx prisma generate`.

- [ ] **Step 4: Verify columns exist**

Run: `cd backend && npx prisma studio` is optional; instead confirm `npx prisma generate` succeeded with no errors.

- [ ] **Step 5: Commit**

```bash
cd backend && git add prisma/schema.prisma prisma/migrations && git commit -m "feat(prisma): add recording fields to SubjectItem and Assessment"
```

---

### Task 2: R2 storage helper + env docs

**Files:**
- Create: `backend/src/common/storage/r2.ts`
- Modify: `backend/package.json` (add `@aws-sdk/client-s3`)
- Modify: `backend/.env.example` (add R2 vars)

**Interfaces:**
- Produces: `uploadRecording(buffer: Buffer, key: string, contentType: string): Promise<string>` returns a public URL (R2) or `/uploads/audio/<file>` (local fallback).
- Produces: `isR2Configured: boolean`.

- [ ] **Step 1: Install dependency**

Run: `cd backend && npm install @aws-sdk/client-s3` (or `pnpm add`).

- [ ] **Step 2: Write the storage helper**

Create `backend/src/common/storage/r2.ts`:
```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { extname } from 'path';

const ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET;
const ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

export const isR2Configured = !!(
  ACCOUNT_ID && BUCKET && ACCESS_KEY && SECRET_KEY && PUBLIC_URL
);

function getClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY!, secretAccessKey: SECRET_KEY! },
  });
}

export async function uploadRecording(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  if (!isR2Configured) {
    const dir = join(process.cwd(), 'uploads', 'audio');
    await mkdir(dir, { recursive: true });
    const filename = key.split('/').pop()!;
    await writeFile(join(dir, filename), buffer);
    return `/uploads/audio/${filename}`;
  }
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    }),
  );
  return `${PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
}
```

- [ ] **Step 3: Document env vars**

Append to `backend/.env.example`:
```dotenv
# Cloudflare R2 (hymn/subject-item recording storage)
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_PUBLIC_URL=
```

- [ ] **Step 4: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors referencing `r2.ts`.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/common/storage/r2.ts package.json package-lock.json .env.example && git commit -m "feat(storage): add R2 recording upload helper with local fallback"
```

---

### Task 3: SubjectItem recording upload/delete endpoints

**Files:**
- Modify: `backend/src/modules/curriculum/curriculum.service.ts` (add `setItemRecording`, `clearItemRecording`)
- Modify: `backend/src/modules/curriculum/curriculum.controller.ts` (add 2 endpoints)
- Test: `backend/src/modules/curriculum/curriculum.service.spec.ts` (add unit for setItemRecording) — or new `curriculum-recording.spec.ts`

**Interfaces:**
- Consumes: `uploadRecording` from Task 2.
- Produces: `POST /curriculum/subjects/items/:id/recording` and `DELETE /curriculum/subjects/items/:id/recording`.

- [ ] **Step 1: Write the failing test (service method)**

Add to a spec file:
```ts
it('setItemRecording stores url and meta', async () => {
  prisma.subjectItem.update = jest.fn().mockResolvedValue({ id: 'i1', recordingUrl: 'u', recordingMeta: { a: 1 } });
  const res = await svc.setItemRecording('i1', 'u', { a: 1 });
  expect(prisma.subjectItem.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { recordingUrl: 'u', recordingMeta: { a: 1 } } });
  expect(res.recordingUrl).toBe('u');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest curriculum-recording`
Expected: FAIL (`setItemRecording` not defined).

- [ ] **Step 3: Add service methods**

In `curriculum.service.ts`, add after `updateSubjectItem`:
```ts
  async setItemRecording(id: string, recordingUrl: string, recordingMeta: any) {
    return this.prisma.subjectItem.update({ where: { id }, data: { recordingUrl, recordingMeta } });
  }

  async clearItemRecording(id: string) {
    return this.prisma.subjectItem.update({ where: { id }, data: { recordingUrl: null, recordingMeta: null } });
  }
```

- [ ] **Step 4: Add controller endpoints**

In `curriculum.controller.ts`, update imports (add `memoryStorage` from `multer` and `extname`, `uuidv4` if not present; the file already imports `diskStorage`, `FileInterceptor`, `uuidv4` from existing audio route). Add after the `uploadAudio` route:
```ts
  @Post('subjects/items/:id/recording')
  @ApiOperation({ summary: 'Upload a hymn recording for a subject item (Cloudflare R2)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      const allowed = ['.mp3', '.m4a', '.ogg', '.webm'];
      const ext = extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new BadRequestException(`Invalid audio format. Allowed: ${allowed.join(', ')}`), false);
    },
    limits: { fileSize: 15 * 1024 * 1024 },
  }))
  async uploadItemRecording(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = extname(file.originalname).toLowerCase();
    const key = `recordings/subject-items/${id}-${uuidv4()}${ext}`;
    const url = await uploadRecording(file.buffer, key, file.mimetype);
    return this.curriculumService.setItemRecording(id, url, {
      originalName: file.originalname,
      sizeBytes: file.size,
      contentType: file.mimetype,
    });
  }

  @Delete('subjects/items/:id/recording')
  @ApiOperation({ summary: 'Remove the hymn recording from a subject item' })
  async removeItemRecording(@Param('id') id: string) {
    return this.curriculumService.clearItemRecording(id);
  }
```
Add `import { uploadRecording } from '@/common/storage/r2';` (adjust alias to the project's `@/` or relative path) and `import { memoryStorage } from 'multer';`.

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest curriculum`
Expected: PASS (new test + existing curriculum tests).

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/modules/curriculum && git commit -m "feat(curriculum): upload/delete subject-item recording to R2"
```

---

### Task 4: Assessment reference recording fields

**Files:**
- Modify: `backend/src/modules/assessments/dto/assessment.dto.ts` (Create + Update DTOs)
- Modify: `backend/src/modules/assessments/assessments.service.ts` (map fields)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts` (extend an existing create/update test)

**Interfaces:**
- Produces: `Assessment.referenceRecordingUrl` / `referenceRecordingName` persisted and returned by assessment endpoints (consumed by portals in Task 5).

- [ ] **Step 1: Add DTO fields**

In `CreateAssessmentDto` (and `UpdateAssessmentDto`), after the `subjectId` field add:
```ts
  @IsOptional()
  @IsString()
  referenceRecordingUrl?: string;

  @IsOptional()
  @IsString()
  referenceRecordingName?: string;
```

- [ ] **Step 2: Map in service**

In `assessments.service.ts`, in the `create`/`update` `data` building block (near the other `if (dto.x !== undefined) data.x = ...` lines ~131-147), add:
```ts
    if (dto.referenceRecordingUrl !== undefined) data.referenceRecordingUrl = dto.referenceRecordingUrl || null;
    if (dto.referenceRecordingName !== undefined) data.referenceRecordingName = dto.referenceRecordingName || null;
```

- [ ] **Step 3: Write/extend test**

Add to an existing assessments service spec:
```ts
it('persists referenceRecordingUrl on create', async () => {
  prisma.assessment.create = jest.fn().mockResolvedValue({ id: 'a1' });
  await svc.create('school-1', { ...baseDto, referenceRecordingUrl: 'https://x/rec.mp3', referenceRecordingName: 'Rec' });
  expect(prisma.assessment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ referenceRecordingUrl: 'https://x/rec.mp3', referenceRecordingName: 'Rec' }) }));
});
```
(Use the spec's existing `baseDto`/factory; if none, create a minimal one.)

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest assessments`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/modules/assessments && git commit -m "feat(assessments): add referenceRecordingUrl/Name fields"
```

---

### Task 5: Portal data — enrich hymn map + assessment reference

**Files:**
- Modify: `backend/src/modules/curriculum/hymn-learning.service.ts` (`getStudentHymnMap`)
- Modify: `backend/src/modules/parents/parents.service.ts` (`getChildAssessments`)
- Test: `backend/src/modules/curriculum/hymn-learning.service.spec.ts` (assert `referenceRecordingUrl` on mapped item)

**Interfaces:**
- Produces: `HymnMapItem.referenceRecordingUrl` / `referenceRecordingName` (consumed by student portal in Task 8) and assessment `referenceRecordingUrl`/`referenceRecordingName` (consumed by parent portal in Task 9).

- [ ] **Step 1: Enrich `getStudentHymnMap`**

In `hymn-learning.service.ts`, add to the `lesson` `include` (inside the `include: { ... }` of `getStudentHymnMap`, alongside `resources`):
```ts
        subjectItem: {
          select: { id: true, name: true, recordingUrl: true, recordingMeta: true },
        },
```
And in the `.map(l => ({...}))` return, add:
```ts
      referenceRecordingUrl: (l as any).subjectItem?.recordingUrl ?? null,
      referenceRecordingName: (l as any).subjectItem?.recordingMeta?.originalName ?? null,
```

- [ ] **Step 2: Enrich `getChildAssessments`**

In `parents.service.ts` `getChildAssessments`, in the mapped submission object (where `subject`, `passed`, etc. are set), add:
```ts
        referenceRecordingUrl: s.assessment.referenceRecordingUrl ?? null,
        referenceRecordingName: s.assessment.referenceRecordingName ?? null,
```

- [ ] **Step 3: Write test for hymn map enrichment**

Add to `hymn-learning.service.spec.ts`:
```ts
it('includes subjectItem recording url on hymn map', async () => {
  prisma.lesson.findMany = jest.fn().mockResolvedValue([{
    id: 'l1', title: 'H', level: { id: 'lv', number: 1, name: 'L1' },
    subject: { id: 's1', name: 'Coptic Hymns', color: '#000' },
    lessonProgress: [], resources: [], audioUrl: null,
    subjectItem: { id: 'si1', name: 'Hymn', recordingUrl: 'https://r/rec.mp3', recordingMeta: { originalName: 'rec.mp3' } },
  }]);
  const res = await svc.getStudentHymnMap('stu1', 'sch1');
  expect(res[0].referenceRecordingUrl).toBe('https://r/rec.mp3');
  expect(res[0].referenceRecordingName).toBe('rec.mp3');
});
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest hymn-learning parents`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/modules/curriculum/hymn-learning.service.ts src/modules/parents/parents.service.ts && git commit -m "feat(portals): expose subject-item recording on hymn map and assessment reference"
```

---

### Task 6: Admin UI — SubjectItem recording control

**Files:**
- Modify: `frontend/src/app/dashboard/settings/_components/subjects-tab.tsx`
- Test: `frontend/src/app/dashboard/settings/_components/__tests__/subjects-tab-recording.test.tsx` (new)

**Interfaces:**
- Consumes: `POST /curriculum/subjects/items/:id/recording`, `DELETE /curriculum/subjects/items/:id/recording` (Task 3); `SubjectItem.recordingUrl`/`recordingMeta` already returned by `GET .../items` (Task 1).

- [ ] **Step 1: Extend the `SubjectItem` interface**

In `subjects-tab.tsx`, the local `interface SubjectItem` (around line 23) — add:
```ts
  recordingUrl?: string
  recordingMeta?: { originalName?: string; sizeBytes?: number; contentType?: string }
```

- [ ] **Step 2: Add upload/remove handlers + UI in the item form**

Near the presentation upload handler (around line 285), add:
```ts
  const onUploadRecording = async (file: File) => {
    if (!editingItem) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res: any = await http.upload(`/curriculum/subjects/items/${editingItem.id}/recording`, fd)
      setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, recordingUrl: res.recordingUrl, recordingMeta: res.recordingMeta } : it))
      setEditingItem({ ...editingItem, recordingUrl: res.recordingUrl, recordingMeta: res.recordingMeta })
      toast('success', lang === 'ar' ? 'تم رفع التسجيل' : 'Recording uploaded')
    } catch {
      toast('error', lang === 'ar' ? 'فشل رفع التسجيل' : 'Failed to upload recording')
    }
  }

  const onRemoveRecording = async () => {
    if (!editingItem) return
    try {
      await http.delete(`/curriculum/subjects/items/${editingItem.id}/recording`, { schoolId: getSchoolId() })
      setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, recordingUrl: undefined, recordingMeta: undefined } : it))
      setEditingItem({ ...editingItem, recordingUrl: undefined, recordingMeta: undefined })
      toast('success', lang === 'ar' ? 'تم الحذف' : 'Removed')
    } catch {
      toast('error', lang === 'ar' ? 'فشل الحذف' : 'Failed to remove')
    }
  }
```

In the item edit form JSX (near the presentation URL input, ~line 759), render:
```tsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'تسجيل المرجع' : 'Reference recording'}</label>
  {editingItem?.recordingUrl ? (
    <div className="flex items-center gap-3">
      <audio controls src={editingItem.recordingUrl} className="h-9 flex-1" />
      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600">{lang === 'ar' ? 'استبدال' : 'Replace'}</button>
      <button type="button" onClick={onRemoveRecording} className="text-xs text-red-600">{lang === 'ar' ? 'حذف' : 'Remove'}</button>
    </div>
  ) : (
    <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUploadRecording(f); e.target.value = '' }} />
  )}
  {!editingItem?.recordingUrl && (
    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600">{lang === 'ar' ? 'رفع تسجيل' : 'Upload recording'}</button>
  )}
</div>
```
Add `const fileInputRef = useRef<HTMLInputElement>(null)` near the other refs (around line 91).

- [ ] **Step 3: Write the test**

Create `frontend/src/app/dashboard/settings/_components/__tests__/subjects-tab-recording.test.tsx` mocking `http` (upload/delete/get) and asserting: an Upload button renders when no `recordingUrl`; clicking it with a file calls `http.upload` with the recording endpoint; after a mocked success it shows an `<audio>` element.

- [ ] **Step 4: Run test**

Run: `cd frontend && npx vitest run src/app/dashboard/settings/_components/__tests__/subjects-tab-recording.test.tsx`
Expected: PASS. Also `cd frontend && npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/app/dashboard/settings/_components/subjects-tab.tsx src/app/dashboard/settings/_components/__tests__/subjects-tab-recording.test.tsx && git commit -m "feat(admin): subject-item recording upload/replace/remove control"
```

---

### Task 7: Admin UI — Assessment reference picker

**Files:**
- Modify: `frontend/src/app/dashboard/assessments/page.tsx`
- Test: `frontend/src/app/dashboard/assessments/__tests__/assessment-reference.test.tsx` (new)

**Interfaces:**
- Consumes: `GET /curriculum/subjects/:id/items` (returns items with `recordingUrl`), assessment create/update payload fields `referenceRecordingUrl`/`referenceRecordingName` (Tasks 1,4).

- [ ] **Step 1: Extend form state**

In `emptyForm` (around line 108) add `referenceRecordingUrl: '', referenceRecordingName: ''`.
In `setForm({...})` when loading an assessment for edit (around line 279) add `referenceRecordingUrl: a.referenceRecordingUrl || '', referenceRecordingName: a.referenceRecordingName || ''`.

- [ ] **Step 2: Fetch subject items when subject changes + add picker UI**

Add state `const [recordingOptions, setRecordingOptions] = useState<{url:string;name:string}[]>([])`.
When the subjectId form field changes (in the existing `updateForm` handler or a dedicated effect), fetch:
```ts
const items: any[] = await http.get('/curriculum/subjects/' + subjectId + '/items', { schoolId: getSchoolId() })
setRecordingOptions(items.filter(i => i.recordingUrl).map(i => ({ url: i.recordingUrl, name: i.name + (i.recordingMeta?.originalName ? ` (${i.recordingMeta.originalName})` : '') })))
```
In the assessment form JSX, add:
```tsx
<FormField label={lang === 'ar' ? 'تسجيل المرجع' : 'Reference recording'}>
  <select value={form.referenceRecordingUrl} onChange={e => {
    const opt = recordingOptions.find(o => o.url === e.target.value)
    updateForm({ referenceRecordingUrl: e.target.value, referenceRecordingName: opt?.name || '' })
  }}>
    <option value="">{lang === 'ar' ? 'بدون' : 'None'}</option>
    {recordingOptions.map(o => <option key={o.url} value={o.url}>{o.name}</option>)}
  </select>
  {form.referenceRecordingUrl && <audio controls src={form.referenceRecordingUrl} className="h-9 w-full mt-2" />}
</FormField>
```
Ensure the save payload includes `referenceRecordingUrl`/`referenceRecordingName` (the existing `http.post('/assessments', payload)` should spread `form`; if it builds a whitelist, add these two keys).

- [ ] **Step 3: Write the test**

Create `frontend/src/app/dashboard/assessments/__tests__/assessment-reference.test.tsx` mocking `http.get` to return subject items with a `recordingUrl` and `http.post` to assert the create payload contains `referenceRecordingUrl`.

- [ ] **Step 4: Run test**

Run: `cd frontend && npx vitest run src/app/dashboard/assessments/__tests__/assessment-reference.test.tsx`
Expected: PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/app/dashboard/assessments/page.tsx src/app/dashboard/assessments/__tests__/assessment-reference.test.tsx && git commit -m "feat(admin): assessment reference-recording picker"
```

---

### Task 8: Student portal — render reference recording

**Files:**
- Modify: `frontend/src/components/hymn-learning/hooks.ts` (`HymnMapItem` interface)
- Modify: `frontend/src/app/student-portal/[code]/page.tsx` (render audio when `referenceRecordingUrl`)

**Interfaces:**
- Consumes: `HymnMapItem.referenceRecordingUrl`/`referenceRecordingName` from Task 5.

- [ ] **Step 1: Extend `HymnMapItem`**

In `hooks.ts` `interface HymnMapItem` (line 18) add:
```ts
  referenceRecordingUrl?: string | null
  referenceRecordingName?: string | null
```

- [ ] **Step 2: Render the player in the student portal**

In `student-portal/[code]/page.tsx`, where the selected hymn/practice panel renders (near the existing `getAudioUrl`/practice area, ~line 89-97), add a "Reference recording" block:
```tsx
{practiceLesson?.referenceRecordingUrl && (
  <div className="mt-3 rounded-lg border border-gray-200 p-3">
    <div className="text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'تسجيل المرجع' : 'Reference recording'}{practiceLesson.referenceRecordingName ? ` — ${practiceLesson.referenceRecordingName}` : ''}</div>
    <audio controls src={practiceLesson.referenceRecordingUrl} className="w-full" />
  </div>
)}
```
(Use the same variable that holds the selected hymn — `practiceLesson` in this file — and keep styling consistent with existing panels.)

- [ ] **Step 3: Typecheck + smoke test**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean. (A full portal render test is optional; if a portal test file exists, extend it to assert the audio element appears when `referenceRecordingUrl` is present — otherwise skip new test to avoid over-scoping.)

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/hymn-learning/hooks.ts "src/app/student-portal/[code]/page.tsx" && git commit -m "feat(student-portal): show subject-item reference recording"
```

---

### Task 9: Parent portal — render assessment (and hymn) reference

**Files:**
- Modify: `frontend/src/app/dashboard/parents/page.tsx` (render `referenceRecordingUrl` on child's assessment view)

**Interfaces:**
- Consumes: `getChildAssessments` now returns `referenceRecordingUrl`/`referenceRecordingName` (Task 5).

- [ ] **Step 1: Render assessment reference**

In the parent portal assessment card/list (where each child assessment result is shown), add:
```tsx
{assessment.referenceRecordingUrl && (
  <div className="mt-2">
    <div className="text-xs text-gray-500">{lang === 'ar' ? 'تسجيل المرجع' : 'Reference recording'}</div>
    <audio controls src={assessment.referenceRecordingUrl} className="w-full" />
  </div>
)}
```
Mirror the styling used elsewhere in the parent portal. If the parent portal also renders the child's hymn list (reusing the student hymn map), apply the same `referenceRecordingUrl` audio block there.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/app/dashboard/parents/page.tsx && git commit -m "feat(parent-portal): show assessment reference recording"
```

---

### Task 10: Final verification + push

- [ ] **Step 1: Backend checks**

Run: `cd backend && npx tsc --noEmit && npx jest curriculum assessments hymn-learning parents`
Expected: tsc clean; the targeted suites pass (ignore the 17 pre-existing unrelated failures).

- [ ] **Step 2: Frontend checks**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 106+ tests pass (existing + new).

- [ ] **Step 3: Rebase + push**

```bash
git pull --rebase --autostash
git push
```
Expected: pushed to `origin/main`.

---

## Self-review notes (already applied)

- SubjectItem upload uses dedicated `setItemRecording`/`clearItemRecording` (not `updateSubjectItem`) to avoid the `schoolResolver` requirement on the item-id-only endpoint.
- Portal join is `Lesson.subjectItem.recordingUrl` (confirmed `Lesson.subjectItemId` exists), not a SubjectItem list — matches the actual "hymn = Lesson" data model.
- `createSubjectItem` lists fields explicitly, so recording is set via `setItemRecording` after creation (no create-time field needed).
- Dev fallback keeps local-disk behavior when R2 env is unset, so nothing breaks before credentials are added.
