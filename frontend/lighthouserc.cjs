/**
 * Lighthouse CI: performance, accessibility, best practices and SEO for the public pages, measured on
 * the production build with Lighthouse's default mobile profile (slow 4G, 4x CPU throttle).
 *
 * Only public pages are covered: signed-in screens need a session, and those are exercised by the
 * Playwright suite instead. Scores on shared CI runners are noisy, so each page runs 3 times (median)
 * and the thresholds carry a margin below what the app scores today. Tighten them as the app improves.
 */
const PORT = process.env.LHCI_PORT || 3200

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx next start -p ${PORT}`,
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 60000,
      url: [`http://localhost:${PORT}/`, `http://localhost:${PORT}/auth/login`, `http://localhost:${PORT}/student-portal/login`],
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      // Thresholds sit a margin below today's medians (landing perf 0.66, login pages 0.81-0.83) because
      // shared CI runners vary by roughly +-0.1. Raise them as the app improves; never lower them to
      // make a failing run pass: find out what regressed.
      assertMatrix: [
        {
          matchingUrlPattern: '.*',
          assertions: {
            'categories:accessibility': ['error', { minScore: 0.9 }],
            'categories:best-practices': ['error', { minScore: 0.85 }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
            'largest-contentful-paint': ['warn', { maxNumericValue: 5000 }],
            'total-blocking-time': ['warn', { maxNumericValue: 600 }],
          },
        },
        { matchingUrlPattern: '^http://localhost:\\d+/$', assertions: { 'categories:performance': ['error', { minScore: 0.55 }] } },
        { matchingUrlPattern: '/(auth|student-portal)/login$', assertions: { 'categories:performance': ['error', { minScore: 0.7 }] } },
        // The student login is deliberately kept out of search (robots.ts disallows /student-portal), so
        // "blocked from indexing" there is correct and SEO is only asserted on the public pages.
        { matchingUrlPattern: '^http://localhost:\\d+/($|auth/)', assertions: { 'categories:seo': ['error', { minScore: 0.9 }] } },
      ],
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
}
