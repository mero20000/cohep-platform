# COHEP Mobile Phase 1 Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold an Expo (React Native) student app at `mobile/` wired to the existing NestJS student-portal API — access-key login plus Home, Practice, and Assessments tabs.

**Architecture:** Expo SDK + expo-router (file-based routing), NativeWind for Tailwind-style styling, JWT stored in `expo-secure-store`, pure TypeScript lib modules (`session`, `api`) that are unit-tested with vitest, thin RN screens verified manually + `tsc`.

**Tech Stack:** Expo SDK (latest stable), expo-router, expo-secure-store, NativeWind v4 + Tailwind, vitest + @testing-library/react (for the provider hook), TypeScript strict.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-26-mobile-phase1-scaffold-design.md` — read before starting.
- Work only inside `mobile/` and `docs/superpowers/plans/`. NEVER touch `frontend/`, `backend/`, `render.yaml`.
- API base: `https://niangelos-backend.onrender.com/api` (override via `EXPO_PUBLIC_API_URL`).
- Student portal auth: `POST /student-portal/login` `{ portalAccessKey }` → `{ accessToken }`; the access key IS the `:code` route param; JWT TTL 12h; send `Authorization: Bearer <token>` on all other calls; 401 ⇒ clear session.
- Never hardcode any real access key in source. Manual verification uses a key typed at runtime.
- Commits: conventional prefixes (`feat:`, `test:`, `chore:`) matching repo history. Commit after every task.
- Merge gate per task: `npx tsc --noEmit` clean inside `mobile/`; vitest green where tests exist.
- All commands run from `mobile/` unless noted.

---

### Task 1: Scaffold the Expo app and strip demo code

**Files:**
- Create: `mobile/**` (via create-expo-app)
- Delete: `mobile/components/example-button.tsx`, `mobile/components/edit-screen-info.tsx`, `mobile/components/hello-wave.tsx`, `mobile/components/parallax-scroll-view.tsx`, `mobile/components/themed-text.tsx`, `mobile/components/themed-view.tsx`, `mobile/components/ui/*`, `mobile/constants/theme.ts`, `mobile/hooks/use-theme*.ts`, `mobile/app/(tabs)/explore.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/+not-found.tsx`, `mobile/scripts/reset-project.js`, `mobile/components/navigation/tab-bar-background.tsx` (delete whichever of these exist)

**Interfaces:**
- Consumes: network + npm registry.
- Produces: runnable Expo app at `mobile/` with empty `app/` shell (only `_layout.tsx` placeholder kept temporarily) — later tasks fill it.

- [ ] **Step 1: Scaffold**

From repo root:

```bash
npx create-expo-app@latest mobile --template default
```

Expected: `mobile/` created with TypeScript + expo-router template, `npm install` ran automatically. If it did not auto-install, run `npm install` inside `mobile/`.

- [ ] **Step 2: Strip demo files**

```bash
rm -rf components constants hooks scripts "app/(tabs)/explore.tsx" "app/(tabs)/index.tsx" "app/+not-found.tsx" app/(tabs)
mkdir -p "app/(tabs)" src/lib src/__tests__
```

Keep `assets/`, `app.json`, `app/_layout.tsx` (replaced in Task 5), `app/index.tsx` (replaced in Task 5), `.gitignore` (verify it lists `.expo/`, `node_modules/`).

- [ ] **Step 3: Verify toolchain**

```bash
npx tsc --noEmit && echo OK
```

Expected: `OK` (template compiles even with stripped files; fix leftover imports in `app/_layout.tsx` by reducing it to `<Stack />` with only `react-native`/`expo-router` imports).

- [ ] **Step 4: Commit**

```bash
cd .. && git add mobile && git commit -m "chore(mobile): scaffold Expo app (default template, demo code stripped)"
```

---

### Task 2: NativeWind (Tailwind) wiring

**Files:**
- Create: `mobile/global.css`, `mobile/tailwind.config.js`, `mobile/babel.config.js`, `mobile/metro.config.js`, `mobile/nativewind-env.d.ts`
- Modify: `mobile/package.json` (deps via expo install)

**Interfaces:**
- Produces: `className` props usable on RN core components project-wide; `global.css` imported by root layout in Task 5.

- [ ] **Step 1: Install**

```bash
npx expo install nativewind tailwindcss react-native-reanimated react-native-safe-area-context
```

- [ ] **Step 2: Config files**

`tailwind.config.js`:

```js
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
}
```

`global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    plugins: ['nativewind/babel', 'react-native-reanimated/plugin'],
  }
}
```

`metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const config = getDefaultConfig(__dirname)
module.exports = withNativeWind(config, { input: './global.css' })
```

`nativewind-env.d.ts`:

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && echo OK
```

- [ ] **Step 4: Commit**

```bash
cd .. && git add mobile && git commit -m "chore(mobile): wire NativeWind/Tailwind into Metro+babel"
```

---

### Task 3: Session storage module (`src/lib/session.ts`) — TDD

**Files:**
- Create: `mobile/src/lib/session.ts`
- Test: `mobile/src/__tests__/session.test.ts`
- Modify: `mobile/package.json` (dev deps: vitest, jsdom, @testing-library/react)

**Interfaces:**
- Produces: `interface Session { token: string; studentCode: string }`, `saveSession(s): Promise<void>`, `getSavedSession(): Promise<Session | null>` (null on missing/corrupt), `clearSession(): Promise<void>`.

- [ ] **Step 1: Install test tooling**

```bash
npm i -D vitest jsdom @testing-library/react
```

Add to `package.json` scripts: `"test": "vitest run"`.
Create `mobile/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 2: Write failing test** — `src/__tests__/session.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, string>()
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}))

import { saveSession, getSavedSession, clearSession } from '../lib/session'

beforeEach(() => store.clear())

describe('session storage', () => {
  it('round-trips a session', async () => {
    await saveSession({ token: 't1', studentCode: 'c1' })
    await expect(getSavedSession()).resolves.toEqual({ token: 't1', studentCode: 'c1' })
  })

  it('returns null when nothing saved', async () => {
    await expect(getSavedSession()).resolves.toBeNull()
  })

  it('returns null on corrupt JSON', async () => {
    store.set('cohep.portal.session', '{oops')
    await expect(getSavedSession()).resolves.toBeNull()
  })

  it('returns null when required fields are missing', async () => {
    store.set('cohep.portal.session', JSON.stringify({ token: 'x' }))
    await expect(getSavedSession()).resolves.toBeNull()
  })

  it('clearSession removes it', async () => {
    await saveSession({ token: 't', studentCode: 'c' })
    await clearSession()
    await expect(getSavedSession()).resolves.toBeNull()
  })
})
```

- [ ] **Step 3: Run, verify FAIL**

Run: `npm test`
Expected: FAIL — cannot resolve `../lib/session`.

- [ ] **Step 4: Implement** — `src/lib/session.ts`:

```ts
import * as SecureStore from 'expo-secure-store'

export interface Session {
  token: string
  studentCode: string
}

const KEY = 'cohep.portal.session'

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session))
}

export async function getSavedSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Session>
    if (parsed.token && parsed.studentCode) return parsed as Session
    return null
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY)
}
```

- [ ] **Step 5: Run, verify PASS** — `npm test` → 5 passed.

- [ ] **Step 6: Commit**

```bash
cd .. && git add mobile && git commit -m "feat(mobile): secure session storage with tests"
```

---

### Task 4: API client (`src/lib/config.ts`, `src/lib/types.ts`, `src/lib/api.ts`) — TDD

**Files:**
- Create: `mobile/src/lib/config.ts`, `mobile/src/lib/types.ts`, `mobile/src/lib/api.ts`
- Test: `mobile/src/__tests__/api.test.ts`

**Interfaces:**
- Consumes: `Session` helpers from Task 3.
- Produces:
  - `class UnauthorizedError extends Error`, `class ApiError extends Error { status: number }`
  - `setUnauthorizedHandler(fn: () => void): void`
  - `loginRequest(portalAccessKey: string): Promise<{ accessToken: string }>`
  - `fetchPortalData(): Promise<PortalData>`, `fetchHymnMap(): Promise<HymnMapItem[]>`
  - `MASTERY_META` record for chips (label + dot color).

- [ ] **Step 1: Write failing test** — `src/__tests__/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, string>()
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}))

import { saveSession, clearSession } from '../lib/session'
import { apiFetch, loginRequest, UnauthorizedError, setUnauthorizedHandler } from '../lib/api'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

beforeEach(() => {
  store.clear()
  fetchMock.mockReset()
})

describe('loginRequest', () => {
  it('posts the access key and returns accessToken', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(201, { accessToken: 'jwt' }))
    await expect(loginRequest('KEY')).resolves.toEqual({ accessToken: 'jwt' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/student-portal/login'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ portalAccessKey: 'KEY' }) }),
    )
  })

  it('maps 401 to ApiError invalid key', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, {}))
    await expect(loginRequest('BAD')).rejects.toThrow(/Invalid access key/)
  })

  it('maps network failure to friendly ApiError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(loginRequest('KEY')).rejects.toThrow(/connection/)
  })
})

describe('apiFetch', () => {
  it('injects Bearer token from saved session', async () => {
    await saveSession({ token: 'jwt', studentCode: 'CODE' })
    fetchMock.mockResolvedValueOnce(jsonRes(200, { hello: 1 }))
    await expect(apiFetch('/student-portal/CODE')).resolves.toEqual({ hello: 1 })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer jwt')
  })

  it('throws UnauthorizedError immediately without a session', async () => {
    await expect(apiFetch('/anything')).rejects.toBeInstanceOf(UnauthorizedError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('on 401 clears session and fires handler', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    await saveSession({ token: 'old', studentCode: 'C' })
    fetchMock.mockResolvedValueOnce(jsonRes(401, {}))
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(UnauthorizedError)
    expect(handler).toHaveBeenCalled()
    await expect(import('../lib/session').then(m => m.getSavedSession())).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify FAIL** — `npm test` → resolution errors for `../lib/api`.

- [ ] **Step 3: Implement** the three lib files.

`src/lib/config.ts`:

```ts
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://niangelos-backend.onrender.com/api'
```

`src/lib/types.ts`:

```ts
export type MasteryLevel = 'not_started' | 'introduced' | 'practicing' | 'known' | 'mastered'

export interface PortalData {
  student: {
    name: string
    nameAr?: string
    studentCode: string
    photoUrl?: string
    level: { number: number; name: string }
    group?: { name?: string; nameAr?: string }
  }
  school: {
    name?: string
    nameAr?: string
    logoUrl?: string
    churchName?: string
    churchNameAr?: string
    churchLogoUrl?: string | null
  } | null
  totalXp: number
  attendance: { present: number; late: number; absent: number; excused: number; total: number }
  badges: Array<{
    id: string
    name?: string
    nameAr?: string
    iconUrl?: string
    earnedAt: string
    awardedBy?: string | null
  }>
  assessments: Array<{
    id: string
    title: string
    titleAr?: string
    type: string
    totalPoints: number
    dueDate?: string
    submissionStatus: string
    subject: { name: string; nameAr?: string }
  }>
  upcomingSessions?: Array<{ id: string; date?: string; topic?: string }>
}

export interface HymnMapItem {
  id: string
  title: string
  titleAr?: string
  titleCoptic?: string
  level: { number: number }
  subject: { name: string; nameAr?: string }
  masteryLevel?: MasteryLevel
}
```

`src/lib/api.ts`:

```ts
import { API_URL } from './config'
import { clearSession, getSavedSession } from './session'
import type { HymnMapItem, MasteryLevel, PortalData } from './types'

export class UnauthorizedError extends Error {}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

let unauthorizedHandler: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, `API responded ${res.status}`)
  return (await res.json()) as T
}

export async function loginRequest(portalAccessKey: string): Promise<{ accessToken: string }> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/student-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalAccessKey }),
    })
  } catch {
    throw new ApiError(0, 'No connection — check your internet and try again.')
  }
  if (res.status === 400 || res.status === 401 || res.status === 404) {
    throw new ApiError(res.status, 'Invalid access key.')
  }
  return parseJson<{ accessToken: string }>(res)
}

async function requireSession() {
  const session = await getSavedSession()
  if (!session) throw new UnauthorizedError('No active session')
  return session
}

export async function apiFetch<T>(path: string): Promise<T> {
  const session = await requireSession()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
  } catch {
    throw new ApiError(0, 'No connection — check your internet and try again.')
  }
  if (res.status === 401) {
    await clearSession()
    unauthorizedHandler?.()
    throw new UnauthorizedError('Session expired')
  }
  return parseJson<T>(res)
}

async function portalPath(suffix = ''): Promise<string> {
  const session = await requireSession()
  return `/student-portal/${session.studentCode}${suffix}`
}

export const fetchPortalData = (): Promise<PortalData> =>
  portalPath().then(p => apiFetch<PortalData>(p))

export const fetchHymnMap = (): Promise<HymnMapItem[]> =>
  portalPath('/hymn-map').then(p => apiFetch<HymnMapItem[]>(p))

export const MASTERY_META: Record<MasteryLevel, { label: string; color: string }> = {
  not_started: { label: 'Not started', color: '#9ca3af' },
  introduced: { label: 'Introduced', color: '#38bdf8' },
  practicing: { label: 'Practicing', color: '#f59e0b' },
  known: { label: 'Known', color: '#34d399' },
  mastered: { label: 'Mastered', color: '#d4af37' },
}
```

- [ ] **Step 4: Run, verify PASS** — `npm test` → all session + api tests green (11 total).

- [ ] **Step 5: Commit**

```bash
cd .. && git add mobile && git commit -m "feat(mobile): API client with Bearer auth, 401 handling, typed payloads"
```

---

### Task 5: Auth provider + root layout + login flow

**Files:**
- Create: `mobile/src/lib/auth.tsx`, `mobile/src/__tests__/auth.test.tsx`, `mobile/app/_layout.tsx`, `mobile/app/index.tsx`, `mobile/app/login.tsx`
- Test: `mobile/src/__tests__/auth.test.tsx`

**Interfaces:**
- Consumes: `saveSession/getSavedSession/clearSession`, `loginRequest`, `ApiError` (Task 3–4).
- Produces: `useAuth(): { session: Session | null; ready: boolean; loggingIn: boolean; loginError: string | null; login(key: string): Promise<boolean>; logout(): Promise<void> }` — screens consume this exclusively.

- [ ] **Step 1: Path aliases** — extend `mobile/tsconfig.json` compilerOptions:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "nativewind-env.d.ts"]
}
```

- [ ] **Step 2: Write failing test** — `src/__tests__/auth.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const store = new Map<string, string>()
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}))
vi.mock('@expo/vector-icons', () => ({}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { AuthProvider, useAuth } from '../lib/auth'

function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

beforeEach(() => {
  store.clear()
  fetchMock.mockReset()
})

describe('AuthProvider', () => {
  it('restores an existing session on mount', async () => {
    store.set('cohep.portal.session', JSON.stringify({ token: 't', studentCode: 'c' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.session).toEqual({ token: 't', studentCode: 'c' })
  })

  it('login stores session and resolves true on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(201, { accessToken: 'jwt' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    let ok = false
    await act(async () => {
      ok = await result.current.login(' KEY ')
    })
    expect(ok).toBe(true)
    expect(result.current.session).toEqual({ token: 'jwt', studentCode: 'KEY' })
  })

  it('login surfaces a friendly error and returns false on bad key', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, {}))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    let ok = true
    await act(async () => {
      ok = await result.current.login('NOPE')
    })
    expect(ok).toBe(false)
    expect(result.current.loginError).toBe('Invalid access key.')
  })

  it('logout clears the stored session', async () => {
    store.set('cohep.portal.session', JSON.stringify({ token: 't', studentCode: 'c' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.session).not.toBeNull())
    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.session).toBeNull()
  })
})
```

- [ ] **Step 3: Run, verify FAIL** — `npm test` → cannot resolve `../lib/auth`.

- [ ] **Step 4: Implement** `src/lib/auth.tsx`:

```tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  clearSession,
  getSavedSession,
  saveSession,
  type Session,
} from './session'
import { ApiError, loginRequest, setUnauthorizedHandler } from './api'

interface AuthContextValue {
  session: Session | null
  ready: boolean
  loggingIn: boolean
  loginError: string | null
  login(accessKey: string): Promise<boolean>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    getSavedSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (accessKey: string): Promise<boolean> => {
    const key = accessKey.trim()
    if (!key) {
      setLoginError('Enter your access key.')
      return false
    }
    setLoggingIn(true)
    setLoginError(null)
    try {
      const { accessToken } = await loginRequest(key)
      const next: Session = { token: accessToken, studentCode: key }
      await saveSession(next)
      setSession(next)
      return true
    } catch (e) {
      setLoginError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
      return false
    } finally {
      setLoggingIn(false)
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    await clearSession()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, ready, loggingIn, loginError, login, logout }),
    [session, ready, loggingIn, loginError, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

Register the 401 redirect in `app/_layout.tsx` (below) via `setUnauthorizedHandler`.

- [ ] **Step 5: Implement screens.**

`app/_layout.tsx`:

```tsx
import React, { useCallback } from 'react'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '@/src/lib/auth'
import { setUnauthorizedHandler } from '@/src/lib/api'
import '../global.css'

void SplashScreen.preventAutoHideAsync()

function Routes() {
  const { ready } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    setUnauthorizedHandler(() => router.replace('/login'))
  }, [router])

  React.useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}

export default function Layout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Routes />
    </AuthProvider>
  )
}
```

`app/index.tsx`:

```tsx
import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { useAuth } from '@/src/lib/auth'

export default function Index() {
  const { session, ready } = useAuth()
  if (!ready) return <View className="flex-1 bg-[#0f172a]" />
  return <Redirect href={session ? '/(tabs)' : '/login'} />
}
```

`app/login.tsx`:

```tsx
import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Cross } from 'lucide-react-native'
import { useAuth } from '@/src/lib/auth'

export default function Login() {
  const { login, loggingIn, loginError } = useAuth()
  const router = useRouter()
  const [key, setKey] = useState('')

  const submit = async () => {
    if (await login(key)) router.replace('/(tabs)')
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-8"
      >
        <View className="items-center mb-10">
          <View className="h-16 w-16 items-center justify-center rounded-2xl border border-gold-500/40 bg-white/5 mb-4">
            <Cross size={28} color="#d4af37" />
          </View>
          <Text className="text-white text-2xl font-bold">COHEP</Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Enter the access key from your servant
          </Text>
        </View>

        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder="Access key"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loggingIn}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-white"
        />

        {loginError ? (
          <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">
            {loginError}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={loggingIn || key.trim().length === 0}
          className="mt-6 flex-row items-center justify-center rounded-xl bg-gold-500 py-4 disabled:opacity-50"
        >
          {loggingIn ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text className="font-bold text-[#0f172a]">Sign in</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
```

Install its icon dependency:

```bash
npm i lucide-react-native react-native-svg && npx expo install react-native-svg
```

(`lucide-react-native` matches the web app's icon vocabulary.)

- [ ] **Step 6: Run tests, verify PASS** — `npm test` → all green (15 tests).
- [ ] **Step 7: Typecheck** — `npx tsc --noEmit` → clean.
- [ ] **Step 8: Commit**

```bash
cd .. && git add mobile && git commit -m "feat(mobile): auth provider, secure login screen, guarded root layout"
```

---

### Task 6: Tabs shell + Home screen

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/home.tsx`, `mobile/src/components/screen-frame.tsx`

**Interfaces:**
- Consumes: `useAuth`, `fetchPortalData`, `PortalData` (Tasks 4–5).
- Produces: `ScreenFrame({ loading, error, onRetry, children })` — shared loading/error/retry chrome reused by Tasks 7–8.

- [ ] **Step 1: `src/components/screen-frame.tsx`:**

```tsx
import React from 'react'
import { ActivityIndicator, Pressable, RefreshControlProps, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

interface Props {
  loading: boolean
  error: string | null
  onRetry: () => void
  refreshControl?: RefreshControlProps
  children: React.ReactNode
}

export function ScreenFrame({ loading, error, onRetry, refreshControl, children }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['top']}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#d4af37" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-gray-300">{error}</Text>
          <Pressable onPress={onRetry} className="mt-4 rounded-full bg-gold-500 px-6 py-2.5">
            <Text className="font-semibold text-[#0f172a]">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView refreshControl={refreshControl} contentContainerClassName="px-5 pb-10">
          {children}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
```

If your TS flags `contentContainerClassName`, use `contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}` instead.

- [ ] **Step 2: `app/(tabs)/_layout.tsx`:**

```tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const NAVY = '#0f172a'
const GOLD = '#d4af37'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { backgroundColor: NAVY, borderTopColor: '#1e293b' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="practice"
        options={{ title: 'Practice', tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="assessments"
        options={{ title: 'Assessments', tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" color={color} size={size} /> }}
      />
    </Tabs>
  )
}
```

- [ ] **Step 3: `app/(tabs)/home.tsx`** — identity banner, XP, attendance, upcoming sessions:

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { Image, RefreshControl, Text, View } from 'react-native'
import { ScreenFrame } from '@/src/components/screen-frame'
import { fetchPortalData } from '@/src/lib/api'
import type { PortalData } from '@/src/lib/types'

const NETWORK_MSG = 'No connection — check your internet and try again.'

export default function Home() {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      setData(await fetchPortalData())
    } catch (e) {
      setError(e instanceof Error && e.message.includes('connection') ? NETWORK_MSG : 'Could not load your dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const initials = (data?.student.name ?? '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <ScreenFrame
      loading={loading}
      error={error}
      onRetry={() => void load()}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#d4af37" />
      }
    >
      {!data ? null : (
      <>
      {/* Church & School identity */}
      {data.school && (
        <View className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-xl border border-gold-500/40 bg-white/10 overflow-hidden">
              {data.school.churchLogoUrl ? (
                <Image source={{ uri: data.school.churchLogoUrl }} className="h-full w-full" resizeMode="contain" />
              ) : (
                <Text className="text-gold-500 text-lg">✝</Text>
              )}
            </View>
            <View className="flex-1 items-center">
              <Text numberOfLines={1} className="font-bold text-white">
                {data.school.churchName ?? data.school.name}
              </Text>
              {!!data.school.name && (
                <Text numberOfLines={1} className="text-xs text-gold-500 mt-0.5">{data.school.name}</Text>
              )}
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 overflow-hidden">
              {data.school.logoUrl ? (
                <Image source={{ uri: data.school.logoUrl }} className="h-full w-full" resizeMode="contain" />
              ) : (
                <Text className="text-gray-400 text-lg">♪</Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Student hero */}
      <View className="mb-5 flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/20 border border-gold-500/40 overflow-hidden">
          {data.student.photoUrl ? (
            <Image source={{ uri: data.student.photoUrl }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-xl font-bold text-gold-500">{initials}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-2xl font-bold text-white">{data.student.name}</Text>
          <Text className="text-sm text-gray-400">
            Level {data.student.level.number}
            {data.student.group?.name ? ` · ${data.student.group.name}` : ''}
          </Text>
        </View>
      </View>

      {/* XP */}
      <View className="mb-5 rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4">
        <Text className="text-xs uppercase tracking-wide text-gold-500">Total XP</Text>
        <Text className="text-3xl font-bold text-white tabular-nums">{data.totalXp}</Text>
        {!!data.badges.length && (
          <Text className="text-xs text-gray-400 mt-1">
            🏅 {data.badges.length} badge{data.badges.length === 1 ? '' : 's'}
          </Text>
        )}
      </View>

      {/* Attendance */}
      <Text className="mb-2 font-semibold text-white">Attendance</Text>
      <View className="mb-5 flex-row gap-2">
        {([
          ['Present', data.attendance.present, 'text-green-400'],
          ['Late', data.attendance.late, 'text-amber-400'],
          ['Absent', data.attendance.absent, 'text-red-400'],
          ['Excused', data.attendance.excused, 'text-sky-400'],
        ] as const).map(([label, count, tint]) => (
          <View key={label} className="flex-1 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <Text className={`text-lg font-bold ${tint} text-center`}>{count}</Text>
            <Text className="text-[10px] text-gray-400 text-center">{label}</Text>
          </View>
        ))}
      </View>

      {/* Upcoming */}
      {!!data.upcomingSessions?.length && (
        <>
          <Text className="mb-2 font-semibold text-white">Upcoming</Text>
          {data.upcomingSessions.slice(0, 3).map(s => (
            <View key={s.id} className="mb-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Text className="text-white">{s.topic ?? 'Class session'}</Text>
              {!!s.date && (
                <Text className="text-xs text-gray-400 mt-0.5">
                  {new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
              )}
            </View>
          ))}
        </>
      )}
      </>
      )}
    </ScreenFrame>
  )
}
```

(The `{!data ? null : (<>...</>)}` guard satisfies strict TS — `data` stays nullable until a successful fetch; ScreenFrame already renders loading/error chrome so null children are unreachable in practice.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; `npm test` still green.
- [ ] **Step 5: Commit**

```bash
cd .. && git add mobile && git commit -m "feat(mobile): tabs shell + Home screen (identity, XP, attendance)"
```

---

### Task 7: Practice tab (hymn map, collapsible subjects)

**Files:**
- Create: `mobile/app/(tabs)/practice.tsx`

**Interfaces:**
- Consumes: `fetchHymnMap`, `HymnMapItem`, `MASTERY_META` (Task 4), `ScreenFrame` (Task 6).
- Produces: none downstream.

- [ ] **Step 1: Implement** `app/(tabs)/practice.tsx`:

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ScreenFrame } from '@/src/components/screen-frame'
import { fetchHymnMap, MASTERY_META } from '@/src/lib/api'
import type { HymnMapItem } from '@/src/lib/types'

const SUBJECT_ACCENTS: Record<string, string> = {
  hymns: 'border-l-amber-400',
  rites: 'border-l-purple-400',
  language: 'border-l-sky-400',
  coptic: 'border-l-sky-400',
  studies: 'border-l-emerald-400',
}

function accentFor(subjectName: string): string {
  const n = subjectName.toLowerCase()
  for (const [needle, cls] of Object.entries(SUBJECT_ACCENTS)) {
    if (n.includes(needle)) return cls
  }
  return 'border-l-indigo-400'
}

export default function Practice() {
  const [items, setItems] = useState<HymnMapItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchHymnMap())
    } catch (e) {
      setError(e instanceof Error && e.message.includes('connection')
        ? 'No connection — check your internet and try again.'
        : 'Could not load your hymns.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, HymnMapItem[]>()
    for (const item of items ?? []) {
      const key = item.subject.name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return [...map.entries()]
  }, [items])

  const toggle = (subject: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(subject) ? next.delete(subject) : next.add(subject)
      return next
    })

  return (
    <ScreenFrame loading={loading} error={error} onRetry={() => void load()}>
      <Text className="mb-4 text-xl font-bold text-white">Your Hymn Map</Text>
      {!items?.length ? (
        <View className="rounded-2xl border border-dashed border-white/20 p-8 items-center">
          <Text className="text-gray-400 text-center">
            No hymns allocated yet — your servant will add them soon.
          </Text>
        </View>
      ) : (
        grouped.map(([subject, hymns]) => {
          const open = expanded.has(subject)
          return (
            <View key={subject} className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <Pressable onPress={() => toggle(subject)} className="flex-row items-center px-4 py-3.5">
                <View className="flex-1">
                  <Text className="font-semibold text-white">{subject}</Text>
                  <Text className="text-xs text-gray-400">{hymns.length} hymns</Text>
                </View>
                <Text className="text-gray-400">{open ? '▾' : '▸'}</Text>
              </Pressable>
              {open &&
                hymns.map(h => {
                  const meta = h.masteryLevel ? MASTERY_META[h.masteryLevel] : null
                  return (
                    <View
                      key={h.id}
                      className={`border-l-4 ${accentFor(subject)} border-t border-white/5 px-4 py-3`}
                    >
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1">
                          {!!h.titleCoptic && <Text className="text-white font-medium">{h.titleCoptic}</Text>}
                          <Text className="text-gray-400 text-xs">
                            {h.titleAr ?? h.title} · L{h.level.number}
                          </Text>
                        </View>
                        {meta && (
                          <View
                            className="rounded-full px-2.5 py-1"
                            style={{ backgroundColor: `${meta.color}22` }}
                          >
                            <Text style={{ color: meta.color }} className="text-[10px] font-semibold">
                              {meta.label}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )
                })}
            </View>
          )
        })
      )}
    </ScreenFrame>
  )
}
```

(Collapsed-by-default matches the web Teaching View behavior.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean.
- [ ] **Step 3: Commit**

```bash
cd .. && git add mobile && git commit -m "feat(mobile): Practice tab with grouped, collapsible hymn map"
```

---

### Task 8: Assessments tab (overdue/upcoming/done)

**Files:**
- Create: `mobile/app/(tabs)/assessments.tsx`

**Interfaces:**
- Consumes: `fetchPortalData`, `PortalData['assessments']` (Tasks 4, 6), `ScreenFrame`.
- Produces: none downstream.

- [ ] **Step 1: Implement** `app/(tabs)/assessments.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { ScreenFrame } from '@/src/components/screen-frame'
import { fetchPortalData } from '@/src/lib/api'
import type { PortalData } from '@/src/lib/types'

type A = PortalData['assessments'][number]

function split(a: A[]) {
  const done = a.filter(x => x.submissionStatus === 'completed')
  const overdue = a.filter(
    x => x.submissionStatus !== 'completed' && x.dueDate && new Date(x.dueDate) < new Date(),
  )
  const pending = a.filter(
    x => x.submissionStatus !== 'completed' && !(x.dueDate && new Date(x.dueDate) < new Date()),
  )
  return { done, overdue, pending }
}

function dueLabel(dueDate?: string): string | null {
  if (!dueDate) return null
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`
  if (days === 0) return 'Due today!'
  return `in ${days} day${days === 1 ? '' : 's'}`
}

// NOTE: every className below must be a complete literal string —
// NativeWind compiles Tailwind classes statically and cannot see
// dynamically constructed names.
const SECTION_STYLES = {
  overdue: { title: 'Overdue — needs attention', tint: 'text-red-400', barLeft: 'border-l-red-400', chip: 'bg-red-400/20' },
  pending: { title: 'Upcoming', tint: 'text-sky-400', barLeft: 'border-l-sky-400', chip: 'bg-sky-400/20' },
  done: { title: 'Completed 🎉', tint: 'text-green-400', barLeft: 'border-l-green-400', chip: 'bg-green-400/20' },
} as const

function Card({ item, kind }: { item: A; kind: keyof typeof SECTION_STYLES }) {
  const s = SECTION_STYLES[kind]
  const label = dueLabel(item.dueDate)
  return (
    <View className={`mb-2 rounded-2xl border border-white/10 bg-white/5 border-l-4 ${s.barLeft} px-4 py-3.5`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text numberOfLines={1} className={`font-semibold text-white ${kind === 'done' ? 'line-through opacity-60' : ''}`}>
            {item.titleAr ?? item.title}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
            <View className={`rounded-full px-2 py-0.5 ${s.chip}`}>
              <Text className={`text-[10px] font-medium ${s.tint}`}>{item.subject.nameAr ?? item.subject.name}</Text>
            </View>
            <Text className="text-[11px] text-gray-400">{item.totalPoints} pts</Text>
            {label && kind !== 'done' && <Text className={`text-[11px] font-medium ${kind === 'overdue' ? 'text-red-400' : 'text-amber-400'}`}>{label}</Text>}
          </View>
        </View>
        {kind === 'done' && <Text className="text-green-400 text-lg">✓</Text>}
      </View>
    </View>
  )
}

export default function Assessments() {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchPortalData())
    } catch (e) {
      setError(e instanceof Error && e.message.includes('connection')
        ? 'No connection — check your internet and try again.'
        : 'Could not load your assessments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const { overdue, pending, done } = data ? split(data.assessments) : { overdue: [], pending: [], done: [] }
  const total = overdue.length + pending.length + done.length
  const pct = total ? Math.round((done.length / total) * 100) : 0

  return (
    <ScreenFrame loading={loading} error={error} onRetry={() => void load()}>
      <Text className="text-xl font-bold text-white">Assigned Assessments</Text>
      {total > 0 && (
        <View className="my-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <Text className="text-sm text-gray-300">
            {pct === 100 ? '🌟 All done — amazing!' : `${done.length}/${total} completed`}
          </Text>
          <View className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <View className={`h-full rounded-full ${pct === 100 ? 'bg-green-400' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} />
          </View>
        </View>
      )}
      {total === 0 ? (
        <View className="mt-6 rounded-2xl border border-dashed border-white/20 p-8 items-center">
          <Text className="text-center text-gray-400">
            Nothing assigned right now — keep practicing!
          </Text>
        </View>
      ) : (
        (['overdue', 'pending', 'done'] as const).map(kind => {
          const list = kind === 'overdue' ? overdue : kind === 'pending' ? pending : done
          if (!list.length) return null
          return (
            <View key={kind} className="mt-4">
              <Text className={`mb-2 text-xs font-bold uppercase tracking-wide ${SECTION_STYLES[kind].tint}`}>
                {SECTION_STYLES[kind].title}
              </Text>
              {list.map(item => <Card key={item.id} item={item} kind={kind} />)}
            </View>
          )
        })
      )}
    </ScreenFrame>
  )
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; `npm test` green.
- [ ] **Step 3: Commit**

```bash
cd .. && git add mobile && git commit -m "feat(mobile): Assessments tab with progress, urgency sections"
```

---

### Task 9: End-to-end manual verification + final push

**Files:** none created (verification task).

**Interfaces:** consumes everything above.

- [ ] **Step 1: Full gates**

```bash
npm test && npx tsc --noEmit && npx expo export --platform ios && echo ALL-GATES-PASS
```

Expected: vitest green, tsc clean, Metro bundles successfully (proves no runtime-import breakage).

- [ ] **Step 2: Device smoke test**

Start `npx expo start`, open in Expo Go (physical phone or simulator). Verify against spec success criteria:
1. Login screen renders; entering Robin's access key (typed manually, never committed) lands on Home with his real name, Level, XP, attendance.
2. Practice tab lists his hymn-map items, subjects collapsed by default.
3. Assessments tab reflects backend state.
4. Force-quit and reopen → session restored, lands straight on tabs.
5. Airplane-mode ON → friendly retry states appear, no crash; OFF → retry recovers.

- [ ] **Step 3: Push**

```bash
git push origin main
```

(Vercel/Render ignore `mobile/` — no deploy triggered.)
