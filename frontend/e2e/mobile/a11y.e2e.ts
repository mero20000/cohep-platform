import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROLES, STUDENT_CODE, type RoleKey } from '../support/roles'
import { mockApi } from '../support/mock-api'

/**
 * Accessibility gate (axe-core, WCAG 2.0/2.1 A + AA).
 *
 * Fails when a screen has MORE serious or critical violations of a rule than e2e/a11y-baseline.json
 * allows, or a rule that is not in the baseline at all. Existing debt is listed there so it does not
 * block unrelated work, but nothing new gets in. When you fix something, lower the number (the test
 * tells you when a count has dropped). Moderate and minor findings are reported, not gated.
 */

type Baseline = Record<string, Record<string, number>>
const baseline: Baseline = JSON.parse(readFileSync(join(__dirname, '..', 'a11y-baseline.json'), 'utf-8'))

const GATED = new Set(['serious', 'critical'])
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

interface Screen { role: RoleKey | 'student'; path: string; name: string; /** Extra steps after load, e.g. open a tab. */ open?: (page: Page, lang: 'en' | 'ar') => Promise<void> }

const SCREENS: Screen[] = [
  { role: 'super_admin', path: '/dashboard', name: 'home' },
  { role: 'admin', path: '/dashboard', name: 'home' },
  { role: 'servant', path: '/dashboard', name: 'home' },
  { role: 'parent', path: '/dashboard', name: 'home' },
  { role: 'servant', path: '/dashboard/attendance/mark?sessionId=sess-1', name: 'attendance-mark' },
  { role: 'admin', path: '/dashboard/students', name: 'students' },
  { role: 'admin', path: '/dashboard/settings', name: 'settings' },
  { role: 'admin', path: '/dashboard/reports', name: 'reports' },
  { role: 'admin', path: '/dashboard/students?engagement=at_risk', name: 'students-at-risk' },
  {
    role: 'admin', path: '/dashboard/reports', name: 'reports-levels',
    open: async (page, lang) => { await page.getByRole('button', { name: lang === 'ar' ? /المراحل والمجموعات/ : /Levels & Groups/ }).click(); await page.getByRole('list').last().waitFor() },
  },
  {
    role: 'admin', path: '/dashboard/reports', name: 'reports-quality',
    open: async (page, lang) => { await page.getByRole('button', { name: lang === 'ar' ? /جودة البيانات/ : /Data Quality/ }).click(); await page.getByRole('list', { name: lang === 'ar' ? 'التفاصيل الناقصة' : 'Missing details' }).waitFor() },
  },
  { role: 'admin', path: '/dashboard/students?dataGap=photo', name: 'students-data-gap' },
  { role: 'student', path: '/student-portal/login', name: 'login' },
  { role: 'student', path: `/student-portal/${STUDENT_CODE}`, name: 'dashboard' },
]

async function settle(page: Page) {
  await page.waitForLoadState('load')
  await page.waitForTimeout(1500)
}

for (const lang of ['en', 'ar'] as const) {
  test.describe(`a11y · ${lang}`, () => {
    test.beforeEach(({}, info) => {
      // Rules are viewport-independent; one phone size keeps the run short.
      test.skip(info.project.name !== 'phone-390', 'axe runs once, at 390px')
    })

    for (const screen of SCREENS) {
      const key = `${lang}:${screen.role}:${screen.name}`
      test(key, async ({ page }, info) => {
        await page.addInitScript((l) => localStorage.setItem('niangelos_language', l), lang)
        await mockApi(page, ROLES.find((r) => r.key === (screen.role === 'student' ? 'servant' : screen.role))!)
        await page.goto(screen.path)
        await settle(page)
        if (screen.open) { await screen.open(page, lang); await settle(page) }

        const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()

        const current: Record<string, number> = {}
        for (const v of result.violations) {
          if (v.impact && GATED.has(v.impact)) current[v.id] = v.nodes.length
        }
        const allowed = baseline[key] ?? {}

        const regressions = Object.entries(current)
          .filter(([rule, count]) => count > (allowed[rule] ?? 0))
          .map(([rule, count]) => {
            const v = result.violations.find((x) => x.id === rule)!
            const where = v.nodes.slice(0, 3).map((n) => `    ${n.html.replace(/\s+/g, ' ').slice(0, 120)}`).join('\n')
            return `${rule} (${v.impact}): ${count} found, baseline allows ${allowed[rule] ?? 0}\n  ${v.help}\n${where}`
          })

        const improved = Object.entries(allowed).filter(([rule, n]) => (current[rule] ?? 0) < n).map(([rule]) => rule)
        if (improved.length) {
          info.annotations.push({ type: 'a11y improved', description: `${key}: lower the baseline for ${improved.join(', ')}` })
        }
        const ungated = result.violations.filter((v) => !v.impact || !GATED.has(v.impact))
        if (ungated.length) {
          info.annotations.push({ type: 'a11y (not gated)', description: ungated.map((v) => `${v.id} x${v.nodes.length}`).join(', ') })
        }

        expect(regressions, `New accessibility violations on ${key}:\n${regressions.join('\n')}`).toEqual([])
      })
    }
  })
}
