import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT || 3100)
const BASE_URL = `http://localhost:${PORT}`

// Phone-sized Chromium. WebKit would be closer to iOS, but Chromium keeps CI to one browser;
// the checks here (layout, overlap, tap-target size, overflow) don't depend on the engine.
const phone = (width: number, height: number) => ({
  viewport: { width, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './e2e/.results',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'e2e/.report' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // Optional: point at an already-installed Chromium instead of the one Playwright downloads.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] }
      : {},
  },
  projects: [
    { name: 'phone-390', use: phone(390, 844) },
    { name: 'phone-360', use: phone(360, 740) },
  ],
  webServer: {
    // The API is mocked in the browser (see e2e/support/mock-api.ts); this URL only has to be same-origin
    // so the mock sees every request.
    // CI (E2E_PROD=1) tests the production build, as Vercel serves it; locally the dev server is quicker.
    command: process.env.E2E_PROD ? `npm run build && npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 420_000,
    env: { NEXT_PUBLIC_API_URL: `${BASE_URL}/api`, NEXT_TELEMETRY_DISABLED: '1' },
  },
})
