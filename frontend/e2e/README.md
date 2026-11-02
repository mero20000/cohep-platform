# Mobile e2e

Playwright runs the real app in phone-sized Chromium (390×844 and 360×740), once per role (super admin,
admin, servant, parent) plus the student portal, in English and Arabic (RTL).

The API is **mocked in the browser** (`support/mock-api.ts`), so no backend or database is needed. Sessions are
set through `localStorage`, the same way the app stores them.

```bash
cd frontend
npx playwright test                 # dev server, fastest to iterate
E2E_PROD=1 npx playwright test      # production build, what CI runs
PW_CHROMIUM_PATH=/path/to/chrome npx playwright test   # use an already-installed Chromium
```

## What it checks
- No sideways scroll on any screen.
- Bottom nav and header controls are at least 44px; the "More" menu opens the full menu.
- The closed menu drawer is fully off-screen in both directions (LTR and RTL).
- The attendance Save bar stays visible above the bottom nav while scrolling, and nothing covers it, including the Help button.
- The Help button is on the correct side in RTL.
- No uncaught runtime errors (a crashing card fails the test).

Screenshots are written to `e2e/screenshots/<project>/` (git-ignored) and uploaded by CI as the
`mobile-screenshots` artifact.

## Adding a page
Add its endpoints to `support/mock-api.ts`. Endpoints without a handler answer `{}` and are listed as
`unmocked endpoints` in the test annotations, so a missing mock shows up instead of passing silently.

## Accessibility gate (`mobile/a11y.e2e.ts`)
Runs axe-core (WCAG 2.0/2.1 A and AA) on each role's key screens, in English and Arabic. It fails when a
screen has **more** serious or critical violations of a rule than `a11y-baseline.json` allows. The baseline is
currently empty, which is the strictest setting. If you must accept existing debt, add it there
(`"en:admin:students": { "color-contrast": 3 }`) and say why in the PR; the test tells you when a count
drops so you can lower it. Moderate and minor findings are listed in the test annotations but not gated.

```bash
npm run test:a11y
```

## Lighthouse (`../lighthouserc.cjs`)
Performance, accessibility, best-practices and SEO for the public pages on a production build, using
Lighthouse's mobile profile (3 runs per page, median). Signed-in screens are not covered by Lighthouse
(they need a session); the Playwright suite covers those.

```bash
npm run build && npm run lighthouse
CHROME_PATH=/path/to/chrome npm run lighthouse     # use an installed Chromium
```

`src/lib/public-assets.test.ts` is the cheap companion: it caps image sizes in `public/`, because one
oversized logo was enough to push LCP past 11 s.
