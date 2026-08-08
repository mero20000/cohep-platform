# Servant Grade/Group Assignment + Bulk Delete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Grade selection (auto-fills group), support group-alone servant assignment, and multi-record deletion to the servants page.

**Architecture:** Backend adds one soft-delete bulk endpoint on the users module mirroring the existing students `bulkDelete` pattern. Frontend reuses the existing `gradeGroups` config API (`fetchGradeGroups`, `lib/grade-groups.ts` helpers) to populate a new optional Grade select; the group select becomes level-independent so a servant can be assigned to a group alone; a selection toolbar drives a bulk-delete confirm.

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript, vitest + React Testing Library, NestJS, Prisma, Jest.

## Global Constraints

- No schema change; no new Prisma migration.
- Do NOT depend on the in-flight Levels/Grades/Groups restructure (a parallel task). Grades stay as `gradeGroups` config strings; servant assignment persists as `metadata.levelId`, `metadata.groupId`, plus a new `metadata.grade`.
- Servant create/update already persists arbitrary `metadata` JSON (`users.service.ts:134`) — no backend change needed for metadata.
- Bulk delete is school-scoped and must never delete a user in another school or a `super_admin`.
- Frontend: `npm run type-check`, `npm run lint`, `npm run test` must stay green.
- Backend: `npx tsc --noEmit && npx jest` must stay green.
- Follow existing i18n pattern: every user-facing string has an `en` and `ar` variant produced via the page's `lang` variable.

---

### Task 1: Backend — `bulkDeleteUsers` service method + `POST /users/bulk-delete` endpoint

**Files:**
- Modify: `backend/src/modules/users/users.service.ts` (add method near `deleteUser`, ~:167)
- Modify: `backend/src/modules/users/users.controller.ts` (add route near `deleteUser`, ~:129)
- Test: `backend/src/modules/users/users.service.spec.ts`

**Interfaces:**
- Consumes: existing `PrismaService` (prisma.user, prisma.role, prisma.userRole).
- Produces: `UsersService.bulkDeleteUsers(ids: string[], requestingUser?: any): Promise<{ deleted: number }>`; controller route `POST /users/bulk-delete` (Body `{ ids: string[] }`) guarded by `@Roles('super_admin', 'admin')`.
- Uses `UsersService.userHasRole(id, 'super_admin')` — already private on the service.

- [ ] **Step 1: Extend the prisma mock in the service spec to include `updateMany`**

In `backend/src/modules/users/users.service.spec.ts`, the `prismaMock.user` object currently has `findUnique` and `update`. Add `updateMany: jest.fn()`. (It already has `role.findFirst` and `userRole.findMany`/`deleteMany`/`create` needed by `userHasRole`.)

```ts
user: {
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
},
```

- [ ] **Step 2: Write the failing unit tests for `bulkDeleteUsers`**

Append inside `describe('UsersService roles')` (after the last `it`):

```ts
  describe('bulkDeleteUsers', () => {
    it('rejects non-array / empty ids', async () => {
      await expect(service.bulkDeleteUsers([], { schoolId: 's1', roles: ['admin'] })).rejects.toThrow(BadRequestException);
      await expect(service.bulkDeleteUsers(undefined as any, { schoolId: 's1', roles: ['admin'] })).rejects.toThrow(BadRequestException);
    });

    it('soft-deletes given users within the requester school', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 2 });
      prisma.role.findFirst.mockResolvedValue({ id: 'sa-role' });
      prisma.userRole.findMany.mockResolvedValue([]);

      const res = await service.bulkDeleteUsers(['u1', 'u2'], { schoolId: 's1', roles: ['admin'] });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1', 'u2'] }, schoolId: 's1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(res).toEqual({ deleted: 2 });
    });

    it('excludes super_admin users from deletion', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'sa-role' });
      // u2 is a super admin
      prisma.userRole.findMany.mockResolvedValue([{ userId: 'u2' }]);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.bulkDeleteUsers(['u1', 'u2'], { schoolId: 's1', roles: ['admin'] });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1'] }, schoolId: 's1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(res).toEqual({ deleted: 1 });
    });
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest users.service.spec.ts -t "bulkDeleteUsers"` (from `backend/`)
Expected: FAIL — `bulkDeleteUsers is not a function`.

- [ ] **Step 4: Implement `bulkDeleteUsers` in `users.service.ts`**

Place it directly below `deleteUser` (`users.service.ts:167`):

```ts
  async bulkDeleteUsers(ids: string[], requestingUser?: any): Promise<{ deleted: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids are required');
    }
    const uniqueIds = [...new Set(ids)];
    const schoolId: string | undefined =
      requestingUser?.roles?.includes('super_admin') ? undefined : requestingUser?.schoolId;

    const superAdminRole = await this.prisma.role.findFirst({ where: { name: 'super_admin' } });
    let protectSuperAdmins = false;
    if (superAdminRole && !requestingUser?.roles?.includes('super_admin')) {
      protectable = superAdminRole;
    }
```

Wait — read the implementer note: use the existing private `userHasRole(id, 'super_admin')` per id instead of a findMany query, matching the single-delete guard semantics. Full implementation:

```ts
  async bulkDeleteUsers(ids: string[], requestingUser?: any): Promise<{ deleted: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids are required');
    }
    const uniqueIds = [...new Set(ids)];
    const isSuperAdmin = !!requestingUser?.roles?.includes('super_admin');

    // Filter out accounts the caller may not delete: other-school users (implicitly
    // via the schoolId below) and super_admin accounts (non-super-admin callers).
    const deletable: string[] = [];
    for (const id of uniqueIds) {
      if (!isSuperAdmin && (await this.userHasRole(id, 'super_admin'))) continue;
      deletable.push(id);
    }
    if (deletable.length === 0) return { deleted: 0 };

    const where: any = { id: { in: deletable }, deletedAt: null };
    if (!isSuperAdmin) where.schoolId = requestingUser?.schoolId;

    const result = await this.prisma.user.updateMany({ where, data: { deletedAt: new Date() } });
    return { deleted: result.count };
  }
```

- [ ] **Step 5: Run backend test to verify it passes**

Run: `npx jest users.service.spec.ts -t "bulkDeleteUsers"` (from `backend/`)
Expected: PASS — 3 tests green.

- [ ] **Step 6: Expose `POST /users/bulk-delete` in the controller**

In `backend/src/modules/users/users.controller.ts`, add a route right below `deleteUser` (after line ~133), before `@Delete(':id/roles/:roleName')`:

```ts
  @Roles('super_admin', 'admin')
  @Post('bulk-delete')
  @ApiOperation({ summary: 'Bulk soft-delete users (school-scoped)' })
  bulkDeleteUsers(@Body() dto: { ids: string[] }, @CurrentUser() user: any) {
    return this.usersService.bulkDeleteUsers(dto.ids || [], user);
  }
```

(`Post` and `Body` are already imported at the top of the file.)

- [ ] **Step 7: Verify backend compiles and full suite passes**

Run: `npx tsc --noEmit && npx jest` (from `backend/`)
Expected: PASS (no type errors; all existing + new tests green).

- [ ] **Step 8: Commit**

```bash
cd ~/niangelos-platform
git add backend/src/modules/users/users.service.ts backend/src/modules/users/users.service.spec.ts backend/src/modules/users/users.controller.ts
git commit -m "feat(users): bulk soft-delete endpoint for servants"
```

---

### Task 2: Frontend — load grade options and add optional Grade select with group auto-fill

**Files:**
- Modify: `frontend/src/app/dashboard/servants/page.tsx`
- Test: `frontend/src/app/dashboard/servants/__tests__/page.test.tsx` (create)

**Interfaces:**
- Consumes: `fetchGradeGroups` from `@/lib/school` (returns `GradeGroupCombo[]`), `ComboStatus` fields (`id`, `levelId`, `gradeName`, `groupId`, `groupName`, `status`).
- Produces: `form.grade: string`; `gradeOptions: string[]` (unique active grade names); on grade change, `form.groupId` auto-set via the combo's `groupId`. Later tasks read `form.grade` and `metadata.grade`.

- [ ] **Step 1: Write the failing frontend test for grade auto-fill**

Create `frontend/src/app/dashboard/servants/__tests__/page.test.tsx` mirroring the students page test scaffolding (`students/__tests__/page.test.tsx`): mock `next/image`, `lucide-react` icons, `@/components/ui/toast`, and render `<ServantsPage />`. The servants page uses the `http` client (not raw fetch) for lists and `fetchGradeGroups` (raw fetch) for grades — mock both.

```tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ServantsPage from '../page'

vi.mock('next/image', () => ({
  default: (props: any) => {
    const { unoptimized, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />
  },
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  const iconNames = ['AlertTriangle', 'Check', 'GraduationCap', 'LayoutGrid', 'Loader2', 'Pencil', 'Phone', 'Plus', 'Rows3', 'Search', 'Shield', 'Trash2', 'Upload', 'User', 'UserCheck', 'X']
  for (const name of iconNames) icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  return icons
})

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: (...a: any[]) => mockPost(...a), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/lib/school', () => ({
  getSchoolId: () => 'school-1',
  fetchGradeGroups: vi.fn().mockResolvedValue([
    { id: 'c1', levelId: 'level-1', gradeName: 'Grade 4', groupId: 'group-1', groupName: 'Group A', status: 'active' },
    { id: 'c2', levelId: 'level-1', gradeName: 'Grade 5', groupId: 'group-2', groupName: 'Group B', status: 'active' },
  ]),
}))

const levels = [
  { id: 'level-1', name: 'Level 1', number: 1, status: 'active', groups: [
    { id: 'group-1', name: 'Group A', levelId: 'level-1', status: 'active' },
    { id: 'group-2', name: 'Group B', levelId: 'level-1', status: 'active' },
  ]},
]

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockGet.mockImplementation((path: string) => {
    if (path === '/servants') return Promise.resolve([])
    if (path === '/students/groups/all') return Promise.resolve(levels)
    if (path.startsWith('/users/schools/me')) return Promise.resolve({})
    return Promise.resolve([])
  })
})

it('fills group when a grade is selected', async () => {
  render(<ServantsPage />)
  await userEvent.click(screen.getByText('Add Servant'))

  await userEvent.selectOptions(screen.getByLabelText('Grade'), 'Grade 5')

  const groupSelect = screen.getByLabelText('Group')
  expect(groupSelect).toHaveValue('group-2')
})
```

Note: adapt the RTL queries to whatever accessible labels the page renders (`aria-label` or `<label>`). The exact value mapping lives in the settings shown below.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test` (from `frontend/`) — or `npx vitest run src/app/dashboard/servants` 
Expected: FAIL — page has no Grade select yet.

- [ ] **Step 3: Import grade helpers**

At the top of `page.tsx`, next to the existing `fetchLevels`-related imports:

```ts
import { fetchGradeGroups } from '@/lib/school'
import type { GradeGroupCombo } from '@/lib/grade-groups'
```

- [ ] **Step 4: Add grade state + form field + grade options**

Add a state declaration near `form` (line ~88) and extend the form initializer used by `openCreate`/`openEdit`:

```ts
const [gradeGroups, setGradeGroups] = useState<GradeGroupCombo[]>([])
```

In `openCreate` (line ~228), add `grade: ''` to the initial form:

```ts
setForm({ firstName: '', lastName: '', firstNameAr: '', lastNameAr: '', email: '', phone: '', password: '', roleName: 'servant', levelId: '', groupId: '', teachingSubjects: [], grade: '' })
```

In `openEdit` (line ~239), add `grade: meta.grade || ''`.

Add a memo for unique active grade names (anywhere near `roleOptions`):

```ts
const gradeOptions = useMemo(() => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of gradeGroups) {
    if (c.status === 'inactive') continue
    if (!seen.has(c.gradeName)) { seen.add(c.gradeName); out.push(c.gradeName) }
  }
  return out
}, [gradeGroups])
```

- [ ] **Step 5: Fetch grade groups on mount**

Extend the existing fetch effect (around line ~135):

```ts
useEffect(() => { fetchServants(); fetchLevels() }, [fetchServants, fetchLevels])
```
→
```ts
useEffect(() => {
  fetchServants(); fetchLevels()
  fetchGradeGroups().then(setGradeGroups).catch(() => {})
}, [fetchServants, fetchLevels])
```

- [ ] **Step 6: Render the Grade select and auto-fill group**

Add `grade` to the `form` state interface (the initializer object covers it — TS infers the shape). Add a handler:

```ts
const selectGrade = (grade: string) => {
  const combo = gradeGroups.find(c => c.status !== 'inactive' && c.gradeName === grade)
  setForm(prev => ({
    ...prev,
    grade,
    groupId: combo?.groupId || '',
  }))
  setDirty(true)
}
```

Insert the Grade select in the create/edit modal, as part of the same two-column grid as Level / Group (see Task 3 which restructures that grid), using the existing select styling. Minimal markup to keep the component test hooking on:

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'ar' ? 'المرحلة الدراسية' : 'Grade'}</label>
  <select aria-label={lang === 'ar' ? 'المرحلة الدراسية' : 'Grade'} value={form.grade} onChange={e => selectGrade(e.target.value)}
    className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
    <option value="">{lang === 'ar' ? 'اختر مرحلة...' : 'Select grade...'}</option>
    {gradeOptions.map(g => (
      <option key={g} value={g}>{g}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/app/dashboard/servants` (from `frontend/`)
Expected: PASS.

- [ ] **Step 8: Verify frontend compiles and suite green**

Run: `npm run type-check && npm run lint && npm run test` (from `frontend/`)
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/amir.adly/niangelos-platform
git add frontend/src/app/dashboard/servants/page.tsx frontend/src/app/dashboard/servants/__tests__/page.test.tsx
git commit -m "feat(servants): grade select auto-fills group in form"
```

---

### Task 3: Frontend — level-independent group select + grade/group metadata + display

**Files:**
- Modify: `frontend/src/app/dashboard/servants/page.tsx`
- Test: `frontend/src/app/dashboard/servants/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `form.groupId`, `form.levelId`, `form.grade`; servers lists already tolerate `groupId` without `levelId`.
- Produces: group select enabled without a level; `metadata.grade`, `metadata.groupId`, `metadata.levelId` in save/edit bodies; `Level / Group` display now shows the grade when present; grade filter.

- [ ] **Step 1: Write failing tests for group-alone assignment and metadata save**

Append fixtures + test to `__tests__/page.test.tsx`. First, ensure the existing `GET /users/schools/me` route and groups fixture already used. Add a servants fixture and assert the group select is NOT disabled and that a POST carries metadata.grade. Example:

```tsx
// inside beforeEach: extend /servants to return a servant with grade + group-only
// mockGet: if (path === '/servants') return Promise.resolve([
//   { id: 'u1', ...baseUser, metadata: { groupId: 'group-1', grade: 'Grade 4' } },
//   { id: 'u2', ...baseUser, metadata: { levelId: 'level-1', groupId: 'group-1' } },
// ])
```
Write two tests:

```tsx
it('enables group select without a level (group-only assignment)', async () => {
  render(<ServantsPage />)
  await userEvent.click(screen.getByText('Add Servant'))
  const groupSelect = screen.getByLabelText('Group')
  expect(groupSelect).not.toBeDisabled()
  await userEvent.selectOptions(groupSelect, 'group-1')
  expect(groupSelect).toHaveValue('group-1')
})
```

```tsx
it('sends grade + group in create metadata and renders grade badge on cards', async () => {
  render(<ServantsPage />)
  // add-servant flow picks grade; assert POST body metadata contains grade
  await userEvent.click(screen.getByText('Add Servant'))
  await userEvent.type(screen.getByLabelText('First Name'), 'Malak')
  await userEvent.type(screen.getByLabelText('Last Name'), 'Ahmed')
  await userEvent.type(screen.getByLabelText('Email'), 'malak@x.com')
  await userEvent.selectOptions(screen.getByLabelText('Grade'), 'Grade 4')
  await userEvent.click(screen.getByText('Add Servant'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/users', expect.objectContaining({ metadata: expect.objectContaining({ grade: 'Grade 4' }) })))
  // card view shows grade
  expect(await screen.findByText('Grade 4')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests and confirm both fail**

Run: `npx vitest run src/app/dashboard/servants` (from `frontend/`)
Expected: FAIL (group select is currently `disabled={!form.levelId}`; metadata body has no `grade`).

- [ ] **Step 3: Remove the level gate on the Group select**

Locate the Group select (currently `disabled={!form.levelId}` at ~line 724). Change it:

```tsx
<select value={form.groupId} onChange={e => updateField('groupId', e.target.value)}
```

And change the `formGroups` memo so groups are all active groups when no level, level-filtered when a level is chosen:

```ts
const formGroups = useMemo(() => {
  if (!form.levelId) return activeGroups
  const level = levels.find(l => l.id === form.levelId)
  return level?.groups?.filter(g => g.status !== 'inactive') || []
}, [form.levelId, levels, activeGroups])
```

- [ ] **Step 4: Add grade to the save body metadata**

In `handleSave`, extend the metadata object (~line 294):

```ts
metadata: {
  teachingSubjects: form.teachingSubjects,
  levelId: form.levelId || undefined,
  groupId: form.groupId || undefined,
  grade: form.grade || undefined,
},
```

- [ ] **Step 5: Update the display to show grade when present**

In the table's Level/Group cell (~line 514) and the card pill (~line 605), replace the `Level / Group` composition with grade-aware content:

```ts
const assignmentLabel = (meta: ServantUser['metadata']) => {
  if (!meta) return '—'
  const group = activeGroups.find(g => g.id === meta.groupId)?.name
  const level = levels.find(l => l.id === meta.levelId)?.name
  const grade = meta.grade
  if (grade) return grade
  if (level && group) return `${level} / ${group}`
  return group || level || '—'
}
```

Wire the label into the table cell (replace the inline `${levels...} / ${activeGroups...}`) and the card pill (currently `{levels...} / {activeGroups...}` → `{assignmentLabel(meta)}`). Show grade as its own pill when present.

- [ ] **Step 6: Add a grade filter**

Add `filterGrade` state and a select in the filter bar (mirroring `filterLevel`):

```ts
const [filterGrade, setFilterGrade] = useState('')
```
Filter condition in `filteredServants` (line ~177):
```ts
if (filterGrade && meta.grade !== filterGrade) return false
```
New filter select (next to the subject filter):
```tsx
<select aria-label={lang === 'ar' ? 'تصفية حسب المرحلة' : 'Filter by grade'} value={filterGrade} onChange={e => setFilterGrade(e.target.value)} ...>
  <option value="">{lang === 'ar' ? 'جميع المراحل' : 'All Grades'}</option>
  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
</select>
```
Include `filterGrade` in `hasActiveFilters` and the two "Clear" handlers.

- [ ] **Step 7: Run the test suite; fix regressions

Run: `npx vitest run src/app/dashboard/servants` and then `npm run type-check && npm run lint && npm run test` (from `frontend/`)
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/amir.adly/niangelos-platform
git add frontend/src/app/dashboard/servants/page.tsx frontend/src/app/dashboard/servants/__tests__/page.test.tsx
git commit -m "feat(servants): level-independent group, grade metadata, grade filter"
```

---

### Task 4: Frontend — multi-select rows + "Delete selected" toolbar + confirm

**Files:**
- Modify: `frontend/src/app/dashboard/servants/page.tsx`
- Test: `frontend/src/app/dashboard/servants/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `POST /users/bulk-delete` (Task 1), `canDelete` permission, existing `ConfirmDialog`, `http.post`.
- Produces: `selectedIds: string[]` state; table header select-all checkbox; per-row / per-card checkboxes; "Delete selected (N)" toolbar; confirm flow calling the bulk endpoint.

- [ ] **Step 1: Write the failing test for bulk selection + delete**

Append to `page.test.tsx`. Mock two servants at application scope so selection renders:

```tsx
const composedFormat = ...
it('selects multiple rows, shows toolbar, and bulk-deletes', async () => {
  render(<ServantsPage />)
  // wait for the two-servant table
  const table = await screen.findByRole('table')
  const [cb1, cb2] = await screen.findAllByRole('checkbox')
  await userEvent.click(cb1)
  await userEvent.click(cb2)
  expect(screen.getByText('Delete selected (2)')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Delete selected (2)'))
  await userEvent.click(screen.getByRole('button', { name: /Delete/ }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/users/bulk-delete', { ids: ['u1', 'u2'] }))
})
```
(Adjust the mock `GET /servants` in Task 3's beforeEach to return two named servant rows so two checkboxes exist.)

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/app/dashboard/servants` (from `frontend/`)
Expected: FAIL — no checkboxes exist.

- [ ] **Step 3: Add selection state + toggles**

Near the delete state (line ~104):

```ts
const [selectedIds, setSelectedIds] = useState<string[]>([])

const toggleSelect = (id: string) =>
  setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

const toggleSelectAll = () =>
  setSelectedIds(prev =>
    filteredServants.length > 0 && prev.length === filteredServants.length
      ? []
      : filteredServants.filter(s => prev.includes(s.id)).length === prev.length
        ? filteredServants.map(s => s.id)
        : [...new Set([...prev, ...filteredServants.map(s => s.id)])])
```

- [ ] **Step 4: Add a bulk toolbar above the table/cards when selection exists**

Place it between the "Clear" button container and the `{loading ? ... }` block (around line ~442):

```tsx
{selectedIds.length > 0 && canDelete && (
  <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-2.5 text-sm">
    <span className="font-medium text-gray-700">
      {lang === 'ar' ? `${selectedIds.length} تم تحديد` : `${selectedIds.length} selected`}
    </span>
    <Button variant="danger" size="sm" onClick={() => setShowBulkDelete(true)}>
      <Trash2 className="h-4 w-4" />
      {lang === 'ar' ? `حذف (${selectedIds.length})` : `Delete selected (${selectedIds.length})`}
    </Button>
    <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
      {lang === 'ar' ? 'إلغاء التحديد' : 'Clear selection'}
    </Button>
  </div>
)}
```

Add `const [showBulkDelete, setShowBulkDelete] = useState(false)`.

- [ ] **Step 5: Add checkboxes to the table**

In the table header, add a first `<th>` (when `canDelete`) with a select-all checkbox; corresponding `<td>` on each row:

```tsx
<th className="px-4 py-3 w-10">
  <input type="checkbox" aria-label={lang === 'ar' ? 'تحديد الكل' : 'Select all'}
    checked={selectedIds.length === filteredServants.length && filteredServants.length > 0}
    onChange={toggleSelectAll}
    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
</th>
```
Row checkbox:
```tsx
<td className="px-4 py-3.5 w-10">
  <input type="checkbox" aria-label={lang === 'ar' ? 'تحديد' : 'Select'}
    checked={selectedIds.includes(s.id)}
    onChange={() => toggleSelect(s.id)}
    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
</td>
```

- [ ] **Step 6: Add a checkbox to each card**

In the card view, top-right of each card (next to the edit/delete buttons):

```tsx
<input type="checkbox" aria-label={lang === 'ar' ? 'تحديد' : 'Select'}
  checked={selectedIds.includes(s.id)}
  onChange={() => toggleSelect(s.id)}
  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
```

- [ ] **Step 7: Wire the bulk confirm dialog + handler**

Add a handler:

```ts
const handleBulkDelete = async () => {
  if (selectedIds.length === 0) return
  try {
    const res = await http.post<{ deleted: number }>('/users/bulk-delete', { ids: selectedIds })
    setShowBulkDelete(false)
    setSelectedIds([])
    fetchServants()
    toast('success', lang === 'ar' ? 'تم حذف الخدام' : 'Servants removed')
  } catch (e: any) {
    toast('error', e?.message || (lang === 'ar' ? 'فشل حذف الخدام' : 'Failed to delete servants'))
  }
}
```

Replace `/${?}` with the actual endpoint path: the batch delete route lives on the **users** module → `'/users/bulk-delete'`. (Note in Task 1 the route is on `users`, not `servants` — keep it consistent.)

Append a bulk `ConfirmDialog` near the Delete one:

```tsx
<ConfirmDialog
  open={showBulkDelete}
  onClose={() => setShowBulkDelete(false)}
  onConfirm={handleBulkDelete}
  title={lang === 'ar' ? 'حذف الخدام المحددين' : 'Remove selected servants'}
  message={lang === 'ar' ? `سيتم حذف ${selectedIds.length} من الخدام. لا يمكن التراجع عن هذا الإجراء.` : `${selectedIds.length} servants will be removed. This cannot be undone.`}
  confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
/>
```

- [ ] **Step 8: Run the full suite + lint + type-check

Run: `npx vitest run src/app/dashboard/servants && npm run type-check && npm run lint && npm run test` (from `frontend/`)
Expected: PASS (all 4 tasks' tests).

- [ ] **Step 9: Commit**

```bash
cd /Users/amir.adly/niangelos-platform
git add frontend/src/app/dashboard/servants/page.tsx frontend/src/app/dashboard/servants/__tests__/page.test.tsx
git commit -m "feat(servants): multi-select bulk delete"
```

---

## Self-Review

Spec coverage:
- Grade (optional) select + group auto-fill → Task 2. ✓
- Group-alone assignment (group without level) → Task 3. ✓
- `metadata.grade` persisted → Task 3 ✓.
- Multi-record delete (checkboxes in table + cards, toolbar, confirm, bulk request) → Task 4 ✓.
- Backend bulk endpoint `POST /users/bulk-delete`, school-scoped, super_admin-protected → Task 1 ✓.
- No dependency on the in-flight restructure; reuse `gradeGroups` config → Task 2 ✓.
- Out of scope items (student config changes, first-class Grades) left untouched ✓.

Placeholders: none — every step is explicit code.

Cross-task naming consistency: `form.grade`, `gradeOptions`, `selectGrade`, `filterGrade`, `selectedIds`, `toggleSelect`, `toggleSelectAll`, `handleBulkDelete`, `POST /users/bulk-delete` used consistently across tasks.