# MEASURE — Product Analytics (C1–C4)

Self-hosted, privacy-respecting product analytics for the four post-GA product
initiatives. Telemetry is low-sensitivity screen/action events, stored in
Postgres (`app_sessions`, `analytics_events`), collected via
`POST /api/analytics/events`, and surfaced through `GET /api/analytics/metrics`.

No third-party analytics SDKs or cookies are involved. The collector is
`@Public()` + rate-limited because beacons/keepalive fetches can't reliably
carry an auth header; the payload contains no PII beyond the user's own id.

## The four initiatives and their KPIs

| Initiative | Why | KPI | Source |
|-----------|-----|-----|--------|
| **C1** Two-world reconciliation (gold/navy "built for the Church" identity) | The brand promise is the only moat vs generic school SaaS; child portal already proves payoff | `avgSessionLengthSec`, `settingsCompletionDelta` | `app_sessions`, `analytics_events(name='settings.task_completed')` |
| **C2** Servant onboarding ("Start Class" first-run) | First-timer confusion is the top churn signal; 3-step guided setup converts Jordan | `activationRate7d` (first `attendance.marked` / attendance record within 7 days of signup) | `users`, `attendance_records` + `attendance.marked` events |
| **C3** Bilingual parity | Arabic-only-emotional-screen fix first, then audit hardcoded EN | `arLocaleCompletionRate` (AR-locale sessions that reach a completion event) | `analytics_events(name='locale.set', locale='ar')` + completion events |
| **C4** Bulk/undo for attendance + students | Alex/power-user retention | `actionsPerSession` | `batch.actionCount` on `app_sessions` |

## Metrics endpoint

`GET /api/analytics/metrics` — requires `super_admin`. Returns, for rolling windows:

```
generatedAt
windowDays                        # 30
sessions30d
activeUsers30d
avgSessionLengthSec               # C1
actionsPerSession                 # C4
settingsTaskCompletions30d        # C1
settingsTaskCompletionsPrior30d   # C1 (the prior 30 days)
settingsCompletionDelta           # C1 = 30d − prior30d
recruits90d                       # C2 (users created in last 90 days)
activatedRecruits                 # C2 (first attendance ≤7d after signup)
activationRate7d                  # C2 (0–1)
arSessions30d                     # C3 (distinct AR-locale sessions)
arCompletedSessions30d            # C3 (AR sessions that hit a completion event)
arLocaleCompletionRate            # C3 (0–1)
```

## Event taxonomy

**Categories:** `session`, `activation`, `locale`, `task`, `action`.

| name | category | emitted from | notes |
|------|----------|--------------|-------|
| `session.start` | session | client tracker | begins a session |
| `session.end` | session | client tracker | ends it; server measures duration from real start |
| `locale.set` | locale | dashboard + portal language toggle | carries `locale` prop |
| `settings.task_completed` | task | settings tabs (groups, grades, subjects) | carries `tab`, `action` |
| `attendance.marked` | action (client) / activation (server) | attendance-client + attendance.service | server copy counts toward activation + AR completion |
| `onboarding.start` / `onboarding.completed` | activation | "Start Class" flow | C2 funnel |
| `student.created` | action | students.service | |
| `bulk.action` | action | students bulk modals + students.service bulk import/delete | carries `action`, `count` |

**Actions-per-session** is the sum of category-`action` events the client sends
per session (`batch.actionCount`), stored on `app_sessions.action_count`.

## Client tracking model

- One `app_session` per browser tab (keyed by a `sessionStorage` uuid).
- Heartbeat every 60s (visible tabs only) keeps `last_active_at` fresh.
- Events are buffered client-side and flushed every ~5s via a `keepalive`
  fetch; the session is ended on `pagehide`/tab-hide.

## Layout of the analytics module

```
backend/src/modules/analytics/
  analytics.module.ts
  analytics.controller.ts     # POST /api/analytics/events  (public, throttled)
                              # GET  /api/analytics/metrics (super_admin)
  analytics.service.ts        # record(), recordBatch(), getMetrics()
  dto/analytics-batch.dto.ts

backend/prisma/schema.prisma  # AnalyticsEvent, AppSession
backend/prisma/migrations/20260804000000_add_analytics/migration.sql

frontend/src/lib/analytics.ts # startAnalytics/track/endAnalytics
frontend/src/components/providers.tsx  # wires session lifecycle
```

## Operationalizing

- Apply the migration on deploy: `npm run migrate:prod` (`prisma migrate deploy`).
- Ship `SENTRY_DSN`? Not required — Sentry is orthogonal (B1).
- Add a simple internal dashboard or query the metrics endpoint periodically.
- The metrics endpoint reads only existing tables, so `activationRate7d` and
  `avgSessionLengthSec` are populated from day one even before events arrive.