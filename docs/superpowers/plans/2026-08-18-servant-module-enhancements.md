# Servant Module Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add gender, CSV import/export, read-only church/school linkage, and a same-group contact widget to the servant module.

**Architecture:** Two workstreams. **A** (backend + form/list): a new required `User.gender` column (nullable in migration, backfilled, DTO-enforced), `GET /servants` enriched with church/school, a new `GET /servants/group-mates` endpoint, and gender+church/school in the servant form and list. **B** (frontend): CSV export of selected servants, CSV template import looping `POST /users`, and a group-mates widget on the servant dashboard reusing the existing `PhoneLink`.

**Tech Stack:** NestJS + Prisma (backend), Next.js/React + Tailwind (frontend), Vitest + React Testing Library (frontend tests), Jest (backend tests). CSV hand-rolled (matches students module — no new lib).

## Global Constraints

- Gender values are `'female' | 'male'` (lowercase), consistent with `Student.gender`.
- Church/School linkage is **read-only** — derived from `user.schoolId → school → church`. No multi-school assignment.
- Import uses approach C1: loop the existing `POST /users` endpoint. No new bulk-create endpoint.
- Group-mates determined by matching `metadata.groupId` (same value as the caller's own `metadata.groupId`), excluding self.
- Export mirrors the students CSV pattern (`frontend/src/app/dashboard/students/students-client.tsx:186`): UTF-8 BOM, quote fields, double internal quotes, prefix `'` on cells starting with `= + - @`.
- The `User.gender` DB column is added **nullable** and **backfilled** (`'male'`) so existing rows are never broken; DTO enforces it as effectively required.
- Backend verify: `npx jest src/modules/servants/servants.service.spec.ts` and `npx jest src/modules/users` from `backend/` (only these specs — there are known unrelated failures elsewhere).
- Frontend verify: `npx tsc --noEmit` and `npx vitest run` from `frontend/`.
- Work on the `main` branch, commit each task, push to `origin/main` (`git pull --rebase --autostash` before push). Render runs `prisma migrate deploy` on start.

---

### Task 1: Backend — `User.gender` column, DTO, and persistence

**Files:**
- Modify: `backend/prisma/schema.prisma` (`User` model, add `gender String @map("gender")`)
- Create: `backend/prisma/migrations/<timestamp>_add_user_gender/migration.sql`
- Modify: `backend/src/modules/users/dto/users.dto.ts`
- Modify: `backend/src/modules/users/users.service.ts:245-253` (create), `:120-135` (update)

**Interfaces:**
- Consumes: none.
- Produces: `User.gender: string` (`'female' | 'male'`); `CreateUserDto.gender` (required, `@IsIn(['female','male'])`); `UpdateUserDto.gender` (optional, `@IsIn(['female','male'])`); `UsersService.createUser`/`updateUser` accept and persist `data.gender`.

- [ ] **Step 1: Add `gender` to the `User` model**

In `backend/prisma/schema.prisma`, inside the `User` model (after `lastNameAr`), add:

```prisma
gender        String    @map("gender")
```

- [ ] **Step 2: Create the migration SQL**

Create directory `backend/prisma/migrations/20260818120000_add_user_gender/` and file `migration.sql`:

```sql
-- Add gender column (nullable first, then backfill — required at the API layer)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" TEXT;
UPDATE "users" SET "gender" = 'male' WHERE "gender" IS NULL;
```

- [ ] **Step 3: Add gender to the DTOs**

In `backend/src/modules/users/dto/users.dto.ts`, add `import { IsIn } from 'class-validator';` at the top. In `CreateUserDto`, add after `lastName`:

```ts
@ApiProperty({ example: 'female', enum: ['female', 'male'] })
@IsIn(['female', 'male'])
gender: string;
```

In `UpdateUserDto`, add after `lastName`:

```ts
@ApiPropertyOptional({ example: 'female', enum: ['female', 'male'] })
@IsOptional()
@IsIn(['female', 'male'])
gender?: string;
```

- [ ] **Step 4: Persist gender in create + update**

In `backend/src/modules/users/users.service.ts`, `createUser` data block (line ~246):

```ts
data: {
  email: data.email, passwordHash,
  firstName: data.firstName, lastName: data.lastName,
  gender: data.gender,
  firstNameAr: data.firstNameAr, lastNameAr: data.lastNameAr,
  phone: data.phone, schoolId, locale: 'en', timezone: 'UTC',
  ...(data.metadata !== undefined && { metadata: data.metadata }),
},
```

In `updateUser` data block (line ~120), add after the `lastName` line:

```ts
...(data.gender !== undefined && { gender: data.gender }),
```

- [ ] **Step 5: Add a backend spec for gender validation**

Create `backend/src/modules/users/dto/users.dto.spec.ts`:

```ts
import { validate } from 'class-validator';
import { CreateUserDto, UpdateUserDto } from './users.dto';

describe('CreateUserDto', () => {
  it('accepts female/male gender', async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, { email: 'a@b.com', firstName: 'A', lastName: 'B', password: 'Password123!', gender: 'female' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects an invalid gender value', async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, { email: 'a@b.com', firstName: 'A', lastName: 'B', password: 'Password123!', gender: 'unknown' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('requires gender on create', async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, { email: 'a@b.com', firstName: 'A', lastName: 'B', password: 'Password123!' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });
});

describe('UpdateUserDto', () => {
  it('allows gender to be omitted', async () => {
    const dto = new UpdateUserDto();
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
```

- [ ] **Step 6: Run the DTO spec**

Run from `backend/`: `npx jest src/modules/users/dto/users.dto.spec.ts`
Expected: PASS (3 + 1 assertions).

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260818120000_add_user_gender/migration.sql backend/src/modules/users/dto/users.dto.ts backend/src/modules/users/users.service.ts backend/src/modules/users/dto/users.dto.spec.ts
git commit -m "feat(users): add gender column, DTO validation, and persistence"
```

---

### Task 2: Backend — `GET /servants` gender + church/school enrichment, and `GET /servants/group-mates`

**Files:**
- Modify: `backend/src/modules/servants/servants.service.ts`
- Modify: `backend/src/modules/servants/servants.controller.ts`
- Test: `backend/src/modules/servants/servants.service.spec.ts`

**Interfaces:**
- Consumes: `User.gender` (Task 1).
- Produces:
  - `listServants` rows gain `gender: string | undefined` and `school: { id, name, nameAr, logoUrl, church: { id, name, nameAr, logoUrl } }`.
  - `getGroupMates(user: { id: string }): Promise<GroupMate[]>` where `GroupMate = { id, firstName, lastName, firstNameAr, lastNameAr, avatarUrl, phone }`.
  - Controller route `GET /servants/group-mates`.

- [ ] **Step 1: Add group-mate type and helper to the service**

At the top of `backend/src/modules/servants/servants.service.ts`, after the existing interfaces, add:

```ts
export interface GroupMate {
  id: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  avatarUrl: string | null;
  phone: string | null;
}
```

- [ ] **Step 2: Enrich `listServants` with gender + school/church**

In `listServants`, the `select` currently has `userRoles`, `metadata`. Change the `findMany` `select` to add:

```ts
gender: true,
school: {
  select: {
    id: true, name: true, nameAr: true, logoUrl: true,
    church: { select: { id: true, name: true, nameAr: true, logoUrl: true } },
  },
},
```

Then in the `.map()` projection, add `gender: (u as any).gender` and `school: (u as any).school`.

- [ ] **Step 3: Add `getGroupMates` to the service**

Add this method (place near `listServants`):

```ts
async getGroupMates(userId: string) {
  const me = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { metadata: true },
  });
  const meta = (me?.metadata as any) || {};
  const groupId = meta.groupId as string | undefined;
  if (!groupId) return [];

  const mates = await this.prisma.user.findMany({
    where: {
      id: { not: userId },
      deletedAt: null,
      userRoles: { some: { role: { name: { in: [...SERVANT_ROLE_NAMES] } } } },
    },
    orderBy: { firstName: 'asc' },
  });

  return mates
    .filter((u: any) => ((u.metadata as any) || {}).groupId === groupId)
    .map((u: any) => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName,
      firstNameAr: u.firstNameAr, lastNameAr: u.lastNameAr,
      avatarUrl: u.avatarUrl, phone: u.phone,
    }));
}
```

- [ ] **Step 4: Add the controller route**

In `backend/src/modules/servants/servants.controller.ts`, add (guarded like the other servant routes):

```ts
@Get('group-mates')
@Roles('servant', 'group_leader', 'level_leader')
@ApiOperation({ summary: 'Get other servants in the same group as the caller' })
async getGroupMates(@CurrentUser() user: any) {
  return this.servantsService.getGroupMates(user.id);
}
```

Import `CurrentUser` if not already imported (it is, per the existing `:id/profile` route).

- [ ] **Step 5: Add backend specs**

In `backend/src/modules/servants/servants.service.spec.ts`, add tests:

```ts
describe('getGroupMates', () => {
  const prisma = /* existing mocked PrismaService instance */;

  it('returns [] when the caller has no metadata.groupId', async () => {
    prisma.user.findUnique.mockResolvedValue({ metadata: {} });
    const result = await service.getGroupMates('me');
    expect(result).toEqual([]);
  });

  it('returns only servants sharing the same groupId, excluding self', async () => {
    prisma.user.findUnique.mockResolvedValue({ metadata: { groupId: 'g1' } });
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', firstName: 'A', lastName: 'B', firstNameAr: null, lastNameAr: null, avatarUrl: null, phone: '+1', metadata: { groupId: 'g1' } },
      { id: 'b', firstName: 'C', lastName: 'D', firstNameAr: null, lastNameAr: null, avatarUrl: null, phone: null, metadata: { groupId: 'g2' } },
    ]);
    const result = await service.getGroupMates('me');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });
});
```

Match the existing spec's mocking pattern (how `prisma` and `service` are constructed) rather than assuming the above shape verbatim.

- [ ] **Step 6: Run the servants spec**

Run from `backend/`: `npx jest src/modules/servants/servants.service.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/servants/servants.service.ts backend/src/modules/servants/servants.controller.ts backend/src/modules/servants/servants.service.spec.ts
git commit -m "feat(servants): include gender and church/school; add group-mates endpoint"
```

---

### Task 3: Frontend — servant form gender field + read-only church/school + save

**Files:**
- Modify: `frontend/src/app/dashboard/servants/page.tsx`

**Interfaces:**
- Consumes: `User.gender` from `GET /servants`; `school` (with `church`) from `GET /servants`.
- Produces: form `gender` state; `gender` sent in `POST /users` / `PATCH /users` body.

- [ ] **Step 1: Extend the form state and reset helpers**

Add `gender: ''` to the `form` state object (line ~112) and to both `openCreate` (line ~291) and `openEdit` (line ~302). In `openEdit`, read it from the servant:

```ts
gender: (s as any).gender || '',
```

- [ ] **Step 2: Add a Gender field to the form modal**

In the modal body (near the date-of-birth `DatePicker` at ~line 856), add a required segmented control. Use existing UI primitives already imported (`FormField`). Example:

```tsx
<FormField label={lang === 'ar' ? 'الجنس *' : 'Gender *'}>
  <div className="flex gap-2">
    {(['female', 'male'] as const).map((g) => (
      <button
        key={g}
        type="button"
        onClick={() => updateField('gender', g)}
        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
          form.gender === g ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
        }`}
      >
        {lang === 'ar' ? (g === 'female' ? 'أنثى' : 'ذكر') : g === 'female' ? 'Female' : 'Male'}
      </button>
    ))}
  </div>
</FormField>
```

- [ ] **Step 3: Validate gender on save**

In `handleSave` (line ~330), after the name check, add:

```ts
if (!form.gender) {
  setFormError(lang === 'ar' ? 'الجنس مطلوب' : 'Gender is required');
  return;
}
```

- [ ] **Step 4: Send gender in the body**

In `handleSave`, add `gender: form.gender,` to the `body` object (line ~352).

- [ ] **Step 5: Add read-only Church & School display in the form**

In the modal, add a read-only block (after the photo/identity area, before save). It uses the already-loaded `schoolIdentity` (fetched at line ~171):

```tsx
<div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
  <p className="mb-2 font-semibold text-gray-900">{lang === 'ar' ? 'الكنيسة والمدرسة' : 'Church & School'}</p>
  <div className="flex flex-col gap-1 text-gray-600">
    {schoolIdentity?.churchName && <p>🏛️ {schoolIdentity.churchName}</p>}
    {schoolIdentity?.name && <p>🏫 {schoolIdentity.name}</p>}
  </div>
  <p className="mt-1 text-xs text-gray-400">{lang === 'ar' ? 'يتم تعيين الخادم تلقائيًا لكنيسته ومدرسته' : 'Servant is automatically linked to their church and school'}</p>
</div>
```

- [ ] **Step 6: Extend the servants test for gender**

In `frontend/src/app/dashboard/servants/__tests__/page.test.tsx`, add a test after the existing "sends grade + group in create metadata" test:

```tsx
it('requires gender and sends it in create body', async () => {
  render(<ServantsPage />)
  await userEvent.click(screen.getByText('Add Servant'))
  fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Malak' } })
  fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Ahmed' } })
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'malak@x.com' } })
  await userEvent.click(within(screen.getByRole('dialog')).getByText('Add Servant'))
  expect(screen.getByText('Gender is required')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Female' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByText('Add Servant'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/users', expect.objectContaining({ gender: 'female' })))
})
```

Note: verify the actual submit-button label in the modal before finalizing (`getByText('Add Servant')` matches the existing test's usage).

- [ ] **Step 7: Run frontend tests + typecheck**

Run from `frontend/`: `npx tsc --noEmit` and `npx vitest run src/app/dashboard/servants/__tests__/page.test.tsx`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/dashboard/servants/page.tsx frontend/src/app/dashboard/servants/__tests__/page.test.tsx
git commit -m "feat(servants): add gender field and church/school display to servant form"
```

---

### Task 4: Frontend — servant list gender column + filter, church/school column

**Files:**
- Modify: `frontend/src/app/dashboard/servants/page.tsx`

**Interfaces:**
- Consumes: `gender` and `school` fields on each `GET /servants` row (Task 2).
- Produces: gender + church/school columns; gender filter in the list toolbar.

- [ ] **Step 1: Extend the `ServantUser` interface**

Add to the `ServantUser` interface (near line ~38):

```ts
gender?: string;
school?: {
  id: string; name: string; nameAr?: string; logoUrl?: string | null;
  church?: { id: string; name: string; nameAr?: string; logoUrl?: string | null };
};
```

- [ ] **Step 2: Add a gender filter dropdown**

Add `const [filterGender, setFilterGender] = useState('')` near the other filter state (line ~100). Add a filter select in the toolbar (alongside the existing filters):

```tsx
<select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} aria-label={lang === 'ar' ? 'تصفية حسب الجنس' : 'Filter by gender'} className="...">
  <option value="">{lang === 'ar' ? 'كل الجنس' : 'All genders'}</option>
  <option value="female">{lang === 'ar' ? 'أنثى' : 'Female'}</option>
  <option value="male">{lang === 'ar' ? 'ذكر' : 'Male'}</option>
</select>
```

- [ ] **Step 3: Apply the gender filter in `filteredServants`**

In `filteredServants` (line ~218), add:

```ts
if (filterGender && s.gender !== filterGender) return false
```

- [ ] **Step 4: Add a Gender column to the table**

In the table header/rows (the section rendering servant rows), add a Gender cell (badge, bilingual):

```tsx
<td>
  {s.gender ? (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.gender === 'female' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}`}>
      {lang === 'ar' ? (s.gender === 'female' ? 'أنثى' : 'ذكر') : s.gender === 'female' ? 'Female' : 'Male'}
    </span>
  ) : '—'}
</td>
```

- [ ] **Step 5: Add a Church/School column to the table**

Add a Church/School cell (read-only), using `s.school`:

```tsx
<td className="text-sm text-gray-600">
  {s.school ? (
    <div className="flex flex-col">
      {s.school.church?.name && <span>{s.school.church.name}</span>}
      <span className="text-xs text-gray-400">{s.school.name}</span>
    </div>
  ) : '—'}
</td>
```

Add a matching header cell for both new columns. Adjust the existing column `colspan`/count if the table uses fixed widths.

- [ ] **Step 6: Extend the servants test for gender filter**

Add to `frontend/src/app/dashboard/servants/__tests__/page.test.tsx`:

```tsx
it('filters servants by gender', async () => {
  const withGender = servants.map((s, i) => ({ ...s, gender: i % 2 === 0 ? 'female' : 'male' }))
  mockGet.mockImplementation((path: string) => {
    if (path === '/servants') return Promise.resolve(withGender)
    return Promise.resolve([])
  })
  render(<ServantsPage />)
  await userEvent.click(screen.getByRole('button', { name: 'Table' }))
  const table = await screen.findByRole('table')
  const genderSelect = screen.getByLabelText('Filter by gender')
  await userEvent.selectOptions(genderSelect, 'female')
  expect(within(table).getByText('Female')).toBeInTheDocument()
  expect(within(table).queryByText('Male')).not.toBeInTheDocument()
})
```

- [ ] **Step 7: Run frontend tests + typecheck**

Run from `frontend/`: `npx tsc --noEmit` and `npx vitest run src/app/dashboard/servants/__tests__/page.test.tsx`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/dashboard/servants/page.tsx frontend/src/app/dashboard/servants/__tests__/page.test.tsx
git commit -m "feat(servants): add gender and church/school columns and gender filter to servant list"
```

---

### Task 5: Frontend — export selected servants to CSV

**Files:**
- Modify: `frontend/src/app/dashboard/servants/page.tsx`
- Test: `frontend/src/app/dashboard/servants/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `selectedIds`, `servants`, `filteredServants` (existing).
- Produces: an "Export" button (visible when `selectedIds.length > 0`) that downloads a CSV of the selected servants.

- [ ] **Step 1: Add an export handler**

Add a `handleExport` function near `handleBulkDelete`:

```tsx
const handleExport = () => {
  const selected = servants.filter((s) => selectedIds.includes(s.id))
  if (selected.length === 0) return
  const escape = (v: any) => String(v ?? '')
  const rows = [
    ['Name', 'Name (Ar)', 'Email', 'Phone', 'Gender', 'Role', 'Level', 'Group', 'Teaching Subjects', 'Church', 'School', 'Date Joined', 'Date of Birth'],
    ...selected.map((s) => {
      const meta = s.metadata || {}
      const role = servantRole(s)?.name || ''
      const levelName = meta.levelId ? levels.find((l) => l.id === meta.levelId)?.name || '' : ''
      const groupName = meta.groupId ? activeGroups.find((g) => g.id === meta.groupId)?.name || '' : ''
      return [
        `${s.firstName} ${s.lastName}`.trim(),
        `${s.firstNameAr || ''} ${s.lastNameAr || ''}`.trim(),
        s.email, s.phone || '', s.gender || '',
        role,
        levelName, groupName,
        (meta.teachingSubjects || []).join('; '),
        s.school?.church?.name || '', s.school?.name || '',
        meta.dateJoined || '', meta.dateOfBirth || '',
      ]
    }),
  ]
  const csv = rows.map((r) => r.map((c) => {
    let val = escape(c).replace(/"/g, '""')
    if (/^[=+\-@]/.test(val)) val = `'${val}`
    return `"${val}"`
  }).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `servants-selected-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Add an Export button**

In the bulk-action toolbar (where "Delete selected" shows), add:

```tsx
{selectedIds.length > 0 && (
  <Button variant="outline" size="sm" onClick={handleExport}>
    <Upload className="h-4 w-4 rotate-180" /> {lang === 'ar' ? 'تصدير' : 'Export'}
  </Button>
)}
```

(Gate with `can('servant:export')` if that permission exists; otherwise show whenever there is a selection.)

- [ ] **Step 3: Add an export test**

Add to the servants test file (mock `URL.createObjectURL` + `URL.revokeObjectURL` in the test):

```tsx
it('exports selected servants to CSV', async () => {
  const createURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<ServantsPage />)
  await userEvent.click(screen.getByRole('button', { name: 'Table' }))
  const table = await screen.findByRole('table')
  await userEvent.click(screen.getAllByRole('checkbox', { name: 'Select' })[0])
  await userEvent.click(screen.getByText('Export'))
  expect(createURL).toHaveBeenCalled()
  expect(clickSpy).toHaveBeenCalled()
})
```

- [ ] **Step 4: Run frontend tests + typecheck**

Run from `frontend/`: `npx tsc --noEmit` and `npx vitest run src/app/dashboard/servants/__tests__/page.test.tsx`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/servants/page.tsx frontend/src/app/dashboard/servants/__tests__/page.test.tsx
git commit -m "feat(servants): export selected servants to CSV"
```

---

### Task 6: Frontend — import servants from CSV template

**Files:**
- Modify: `frontend/src/app/dashboard/servants/page.tsx`
- Test: `frontend/src/app/dashboard/servants/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `POST /users` (existing), `levels`, `activeGroups`, `subjects`, `SERVANT_ROLES` (existing).
- Produces: an "Import" button + modal (downloadable CSV template, file picker, preview, confirm → loops `POST /users`).

- [ ] **Step 1: Add import modal state**

Add near `showForm` state:

```ts
const [showImport, setShowImport] = useState(false)
const [importRows, setImportRows] = useState<ImportRow[]>([])
const [importFileError, setImportFileError] = useState('')
const [importing, setImporting] = useState(false)
```

Define a type near the top:

```ts
interface ImportRow {
  firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string;
  email?: string; phone?: string; gender?: string; roleName?: string;
  levelId?: string; groupId?: string; teachingSubjects: string[];
  _valid: boolean; _error?: string;
}
```

- [ ] **Step 2: Add template download + CSV parse**

Add:

```tsx
const downloadTemplate = () => {
  const tpl = [['FirstName','LastName','FirstNameAr','LastNameAr','Email','Phone','Gender','Role','Level','Group','TeachingSubjects']].map((r) =>
    r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${tpl}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'servants-import-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

const parseCSV = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = [], cur = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = [] }
    else cur += c
  }
  if (cur !== '' || row.length > 0) { row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row) }
  return rows
}
```

- [ ] **Step 3: Add file handling + validation**

Add a handler that reads the file, parses it, maps names → IDs, and validates each row:

```tsx
const onImportFile = (file: File) => {
  setImportFileError('')
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result || '')
    const parsed = parseCSV(text)
    if (parsed.length === 0) { setImportFileError(lang === 'ar' ? 'ملف فارغ' : 'Empty file'); return }
    const header = parsed[0].map((h) => h.trim())
    const idx = (name: string) => header.indexOf(name)
    const rows = parsed.slice(1).map((r) => {
      const get = (n: string) => (idx(n) >= 0 ? (r[idx(n)] || '').trim() : '')
      const firstName = get('FirstName')
      const lastName = get('LastName')
      const email = get('Email')
      const gender = get('Gender').toLowerCase()
      const levelName = get('Level')
      const groupName = get('Group')
      const teaching = get('TeachingSubjects').split(';').map((s) => s.trim()).filter(Boolean)
      const roleName = get('Role') || 'servant'
      let _error = ''
      if (!firstName || !lastName) _error = lang === 'ar' ? 'الاسم مطلوب' : 'Name required'
      else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) _error = lang === 'ar' ? 'بريد غير صالح' : 'Invalid email'
      else if (gender && !['female', 'male'].includes(gender)) _error = lang === 'ar' ? 'جنس غير صالح' : 'Invalid gender'
      const levelId = levelName ? levels.find((l) => l.name === levelName)?.id || '' : ''
      const groupId = groupName ? activeGroups.find((g) => g.name === groupName)?.id || '' : ''
      if (levelName && !levelId) _error = _error || (lang === 'ar' ? `مستوى غير موجود: ${levelName}` : `Unknown level: ${levelName}`)
      if (groupName && !groupId) _error = _error || (lang === 'ar' ? `مجموعة غير موجودة: ${groupName}` : `Unknown group: ${groupName}`)
      return { firstName, lastName, firstNameAr: get('FirstNameAr'), lastNameAr: get('LastNameAr'), email, phone: get('Phone'), gender, roleName, levelId, groupId, teachingSubjects: teaching, _valid: !_error, _error }
    })
    setImportRows(rows)
  }
  reader.readAsText(file)
}
```

- [ ] **Step 4: Add the import modal + confirm**

Add a modal (reuse `Modal` component) that shows template download, file input, a valid/invalid preview table, and a confirm button. The confirm loops `POST /users`:

```tsx
const runImport = async () => {
  const valid = importRows.filter((r) => r._valid)
  if (valid.length === 0) return
  setImporting(true)
  let created = 0, failed = 0
  for (const r of valid) {
    try {
      await http.post('/users', {
        firstName: r.firstName, lastName: r.lastName,
        firstNameAr: r.firstNameAr || undefined, lastNameAr: r.lastNameAr || undefined,
        email: r.email || `${r.firstName.toLowerCase()}.${r.lastName.toLowerCase()}@servant.local`,
        phone: r.phone || undefined, gender: r.gender || 'male', roleName: r.roleName || 'servant',
        schoolId,
        metadata: {
          teachingSubjects: r.teachingSubjects,
          levelId: r.levelId || undefined,
          groupId: r.groupId || undefined,
        },
      })
      created++
    } catch { failed++ }
  }
  setImporting(false)
  setShowImport(false)
  setImportRows([])
  fetchServants()
  toast(created > 0 ? 'success' : 'error',
    lang === 'ar' ? `تم إنشاء ${created} خادم، فشل ${failed}` : `Created ${created} servants, ${failed} failed`)
}
```

- [ ] **Step 5: Add the Import button in the toolbar**

```tsx
<Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
  <Upload className="h-4 w-4" /> {lang === 'ar' ? 'استيراد' : 'Import'}
</Button>
```

(Gate with `can('servant:import')` if that permission exists.)

- [ ] **Step 6: Add an import test**

Add to the servants test file:

```tsx
it('opens import modal and shows template download', async () => {
  render(<ServantsPage />)
  await userEvent.click(screen.getByText('Import'))
  expect(screen.getByText('Download template')).toBeInTheDocument()
})
```

Adjust the text to match the actual modal's template-button label.

- [ ] **Step 7: Run frontend tests + typecheck**

Run from `frontend/`: `npx tsc --noEmit` and `npx vitest run src/app/dashboard/servants/__tests__/page.test.tsx`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/dashboard/servants/page.tsx frontend/src/app/dashboard/servants/__tests__/page.test.tsx
git commit -m "feat(servants): import servants from CSV template"
```

---

### Task 7: Frontend — group-mates widget on the servant dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx` (`MinistryDashboard`, ~line 1936)
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx` (import `PhoneLink`)

**Interfaces:**
- Consumes: `GET /servants/group-mates` returning `GroupMate[]` (Task 2).
- Produces: a "My Group · Servants" card listing group-mates with avatar, name, `PhoneLink`.

- [ ] **Step 1: Import `PhoneLink`**

Add near the top of `dashboard-client.tsx` (matching existing import style):

```tsx
import { PhoneLink } from '@/app/dashboard/students/_components/phone-link'
```

- [ ] **Step 2: Add group-mates fetch + state**

Inside `MinistryDashboard`, add state and a fetch effect:

```tsx
const [groupMates, setGroupMates] = useState<any[] | null>(null)

useEffect(() => {
  let cancelled = false
  http.get('/servants/group-mates')
    .then((d: any) => { if (!cancelled) setGroupMates(d || []) })
    .catch(() => { if (!cancelled) setGroupMates([]) })
  return () => { cancelled = true }
}, [])
```

Add `useState`/`useEffect`/`http` imports if the component file does not already have them (it does — they are used elsewhere in the file).

- [ ] **Step 3: Render the group-mates card**

In the `MinistryDashboard` return, after the ministry stats (e.g., after the `NextSessionCard` block near line ~2033), add:

```tsx
{groupMates !== null && (
  <motion.div variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-semibold text-white">{lang === 'ar' ? 'خدام مجموعتي' : 'My Group · Servants'}</h2>
      <span className="text-xs text-white/60">{groupMates.length}</span>
    </div>
    {groupMates.length === 0 ? (
      <p className="text-sm text-white/60">{lang === 'ar' ? 'لا يوجد خدام آخرون في مجموعتك' : 'No other servants in your group'}</p>
    ) : (
      <ul className="space-y-2">
        {groupMates.map((m: any) => (
          <li key={m.id} className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/30 text-sm font-bold text-white">
                {(m.firstName || '?')[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {lang === 'ar' && m.firstNameAr ? `${m.firstNameAr} ${m.lastNameAr || ''}` : `${m.firstName} ${m.lastName}`}
              </p>
            </div>
            {m.phone && <PhoneLink phone={m.phone} lang={lang} />}
          </li>
        ))}
      </ul>
    )}
  </motion.div>
)}
```

- [ ] **Step 4: Run typecheck + full frontend suite**

Run from `frontend/`: `npx tsc --noEmit` and `npx vitest run`
Expected: both pass. (If existing dashboard-client tests fail due to the new `GET /servants/group-mates` call, extend the mock in those tests to resolve `[]` for that path.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/dashboard-client.tsx
git commit -m "feat(servants): show same-group servants with call/whatsapp on servant dashboard"
```

---

### Task 8: Final verification and push

**Files:** none (verification only).

**Interfaces:** consumes all prior tasks.

- [ ] **Step 1: Backend specs**

Run from `backend/`: `npx jest src/modules/servants/servants.service.spec.ts` and `npx jest src/modules/users/dto/users.dto.spec.ts`
Expected: PASS.

- [ ] **Step 2: Frontend verification**

Run from `frontend/`: `npx tsc --noEmit` and `npx vitest run`
Expected: clean + green.

- [ ] **Step 3: Push**

```bash
git pull --rebase --autostash
git push origin main
```

Expected: all tasks pushed; Render deploys (runs `prisma migrate deploy` applying the gender migration).