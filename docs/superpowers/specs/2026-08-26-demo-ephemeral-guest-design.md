# Demo Ephemeral Guest Session — Design

**Date:** 2026-08-26
**Status:** Approved design, pending implementation plan
**Feature:** Option B-A — stateless 30-min guest JWT, no DB user, web + mobile, banner

## Goal

Let any visitor try COHEP without credentials. A single `POST /api/demo/session` mints a 30-min, read-only JWT (`demo_viewer`, 5/hr per IP). It works on both the web landing "Try Demo" button and the new mobile login screen, shows a Demo Mode banner, and auto-expires. No persistent `demo@niangelos.app` user, `ENABLE_DEMO_LOGIN` stays `false`.

## Context

- Demo login currently disabled (`ENABLE_DEMO_LOGIN=false`, 403 on `POST /api/auth/demo`). Super admin is env-only, seeded servants use `Servant123!`.
- Existing guards: `JwtAuthGuard` validates any JWT; `RolesGuard` blocks writes via `@Roles(...)` (demo_viewer excluded). No new auth plumbing needed.
- Demo school `niangelos-demo` will hold the curated fixture (8 hymns, 10 badges) or be seeded on first guest request.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Token | Stateless JWT `role: demo_viewer`, `schoolId: niangelos-demo`, `demo: true`, 30 min, signed with `JWT_SECRET` | No storage, no cleanup, scales, expiry is cryptographic |
| Storage | No `user` row | No password to leak, no user to delete |
| Throttle | 5/hr per IP on `POST /demo/session` | Abuse protection; reads not throttled |
| Surfaces | Both web (`auth/login?demo=1`) and `mobile/src/app/login.tsx` | One endpoint serves both |
| UX | Sticky Demo Mode banner + Exit Demo clears token | Makes fakeness obvious, not saved |

## Architecture

```
POST /api/demo/session  (public, @Throttle 5/hr)
  -> DemoService.mintGuestToken(ip) -> JwtService.sign({ sub:'demo-guest', role:'demo_viewer', schoolId:'niangelos-demo', demo:true }, { expiresIn:'30m' })
  -> ensure demo school + fixture seeded if empty
  <- { accessToken }

GET /api/student-portal/:code/*  (existing)
  -> JwtAuthGuard validates guest JWT as normal
  -> RolesGuard denies any @Roles(...) without demo_viewer -> 403 demo_read_only on writes
  -> Reads reuse existing queries scoped to demo school
```

## Components

- `backend/src/modules/demo/demo.module.ts`, `demo.controller.ts`, `demo.service.ts` (reuses `JwtService`, `PrismaService`, throttle).
- `frontend/src/app/auth/login/page.tsx`: `handleDemo` now calls `/demo/session` (was `/auth/demo`), stores token same as normal login, renders banner when `demo:true` in JWT.
- `mobile/src/lib/api.ts`: `demoLoginRequest()` helper; `mobile/src/app/login.tsx`: "Try Demo" link.

## Data — Curated Fixture (demo school)

- Student: Demo Student Level 2 Group 1A, XP 340.
- Curriculum: Levels 1–2 only — 8 hymns (L1: Welcome Hymn, Psalm 150, Kyrie Eleison, Shere Ne Maria, Credo; L2: Doxology of Apostles, Trisagion, Intercessions) with EN/AR/Coptic titles.
- Badges: 10 badges, 2 earned, 8 locked.
- Attendance: 8 present / 1 late / 1 absent / 0 excused.
- Upcoming: 2 sessions. Assessments: 1 overdue, 1 upcoming, 1 done.

## Error Handling

- `POST /demo/session` over limit -> 429 + `Retry-After`.
- Expired/invalid guest JWT -> 401 -> redirect to login.
- Any `POST/PUT/DELETE` with `demo_viewer` -> 403 `demo_read_only`.
- Demo school missing -> auto-seed on first request, never expose production data.

## Testing

- `demo.service.spec.ts`: mints valid JWT (30m), 5/hr throttle keyed by IP, no DB insert.
- `demo.e2e-spec.ts`: guest reads `GET /student-portal/demo-student` OK; `POST /attendance` 403.
- `demo.controller.spec.ts`: throttle decorator present, public route.
- Manual: web banner visible + Exit clears token; mobile Try Demo lands on Home with demo data; after 30m token expired.

## Out of Scope

- Persistent demo user, `ENABLE_DEMO_LOGIN=true`, writes in demo, production data exposure, push/offline for demo.

## Success Criteria

1. `POST /api/demo/session` from a clean IP returns 201 with a 30-min JWT, 6th call in same hour 429.
2. Using that JWT, `GET /student-portal/demo-student` returns the 8-hymn fixture, `POST` to any mutating route 403.
3. Clicking Try Demo on web and on mobile lands on Home with demo student, banner visible, Exit returns to login, no DB user created.
