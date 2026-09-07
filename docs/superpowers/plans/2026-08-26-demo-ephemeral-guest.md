# Demo Ephemeral Guest Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable a 30-min, read-only guest demo (5/hr per IP) via `POST /api/demo/session` that mints a stateless `demo_viewer` JWT and works on both web and mobile with a Demo Mode banner.

**Architecture:** Stateless JWT (no User row) signed with `JWT_SECRET`, `JwtStrategy` returns a synthetic demo user for `demo:true` payloads, `RolesGuard` blocks writes because `demo_viewer` is absent from every `@Roles(...)`, reads reuse existing queries scoped to `niangelos-demo` school.

**Tech Stack:** NestJS 10, `@nestjs/jwt`, `@nestjs/throttler`, `Prisma 5`, Next.js 15 frontend, Expo SDK 57 mobile, Vitest + Supertest.

## Global Constraints

- `ENABLE_DEMO_LOGIN` stays `false` — old `demo@niangelos.app` path remains dead.
- No `user` row for guests; token is `role: demo_viewer`, `demo: true`, `expiresIn: 30m`.
- Throttle: 5 requests / 3600000 ms per IP on `POST /demo/session` only.
- Surfaces: both `frontend/src/app/auth/login/page.tsx` and `mobile/src/app/login.tsx` call the same endpoint, show sticky banner + Exit Demo.
- Demo school slug `niangelos-demo` with 8-hymn / 10-badge slice; reads reuse existing PortalData/hymn-map code.
- Every mutating route (`POST/PUT/DELETE/PATCH`) must 403 for `demo_viewer`.

---

### Task 1: Backend — DemoModule with stateless JWT minting and throttle

**Files:**
- Create: `backend/src/modules/demo/demo.module.ts`
- Create: `backend/src/modules/demo/demo.service.ts`
- Create: `backend/src/modules/demo/demo.controller.ts`
- Modify: `backend/src/app.module.ts:10-35` (import DemoModule)
- Test: `backend/src/modules/demo/demo.service.spec.ts`

**Interfaces:**
- Consumes: `JwtService.signAsync`, `PrismaService`, `ConfigService.get('JWT_SECRET')`.
- Produces: `DemoService.mintGuestToken(ip: string): Promise<{ accessToken: string }>`; controller `POST /api/demo/session` public, throttled.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/demo/demo.service.spec.ts
import { Test } from '@nestjs/testing';
import { DemoService } from './demo.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';

describe('DemoService', () => {
  it('mints a 30-min demo_viewer JWT without creating a user', async () => {
    const jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') } as any;
    const prisma = { school: { upsert: jest.fn().mockResolvedValue({ id: 'demo-school-id' }) } } as any;
    const mod = await Test.createTestingModule({
      providers: [DemoService, { provide: JwtService, useValue: jwt }, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const svc = mod.get(DemoService);
    const res = await svc.mintGuestToken('1.2.3.4');
    expect(res.accessToken).toBe('jwt-token');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'demo-guest', role: 'demo_viewer', demo: true }),
      expect.objectContaining({ expiresIn: '30m' }),
    );
    expect(prisma.school.upsert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demo.service.spec.ts -v`
Expected: FAIL with "Cannot find module './demo.service'"

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/modules/demo/demo.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DemoService {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async ensureDemoSchool(): Promise<string> {
    const school = await this.prisma.school.upsert({
      where: { slug: 'niangelos-demo' },
      update: {},
      create: {
        slug: 'niangelos-demo',
        name: 'COHEP Demo School',
        nameAr: 'مدرسة كوهيب التجريبية',
        churchId: (await this.prisma.church.findFirst({ select: { id: true } }))!.id,
        timezone: 'America/New_York',
        locale: 'en',
        isActive: true,
      },
    });
    return school.id;
  }

  async mintGuestToken(_ip: string): Promise<{ accessToken: string }> {
    const schoolId = await this.ensureDemoSchool();
    const payload = { sub: 'demo-guest', role: 'demo_viewer', schoolId, demo: true };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '30m' });
    return { accessToken };
  }
}
```

```ts
// backend/src/modules/demo/demo.controller.ts
import { Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('session')
  async create(@Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return this.demo.mintGuestToken(Array.isArray(ip) ? ip[0] : ip);
  }
}
```

```ts
// backend/src/modules/demo/demo.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
```

Modify `backend/src/app.module.ts`: add `import { DemoModule } from './modules/demo/demo.module';` and add `DemoModule` to `imports` array.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- demo.service.spec.ts -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/demo backend/src/app.module.ts
git commit -m "feat(demo): stateless 30-min guest JWT minting with 5/hr throttle"
```

---

### Task 2: Backend — JwtStrategy demo bypass (synthetic user, no DB)

**Files:**
- Modify: `backend/src/modules/auth/strategies/jwt.strategy.ts:17-35`
- Test: `backend/src/modules/auth/strategies/jwt.strategy.spec.ts` (add demo case)

**Interfaces:**
- Consumes: `DemoService` payload shape `{ sub, role, demo, schoolId }`.
- Produces: `JwtStrategy.validate` returns `{ id: 'demo-guest', roles: ['demo_viewer'], schoolId, isDemo: true }` without DB when `payload.demo === true`.

- [ ] **Step 1: Write the failing test**

```ts
// add to jwt.strategy.spec.ts
it('returns synthetic demo user without DB for demo_viewer token', async () => {
  const strategy = module.get(JwtStrategy);
  const user = await (strategy as any).validate({ sub: 'demo-guest', role: 'demo_viewer', demo: true, schoolId: 'demo-school-id' });
  expect(user.roles).toEqual(['demo_viewer']);
  expect(user.isDemo).toBe(true);
  expect(validateUserSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- jwt.strategy.spec.ts -v`
Expected: FAIL — returns real user or throws.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/modules/auth/strategies/jwt.strategy.ts
async validate(payload: any) {
  if (payload?.demo === true && payload?.role === 'demo_viewer') {
    return {
      id: 'demo-guest',
      email: 'guest@demo',
      schoolId: payload.schoolId,
      roles: ['demo_viewer'],
      isDemo: true,
      isActive: true,
    };
  }
  try {
    const user = await this.authService.validateUser(payload.sub);
    return user;
  } catch (error) {
    throw new UnauthorizedException('Invalid token');
  }
}
```

No change to `RolesGuard` needed — it already blocks `demo_viewer` because no mutating route includes that role (verified by grepping `@Roles`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- jwt.strategy.spec.ts -v`
Expected: PASS (new test green, existing tests still green)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/auth/strategies/jwt.strategy.ts backend/src/modules/auth/strategies/jwt.strategy.spec.ts
git commit -m "feat(auth): synthetic demo_viewer user in JWT validation (no DB row)"
```

---

### Task 3: Frontend web — Try Demo wired to guest session + banner

**Files:**
- Modify: `frontend/src/app/auth/login/page.tsx:116-145,489-510`
- Create: `frontend/src/components/demo/demo-banner.tsx`
- Test: `frontend/src/app/auth/login/__tests__/demo-login.test.tsx`

**Interfaces:**
- Consumes: `POST /api/demo/session` from Task 1.
- Produces: Demo button creates guest session, stores token via existing `auth` storage, shows banner with Exit.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/app/auth/login/__tests__/demo-login.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../page';
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'demo-jwt' }) }));
it('calls /demo/session and shows banner on success', async () => {
  render(<LoginPage />);
  fireEvent.click(screen.getByText(/Try Demo/));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/demo/session'), expect.anything()));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demo-login.test.tsx -v`
Expected: FAIL — still calls `/auth/demo`.

- [ ] **Step 3: Write minimal implementation**

Modify `handleDemo` in `page.tsx`:

```ts
const handleDemo = async () => {
  setIsDemoLoading(true);
  try {
    const res = await fetch(API + '/demo/session', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('Demo unavailable');
    const data = await res.json();
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('demo', '1');
    router.push('/dashboard');
  } catch (e) { setError('Demo unavailable — please try again'); }
  finally { setIsDemoLoading(false); }
};
```

Create `demo-banner.tsx`:

```tsx
export function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-white text-sm px-4 py-2 flex justify-between">
      <span>Demo Mode — data is not saved</span>
      <button onClick={onExit} className="underline">Exit Demo</button>
    </div>
  );
}
```

Wire banner in `dashboard/layout.tsx` when `localStorage.getItem('demo') === '1'`, Exit clears `token` + `demo` + `router.push('/auth/login')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- demo-login.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/auth/login/page.tsx frontend/src/components/demo
git commit -m "feat(frontend): wire Try Demo to ephemeral guest session with banner"
```

---

### Task 4: Mobile — Try Demo + banner

**Files:**
- Modify: `mobile/src/lib/api.ts` (add `demoLoginRequest`)
- Modify: `mobile/src/app/login.tsx` (add Try Demo link)
- Create: `mobile/src/components/demo-banner.tsx`

**Interfaces:**
- Consumes: `POST /demo/session` from Task 1; `saveSession` from session.ts.
- Produces: Mobile guest login stores demo JWT via SecureStore, shows same banner in `(tabs)` layout.

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/__tests__/api.test.ts add
it('demoLoginRequest posts to /demo/session', async () => {
  fetchMock.mockResolvedValueOnce(jsonRes(201, { accessToken: 'demo-jwt' }));
  await expect(demoLoginRequest()).resolves.toEqual({ accessToken: 'demo-jwt' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api.test.ts -v`
Expected: FAIL — cannot resolve `demoLoginRequest`.

- [ ] **Step 3: Write minimal implementation**

Add to `mobile/src/lib/api.ts`:

```ts
export async function demoLoginRequest(): Promise<{ accessToken: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/demo/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  } catch { throw new ApiError(0, 'No connection'); }
  if (!res.ok) throw new ApiError(res.status, 'Demo unavailable');
  return parseJson<{ accessToken: string }>(res);
}
```

Modify `mobile/src/lib/auth.tsx`: add `demoLogin(): Promise<boolean>` that calls `demoLoginRequest()`, saves `{ token, studentCode: 'demo-guest' }`, sets `isDemo` flag in SecureStore.

Modify `mobile/src/app/login.tsx`: add "Try Demo" pressable below Sign in that calls `demoLogin()` then `router.replace('/(tabs)')`.

Create `mobile/src/components/demo-banner.tsx` similar to web but with `View/Text/Pressable` and `onExit` clears session.

Wire banner in `mobile/src/app/(tabs)/_layout.tsx` when `session?.isDemo`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` in `mobile` — 16 tests pass (15 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat(mobile): Try Demo via ephemeral guest session with banner"
```

---

### Task 5: Demo fixture seeding + E2E verification

**Files:**
- Modify: `backend/prisma/seed.ts` (ensure `niangelos-demo` school + 8-hymn slice if empty)
- Create: `backend/test/demo.e2e-spec.ts`

**Interfaces:**
- Consumes: DemoModule, JwtStrategy demo path.

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/demo.e2e-spec.ts
it('guest can read but cannot write', async () => {
  const demoRes = await request(app.getHttpServer()).post('/api/demo/session').expect(201);
  const token = demoRes.body.accessToken;
  await request(app.getHttpServer()).get('/api/student-portal/demo-student').set('Authorization', `Bearer ${token}`).expect(200);
  await request(app.getHttpServer()).post('/api/attendance').set('Authorization', `Bearer ${token}`).send({}).expect(403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- demo.e2e-spec.ts`
Expected: FAIL — no demo school / 404.

- [ ] **Step 3: Write minimal implementation**

In `prisma/seed.ts`: after main school upsert, upsert `niangelos-demo` school if missing, and if `subjectItem` count for that school is 0, create the 8-hymn slice (reuse `copticHymnsByLevel` slice). Keep it idempotent (`if count === 0`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- demo.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/seed.ts backend/test/demo.e2e-spec.ts
git commit -m "feat(demo): seed demo school fixture and e2e read-only check"
```

---

### Task 6: Final gates + push

**Files:** none

- [ ] **Step 1: Run gates**

```bash
npm test && npx tsc --noEmit
```

In `backend` and `frontend` and `mobile`. Expected: all green.

- [ ] **Step 2: Manual smoke**

Web: click Try Demo → banner visible → Home shows Demo Student Level 2 → Exit → back to login. Mobile: same. 6th `POST /demo/session` in same hour → 429.

- [ ] **Step 3: Push**

```bash
git push origin main
```

