# COHEP Mobile App — Phase 1 Scaffold Design

**Date:** 2026-08-26
**Status:** Approved design, pending implementation plan

## Goal

Scaffold an Expo (React Native) student app in the monorepo at `mobile/`, wired to the existing NestJS backend. Phase 1 delivers: access-key login, home dashboard, practice list, and assessments list — a native entry point to the student hymn journey. Later phases add audio practice, push notifications, offline support, and parent/servant roles.

## Context

- Backend: `https://niangelos-backend.onrender.com/api` (NestJS on Render).
- Student portal auth = access key → 12h JWT: `POST /api/student-portal/login` body `{ portalAccessKey }` → `{ accessToken }`. Subsequent calls send `Authorization: Bearer <token>` to `/api/student-portal/:code/*`.
- Endpoints used in Phase 1: `GET /student-portal/:code` (portal data), `/hymn-map`, `/achievements`.
- Deploy scoping: Vercel builds `frontend/` only; Render blueprint `rootDir: backend` only. A new `mobile/` directory triggers zero deploys.
- Team stack is TypeScript + React (Next.js); Tailwind utilities are daily vocabulary.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Repo placement | Monorepo `mobile/` | Shared history/issues; deploy pipelines unaffected |
| Framework | Expo SDK (latest stable) + expo-router | File-based routing like Next.js; EAS builds iOS without a Mac |
| Scaffold method | `create-expo-app` default template, strip demo code | Official, version-consistent start |
| Styling | NativeWind (Tailwind for RN) | Reuses team's utility vocabulary; match portal navy/gold identity |
| Token storage | `expo-secure-store` | Keychain/Keystore-backed; no localStorage on native |
| Testing | Vitest for logic units | Matches existing repo test tooling |

## Architecture

```
mobile/
  app/                      # expo-router routes
    _layout.tsx             # AuthProvider wrapper + root Stack
    index.tsx               # redirect: session ? /(tabs) : /login
    login.tsx               # access-key form → POST /student-portal/login
    (tabs)/
      _layout.tsx           # Tab bar: Home · Practice · Assessments
      home.tsx              # identity banner (church/school logos + names), student
                            # name/level, Total XP tile, attendance tiles, upcoming sessions
      practice.tsx          # hymn-map list: subject color accents + mastery chips,
                            # grouped by subject, collapsed by default (web parity)
      assessments.tsx       # Overdue / Upcoming / Completed sections with due countdowns
  src/
    lib/config.ts           # API_URL: prod default, EXPO_PUBLIC_API_URL override
    lib/auth.tsx            # AuthProvider: login(code), logout(), session {token, studentCode};
                            # JWT persisted via SecureStore, restored on launch
    lib/api.ts              # apiFetch(path): injects Bearer; on 401 clears session → /login;
                            # typed helpers fetchPortalData / fetchHymnMap / fetchAchievements
    types.ts                # PortalData, HymnMapItem, Assessment mirrors of backend payloads
```

## Data Flow

1. Login screen → `POST /api/student-portal/login` with access key.
2. On success store `{ token, studentCode }` in SecureStore; replace route to `(tabs)`.
3. Tabs fetch via `apiFetch` with Bearer header. No caching layer in Phase 1 (react-query can arrive when screens need mutations).
4. Launch: AuthProvider reads SecureStore before first render (splash held until checked).

## Error Handling

- Network failure / timeout: per-screen friendly state ("Check your connection and try again" + Retry) — church venues often have poor signal.
- Invalid access key: inline field error, not an alert.
- 401 mid-session: clear SecureStore, silent redirect to login.
- Unknown errors: generic message + retry; never a red-screen crash.

## Testing

- Vitest units for `lib/api.ts` (header injection, 401 → logout behavior) and `lib/auth.tsx` (login success/failure, persistence round-trip) with mocked `fetch` and `expo-secure-store`.
- Screens verified manually via `npx expo start` (Expo Go on device/simulator) against production backend using a real student access key.
- `tsc --noEmit` clean is the merge gate.

## Out of Scope (Phase 1)

Audio player/recording, push notifications, offline downloads, XP awarding, parent/servant experiences, app-store assets/submission.

## Success Criteria

1. Fresh clone → `npm install && npx expo start` runs in Expo Go.
2. A valid student access key lands on Home showing that student's real name, level, XP, attendance.
3. Practice tab lists the same hymn-map items as the web portal.
4. Assessments tab reflects pending/overdue/done state from the backend.
5. Killing and reopening the app restores the session without re-entering the key.
