# Servants Card View & Contact Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give super admins/admins a table⇄card toggle with contact actions (Call/WhatsApp) on the servants page, and give principals/level leaders a strict view-only + contact experience.

**Architecture:** Servants are `User` records holding servant roles. Add a dedicated `GET /servants` endpoint (servant-role users only, school-scoped, role-gated) in the existing `servants` module so leaders never see non-servant accounts. On the frontend, switch the servants page data source to `/servants`, add a persisted table/cards toggle, a card grid, `PhoneLink` contact actions, and view-only gating via `usePermission`.

**Tech Stack:** NestJS (10), Prisma 5, Jest + ts-jest, React/Next.js 15, Tailwind.

## Global Constraints

- Backend `GET /servants` is gated to roles `super_admin`, `admin`, `principal`, `level_leader` via `@Roles(...)` + existing `JwtAuthGuard, RolesGuard`.
- School scoping: `super_admin` sees all schools; all other roles are scoped to `requestingUser.schoolId`.
- Return ONLY users with roles in `['servant', 'group_leader', 'level_leader']`; exclude `deletedAt !== null`.
- `GET /users` role gate is NOT modified (leaders never see non-servant accounts).
- Frontend uses `usePermission()` from `@/lib/use-permission`; hide Add/Edit/Delete when `!can('servant:create'|'servant:edit'|'servant:delete')`.
- Contact links reuse `PhoneLink` from `@/app/dashboard/students/_components/phone-link` — `tel:${digits}` and `https://wa.me/${digits.replace(/^\+/,'')}`.
- View preference persisted in `localStorage` under key `servants_view` = `'table' | 'cards'`, default `'cards'`.
- All new UI strings get both `en` and `ar` labels via the existing `lang` switch.
- Tests run via `npx jest`; spec files under `backend/src/**` named `*.spec.ts`.

---

### Task 1: Backend `GET /servants` endpoint

**Files:**
- Modify: `backend/src/modules/servants/servants.service.ts`
- Modify: `backend/src/modules/servants/servants.controller.ts`
- Test: `backend/src/modules/servants/servants.service.spec.ts` (new)

**Interfaces:**
- Consumes: `PrismaService` (already injected), `requestingUser` from the JWT payload (has `id`, `schoolId`, `roles: string[]`).
- Produces: `listServants(user: { id: string; schoolId?: string; roles: string[] }, query: { search?: string; role?: string; levelId?: string; groupId?: string; teachingSubject?: string }): Promise<ServantListItem[]>` where `ServantListItem` is:
```ts
interface ServantListItem {
  id: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string;
  email: string; phone?: string; avatarUrl?: string; isActive: boolean; lastLoginAt?: Date;
  userRoles: { role: { id: string; name: string; displayName: string } }[];
  metadata?: { teachingSubjects?: string[]; levelId?: string; groupId?: string };
}
```

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/servants/servants.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ServantsService } from './servants.service';
import { PrismaService } from '../../database/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

describe('ServantsService.listServants', () => {
  let service: ServantsService;
  let prisma: any;

  const S = (over = {}) => ({
    id: 'u1', firstName: 'John', lastName: 'Doe', firstNameAr: 'جون', lastNameAr: 'دو',
    email: 'j@x.com', phone: '+20123456789', avatarUrl: null, isActive: true,
    lastLoginAt: null, schoolId: 'school-1', deletedAt: null,
    userRoles: [{ role: { id: 'r1', name: 'servant', displayName: 'Servant' } }],
    metadata: null,
    ...over,
  });

  const prismaMock = { user: { findMany: jest.fn() } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServantsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GamificationService, useValue: { addXp: jest.fn(), awardBadge: jest.fn() } },
      ],
    }).compile();
    service = module.get<ServantsService>(ServantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  const staff = { id: 'staff-1', schoolId: 'school-1', roles: ['admin'] };
  const superAdmin = { id: 'sa-1', schoolId: 'school-1', roles: ['super_admin'] };

  it('returns only servant-role users, excluding deleted', async () => {
    prisma.user.findMany.mockResolvedValue([
      S(),
      S({ id: 'u2', userRoles: [{ role: { id: 'r2', name: 'group_leader', displayName: 'Group Leader' } }] }),
      S({ id: 'u3', userRoles: [{ role: { id: 'r3', name: 'servant', displayName: 'Servant' } }], deletedAt: new Date() }),
    ]);

    const result = await service.listServants(staff, {});

    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(['u1', 'u2']);
    expect(result[0].userRoles[0].role.name).toBe('servant');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: 'school-1' }) }),
    );
  });

  it('super_admin is not school-scoped', async () => {
    prisma.user.findMany.mockResolvedValue([S()]);
    await service.listServants(superAdmin, {});
    const arg = prisma.user.findMany.mock.calls[0][0];
    expect(arg.where.schoolId).toBeUndefined();
  });

  it('filters by search across name and email', async () => {
    prisma.user.findMany.mockResolvedValue([S()]);
    await service.listServants(staff, { search: 'joh' });
    const arg = prisma.user.findMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual(expect.arrayContaining([
      { email: { contains: 'joh', mode: 'insensitive' } },
    ]));
  });

  it('filters by role, levelId, groupId, teachingSubject', async () => {
    prisma.user.findMany.mockResolvedValue([S()]);
    const rows = [
      S({ id: 'a', userRoles: [{ role: { name: 'servant' } }] }),
      S({ id: 'b', userRoles: [{ role: { name: 'group_leader' } }], metadata: { levelId: 'L1', groupId: 'G1', teachingSubjects: ['coptic_hymns'] } }),
      S({ id: 'c', userRoles: [{ role: { name: 'level_leader' } }] }),
    ];
    prisma.user.findMany.mockResolvedValue(rows);

    const out = await service.listServants(staff, { role: 'group_leader', levelId: 'L1', groupId: 'G1', teachingSubject: 'coptic_hymns' });

    expect(out.map(r => r.id)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/servants/servants.service.spec.ts`
Expected: FAIL — `listServants` does not exist on `ServantsService`.

- [ ] **Step 3: Implement `listServants` in `servants.service.ts`**

Add to `servants.service.ts` (keep all existing liturgy methods untouched):

```ts
const SERVANT_ROLE_NAMES = ['servant', 'group_leader', 'level_leader'] as const;

async listServants(
  user: { id: string; schoolId?: string; roles: string[] },
  query: { search?: string; role?: string; levelId?: string; groupId?: string; teachingSubject?: string } = {},
) {
  const isSuperAdmin = user.roles?.includes('super_admin');
  const where: any = {
    deletedAt: null,
    userRoles: {
      some: { role: { name: { in: [...SERVANT_ROLE_NAMES] } } },
    },
  };
  if (!isSuperAdmin && user.schoolId) where.schoolId = user.schoolId;

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.role) {
    where.userRoles = {
      some: { role: { name: query.role } },
    };
  }

  const users = await this.prisma.user.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true,
      email: true, phone: true, avatarUrl: true, isActive: true, lastLoginAt: true,
      userRoles: { select: { role: { select: { id: true, name: true, displayName: true } } } },
      metadata: true,
    },
    orderBy: { firstName: 'asc' },
  });

  return users
    .map((u: any) => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName, firstNameAr: u.firstNameAr,
      lastNameAr: u.lastNameAr, email: u.email, phone: u.phone, avatarUrl: u.avatarUrl,
      isActive: u.isActive, lastLoginAt: u.lastLoginAt,
      userRoles: u.userRoles,
      metadata: (u.metadata as any) || undefined,
    }))
    .filter((u: any) => {
      if (query.levelId && (u.metadata?.levelId ?? '') !== query.levelId) return false;
      if (query.groupId && (u.metadata?.groupId ?? '') !== query.groupId) return false;
      if (query.teachingSubject && !(u.metadata?.teachingSubjects ?? []).includes(query.teachingSubject)) return false;
      return true;
    });
}
```

**Note for the implementer:** This deliberately filters `levelId`/`groupId`/`teachingSubject` in JS after the query (Prisma `Json` fields can't be portably filtered with `contains` across versions). The dataset is school-sized, so this is fine.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/servants/servants.service.spec.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Add the controller route**

In `backend/src/modules/servants/servants.controller.ts`, add after the constructor:

```ts
@Get()
@Roles('super_admin', 'admin', 'principal', 'level_leader')
@ApiOperation({ summary: 'List servant-role users (school-scoped)' })
listServants(
  @Req() req: any,
  @Query('search') search?: string,
  @Query('role') role?: string,
  @Query('levelId') levelId?: string,
  @Query('groupId') groupId?: string,
  @Query('teachingSubject') teachingSubject?: string,
) {
  return this.servantsService.listServants(req.user, { search, role, levelId, groupId, teachingSubject });
}
```

Update the import on line 1 to include `Query`, and confirm `Roles` is already imported (it is — `Roles, STAFF_ROLES`).

- [ ] **Step 6: Compile + run spec + full suite**

Run:
```
npx tsc --noEmit
npx jest --testPathIgnorePatterns="html-parser.spec.ts"
```
Expected: tsc clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/servants/servants.service.ts backend/src/modules/servants/servants.controller.ts backend/src/modules/servants/servants.service.spec.ts
git commit -m "feat(servants): add school-scoped GET /servants endpoint"
```

---

### Task 2: Frontend — switch data source + view toggle + card grid

**Files:**
- Modify: `frontend/src/app/dashboard/servants/page.tsx`

**Interfaces:**
- Consumes: `GET /servants` from Task 1 (response shape matches the existing `ServantUser` interface); `PhoneLink` from `@/app/dashboard/students/_components/phone-link`; `usePermission` from `@/lib/use-permission`.
- Produces: nothing consumed by later tasks (terminal frontend task).

- [ ] **Step 1: Add imports + view state + permission hook**

In `frontend/src/app/dashboard/servants/page.tsx`:

```tsx
import { LayoutGrid, Rows3 } from 'lucide-react'
import { PhoneLink } from '@/app/dashboard/students/_components/phone-link'
import { usePermission } from '@/lib/use-permission'
```

Inside the component (after `const lang = useLanguage()`):

```tsx
const { can } = usePermission()
const [view, setView] = useState<'table' | 'cards'>(() => {
  try { return (localStorage.getItem('servants_view') as 'table' | 'cards') || 'cards' } catch { return 'cards' }
})

const toggleView = (v: 'table' | 'cards') => {
  setView(v)
  try { localStorage.setItem('servants_view', v) } catch {}
}

const canEdit = can('servant:edit')
const canDelete = can('servant:delete')
const canCreate = can('servant:create')
```

- [ ] **Step 2: Switch `fetchServants` to `/servants`**

Replace the body of `fetchServants` (currently `http.get<ServantUser[]>('/users', { schoolId })` + `SERVANT_ROLES` filter at ~line 98) with:

```tsx
const data = await http.get<ServantUser[]>('/servants')
```

Keep the existing `servantRole(s)` derivation and the rest of the fetch logic identical. Drop the `schoolId` param from this call only — **do NOT remove the `const schoolId = getSchoolId()` line** (it is still used by `fetchLevels` at ~line 115 and the create body at ~line 284). Remove the now-unused `SERVANT_ROLES` filter block inside `fetchServants` — but `SERVANT_ROLES` is still used by `fetchRoles` (~line 126) and the create flow (~line 175), so keep the import.

- [ ] **Step 3: Add the view toggle control**

Render a segmented control in the toolbar area (next to the search/filter bar, before the table). Place it right after the "Add Servant" button block:

```tsx
<div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
  <button type="button" onClick={() => toggleView('cards')}
    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === 'cards' ? 'bg-gold-500 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
    <LayoutGrid className="h-3.5 w-3.5" />
    {lang === 'ar' ? 'بطاقات' : 'Cards'}
  </button>
  <button type="button" onClick={() => toggleView('table')}
    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === 'table' ? 'bg-gold-500 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
    <Rows3 className="h-3.5 w-3.5" />
    {lang === 'ar' ? 'جدول' : 'Table'}
  </button>
</div>
```

- [ ] **Step 4: Add the card grid render block**

In the main render, wrap the existing table block (`{... `table-to-cards` ...}`) in `{view === 'table' && ( ... )}` and add a cards block:

```tsx
{view === 'cards' && (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {filteredServants.map(s => {
      const role = servantRole(s)
      const meta = s.metadata || {}
      const badgeStyle = ROLE_BADGE[role?.name || 'servant'] || ROLE_BADGE.servant
      return (
        <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 overflow-hidden flex-shrink-0">
                {s.avatarUrl ? (
                  <Image src={`${API_ORIGIN}${s.avatarUrl}`} alt="" width={44} height={44} className="h-11 w-11 object-cover" />
                ) : (
                  <span className="text-sm font-bold text-blue-700">{s.firstName[0]}{s.lastName[0]}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span>{s.firstName} {s.lastName}</span>
                  <span title={s.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')} className={`inline-block h-2 w-2 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
                <div className="text-xs text-gray-500 truncate">{s.email}</div>
              </div>
            </div>
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-1">
                {canEdit && (
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={lang === 'ar' ? `تعديل ${s.firstName}` : `Edit ${s.firstName}`} title={lang === 'ar' ? 'تعديل' : 'Edit'}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" size="icon" onClick={() => { setDeleting(s); setShowDelete(true) }} aria-label={lang === 'ar' ? `حذف ${s.firstName}` : `Delete ${s.firstName}`} title={lang === 'ar' ? 'حذف' : 'Delete'}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${badgeStyle.bg} ${badgeStyle.text} border-transparent`}>
              {role?.displayName || (lang === 'ar' ? 'خادم' : 'Servant')}
            </span>
            {(meta.levelId || meta.groupId) && (
              <span className="ms-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {levels.find(l => l.id === meta.levelId)?.name || '—'} / {activeGroups.find(g => g.id === meta.groupId)?.name || '—'}
              </span>
            )}
          </div>

          {(meta.teachingSubjects || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {meta.teachingSubjects!.slice(0, 2).map(sub => (
                <span key={sub} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                  {lang === 'ar' ? (TEACHING_SUBJECTS.find(t => t.value === sub)?.arabicLabel) || sub : (TEACHING_SUBJECTS.find(t => t.value === sub)?.label || sub)}
                </span>
              ))}
              {(meta.teachingSubjects!.length > 2) && (
                <span className="text-xs text-gray-400">+{meta.teachingSubjects!.length - 2}</span>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
            {s.phone ? (
              <PhoneLink phone={s.phone} lang={lang} />
            ) : (
              <span className="text-sm text-gray-400">{lang === 'ar' ? 'لا يوجد رقم' : 'No phone'}</span>
            )}
          </div>
        </div>
      )
    })}
  </div>
)}
```

**Note to implementer:** `openEdit`, `setDeleting`, `setShowDelete`, `levels`, `activeGroups`, `TEACHING_SUBJECTS`, `ROLE_BADGE`, `servantRole`, `API_ORIGIN`, `Image`, `Button`, `Pencil`, `Trash2` all already exist in this file — reuse them exactly as they are.

- [ ] **Step 5: Wrap the existing table in `view === 'table'`**

In the render, change `{!loading && !error && filteredServants.length === 0 ? ( ... ) : ( <div className="overflow-x-auto table-to-cards">...` so the table container is conditional:

```tsx
) : view === 'table' ? (
  <div className="overflow-x-auto table-to-cards">
    ... existing table ...
  </div>
) : (
  // cards block from Step 4
)}
```

If the existing conditional structure is `{cond ? <EmptyState/> : <table>}`, restructure it to `{cond ? <EmptyState/> : view === 'table' ? <table> : <cards>}`.

- [ ] **Step 6: Upgrade table Contact cell to PhoneLink**

In the table's Contact cell (currently `servants/page.tsx` ~line 502), replace:

```tsx
<div className="flex items-center gap-1">
  <Phone className="h-3 w-3 text-gray-400" />
  {s.phone}
</div>
```

with:

```tsx
{s.phone ? <PhoneLink phone={s.phone} lang={lang} /> : <span className="text-sm text-gray-400">&mdash;</span>}
```

- [ ] **Step 7: Hide actions column in view-only mode**

Wrap the Actions `<th>` (line ~453) and the Actions `<td>` (line ~512) so they render only when `canEdit || canDelete`:

```tsx
{(canEdit || canDelete) && (
  <th className="px-6 py-3 text-end text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
)}
```

and:

```tsx
{(canEdit || canDelete) && (
  <td data-label="Actions" className="px-6 py-3.5 text-end">
    <div className="flex items-center justify-end gap-1">
      {canEdit && (<Button variant="ghost" size="icon" onClick={() => openEdit(s)} ...><Pencil className="h-4 w-4" /></Button>)}
      {canDelete && (<Button variant="ghost" size="icon" onClick={() => { setDeleting(s); setShowDelete(true) }} ...><Trash2 className="h-4 w-4" /></Button>)}
    </div>
  </td>
)}
```

- [ ] **Step 8: Hide the "Add Servant" button for non-creators**

Find the button(s) that open `openCreate` (EmptyState action at line ~437 and any toolbar button) and guard each with `canCreate && ( ... )`.

- [ ] **Step 9: Compile check**

Run: `npx tsc --noEmit` (from `frontend/`)
Expected: no new errors.

- [ ] **Step 10: Manual smoke test**

- Toggle to Cards → grid renders; reload page → stays on Cards (localStorage).
- PhoneLink on a card + table cell opens Call/WhatsApp with `+`-stripped wa.me URL.
- As principal/level_leader: no Add/Edit/Delete, actions column hidden, contact still visible.
- Arabic labels render correctly.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/app/dashboard/servants/page.tsx
git commit -m "feat(servants): card view toggle, PhoneLink contact, role-based gating"
```

---

## Self-Review Notes (run after writing)

- **Spec coverage:** GET /servants endpoint + role gate + scoping + role filter + JS filters (T1). Card grid, toggle persisted default cards (T2 S1/S3/S4). Table Contact → PhoneLink (T2 S6). View-only gating hides actions/add/edit/delete (T2 S7/S8). Arabic labels (throughout T2). Backend tests (T1 S1). Frontend tsc (T2 S9). All spec requirements mapped.
- **Placeholder scan:** All code blocks are complete. The only notes are `**Note to implementer:**` lines that reference existing symbols in the file (not placeholders). No TBD/TODO.
- **Type consistency:** `ServantListItem` defined in T1 matches the frontend `ServantUser` interface (id, firstName, lastName, firstNameAr, lastNameAr, email, phone, avatarUrl, isActive, lastLoginAt, userRoles[].role, metadata). `listServants(user, query)` signature is consumed only in T1 controller. `PhoneLink` props `{ phone, lang }` match the existing component.
- **Back-compat:** `GET /servants` is additive; `/users` untouched. The frontend `http.get('/servants')` call needs no `schoolId` param (endpoint self-scopes).