import { test, expect, type Page } from '@playwright/test'
import { ROLES, STUDENT_CODE } from '../support/roles'
import { mockApi, type MockApi } from '../support/mock-api'

/**
 * Mobile checks for every role. Each test both asserts layout rules that previously broke on
 * phones and saves a screenshot to e2e/screenshots/<project>/ for review.
 */

const TAP_MIN = 44

// Animations are fast-forwarded and carets hidden so the same screen gives the same pixels run to run
// (a menu caught mid-slide made screenshot comparisons useless).
const shot = (page: Page, project: string, name: string) =>
  page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: false, animations: 'disabled', caret: 'hide' })

/** The page must never scroll sideways. */
async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth, 'document scrolls horizontally').toBeLessThanOrEqual(innerWidth + 1)
}

async function setLanguage(page: Page, lang: 'en' | 'ar') {
  await page.addInitScript((l) => localStorage.setItem('niangelos_language', l), lang)
}

async function openDashboard(page: Page, path = '/dashboard') {
  await page.goto(path)
  await page.getByRole('navigation', { name: /bottom navigation|التنقل السفلي/i }).waitFor()
}

for (const lang of ['en', 'ar'] as const) {
  test.describe(`mobile · ${lang}`, () => {
    for (const role of ROLES) {
      test.describe(role.label, () => {
        let api: MockApi
        test.beforeEach(async ({ page }) => {
          await setLanguage(page, lang)
          api = await mockApi(page, role)
        })
        test.afterEach(() => {
          if (api.unhandled.length) {
            test.info().annotations.push({ type: 'unmocked endpoints', description: [...new Set(api.unhandled)].join(', ') })
          }
          expect(api.errors, 'uncaught runtime errors').toEqual([])
        })

        test('home renders without sideways scroll', async ({ page }, info) => {
          await openDashboard(page)
          await page.waitForLoadState('networkidle')
          await expectNoHorizontalOverflow(page)

          // The closed menu drawer must be entirely off-screen. It used to stay partly visible in
          // Arabic because globals.css mirrors `.right-0` under [dir=rtl].
          const drawer = (await page.locator('aside').first().boundingBox())!
          const vw = page.viewportSize()!.width
          expect(drawer.x >= vw || drawer.x + drawer.width <= 0, `closed drawer on screen (x=${drawer.x}, w=${drawer.width})`).toBe(true)

          await shot(page, info.project.name, `${lang}-${role.key}-home`)
        })

        test('bottom nav: tap targets, badge and More menu', async ({ page }, info) => {
          await openDashboard(page)
          const nav = page.getByRole('navigation', { name: /bottom navigation|التنقل السفلي/i })

          const items = nav.locator('a, button')
          const count = await items.count()
          expect(count).toBeGreaterThan(0)
          expect(count).toBeLessThanOrEqual(5)
          for (let i = 0; i < count; i++) {
            const box = await items.nth(i).boundingBox()
            expect(box!.height, `bottom-nav item ${i} height`).toBeGreaterThanOrEqual(TAP_MIN)
            expect(box!.width, `bottom-nav item ${i} width`).toBeGreaterThanOrEqual(TAP_MIN)
          }

          // Header controls are the other everyday tap targets.
          const menu = page.getByRole('button', { name: /open menu|فتح القائمة/i })
          if (await menu.count()) {
            const box = await menu.boundingBox()
            expect(box!.height).toBeGreaterThanOrEqual(TAP_MIN)
            expect(box!.width).toBeGreaterThanOrEqual(TAP_MIN)
          }

          const more = nav.getByRole('button', { name: /more|المزيد/i })
          if (await more.count()) {
            await more.click()
            await expect(page.getByRole('navigation', { name: /main navigation|القائمة الرئيسية/i })).toBeVisible()
            await shot(page, info.project.name, `${lang}-${role.key}-more-menu`)
          }
        })

        test('help button clears the bottom nav and sits on the end side', async ({ page }) => {
          await openDashboard(page)
          const help = await page.locator('#help-button').boundingBox()
          const navBox = await page.getByRole('navigation', { name: /bottom navigation|التنقل السفلي/i }).boundingBox()
          expect(help!.y + help!.height, 'help button overlaps the nav').toBeLessThanOrEqual(navBox!.y)
          const vw = page.viewportSize()!.width
          const center = help!.x + help!.width / 2
          if (lang === 'ar') expect(center, 'RTL: help button on the left').toBeLessThan(vw / 2)
          else expect(center, 'LTR: help button on the right').toBeGreaterThan(vw / 2)
        })
      })
    }

    // Marking attendance is the servant's weekly job; this is the screen the Save-bar bug was on.
    for (const role of ROLES.filter((r) => r.key !== 'parent')) {
      test(`${role.label}: attendance Save bar is reachable above the bottom nav`, async ({ page }, info) => {
        await setLanguage(page, lang)
        const api = await mockApi(page, role)
        await page.goto('/dashboard/attendance/mark?sessionId=sess-1')
        await expect(page.locator('[data-student-id]').first()).toBeVisible()
        await expectNoHorizontalOverflow(page)

        // Scroll to the middle of the list, where the sticky bar used to slide under the nav.
        await page.evaluate(() => window.scrollTo(0, 1500))
        await page.waitForTimeout(300)

        const save = page.getByRole('button', { name: /^(save|حفظ)$/i })
        await expect(save).toBeVisible()
        const box = (await save.boundingBox())!
        expect(box.height).toBeGreaterThanOrEqual(TAP_MIN)

        const nav = (await page.getByRole('navigation', { name: /bottom navigation|التنقل السفلي/i }).boundingBox())!
        expect(box.y + box.height, 'Save button is covered by the bottom nav').toBeLessThanOrEqual(nav.y)

        // Hit-test the centre of the button: it must be what the user would actually tap.
        const reachable = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y)
          return !!el?.closest('button')?.textContent?.match(/^(save|حفظ)$/i)
        }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
        expect(reachable, 'Save button centre is not the topmost element').toBe(true)

        // The floating Help button must not sit on top of either action button.
        const help = (await page.locator('#help-button').boundingBox())!
        const finalize = (await page.getByRole('button', { name: /save & finalize|حفظ وإنهاء/i }).boundingBox())!
        const overlaps = (a: typeof help, b: typeof help) =>
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        expect(overlaps(help, finalize), 'Help button overlaps "Save & Finalize"').toBe(false)
        expect(overlaps(help, box), 'Help button overlaps "Save"').toBe(false)

        // Student photos: a real photo where one exists, initials where there is none or it fails to load.
        const rows = page.locator('[data-student-id]')
        // Count photos that actually loaded (an <img> that is still loading or has failed does not count).
        const loadedPhotos = () => page.evaluate(() =>
          [...document.querySelectorAll('[data-testid="student-avatar"] img')].filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length)
        await expect.poll(loadedPhotos, { message: 'students with a working photo show it' }).toBeGreaterThan(0)
        await expect(rows.first().locator('[data-testid="student-avatar"]')).toBeVisible()
        // Every avatar reserves its space (no layout jump when a photo arrives) and is not announced twice.
        const avatar = rows.first().locator('[data-testid="student-avatar"]')
        const avatarBox = (await avatar.boundingBox())!
        expect(avatarBox.width).toBe(36)
        expect(avatarBox.height).toBe(36)
        await expect(avatar).toHaveAttribute('aria-hidden', 'true')
        // A photo that 404s must end up as initials, not a broken-image icon.
        await expect.poll(async () => page.evaluate(() =>
          [...document.querySelectorAll('[data-testid="student-avatar"] img')].filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0).length,
        ), { message: 'no broken-image icons left on screen' }).toBe(0)

        await shot(page, info.project.name, `${lang}-${role.key}-attendance-mark`)
        expect(api.errors, 'uncaught runtime errors').toEqual([])
      })
    }

    test('Admin: recent grades show the student photo, or initials when there is none', async ({ page }) => {
      await setLanguage(page, lang)
      await mockApi(page, ROLES.find((r) => r.key === 'admin')!)
      await openDashboard(page)
      const avatarBeside = (name: string) =>
        page.getByText(name, { exact: true }).locator('visible=true').first().locator('xpath=preceding-sibling::*[@data-testid="student-avatar"]')

      const withPhoto = avatarBeside('Mina Girgis')
      await withPhoto.scrollIntoViewIfNeeded()
      await expect.poll(() => withPhoto.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), {
        message: 'a graded student with a photo shows it',
      }).toBe(true)

      const noPhoto = avatarBeside('Marina Samir')
      await expect(noPhoto).toHaveText('MS')
      await expect(noPhoto.locator('img')).toHaveCount(0)
    })

    test.describe('KPI headline numbers', () => {
      const admin = () => ROLES.find((r) => r.key === 'admin')!
      const tile = (page: Page, name: RegExp) => page.getByRole('listitem').filter({ hasText: name })

      test('Admin: attendance is the last 7 days with the change from the previous 7', async ({ page }) => {
        await setLanguage(page, lang)
        await mockApi(page, admin())
        await openDashboard(page)

        const attendance = tile(page, /Attendance · 7 days|الحضور · 7 أيام/)
        await expect(attendance).toContainText('82%')
        // 82% now vs 78% before: +4 points, stated as a change, not as a bare number.
        await expect(attendance).toContainText(lang === 'ar' ? '▲ 4 عن الأسبوع السابق' : '▲ 4 vs previous 7 days')
      })

      test('Admin: a week with no class shows a dash, never 0%', async ({ page }) => {
        await setLanguage(page, lang)
        await mockApi(page, admin(), {
          stats: {
            attendanceRate: null, attendancePrevRate: null,
            attendanceTrend: Array.from({ length: 8 }, (_, i) => ({ weekStart: `2026-09-${String(6 + i).padStart(2, '0')}`, rate: null, decided: 0 })),
          },
        })
        await openDashboard(page)

        const attendance = tile(page, /Attendance · 7 days|الحضور · 7 أيام/)
        await expect(attendance).toContainText('—')
        await expect(attendance).toContainText(lang === 'ar' ? 'لا حصص هذا الأسبوع' : 'No class this week')
        await expect(attendance).not.toContainText('0%')
        // The trend card says so too, instead of drawing empty bars.
        await expect(page.getByText(lang === 'ar' ? 'لم يُسجَّل حضور في آخر 8 أسابيع' : 'No attendance recorded in the last 8 weeks')).toBeVisible()
      })

      test('Admin: the at-risk tile opens exactly the students it counts, and can be cleared', async ({ page }) => {
        await setLanguage(page, lang)
        const api = await mockApi(page, admin())
        await openDashboard(page)

        const atRisk = page.getByRole('link', { name: /At risk|في خطر/ })
        // A real link whose accessible name carries the number, so it is announced as "At risk: 3. Missed 3+ in a row".
        await expect(atRisk).toHaveAttribute('aria-label', /3/)
        await expect(atRisk).toHaveAttribute('href', '/dashboard/students?engagement=at_risk')

        const narrowed = page.waitForRequest((r) => r.url().includes('/api/students?') && r.url().includes('engagementStatus=at_risk'))
        await atRisk.click()
        await narrowed
        const banner = page.getByRole('status').filter({ hasText: lang === 'ar' ? 'طلاب في خطر' : 'Students at risk' })
        await expect(banner).toBeVisible()

        // Clearing returns to the whole school, and the request no longer carries the filter.
        const widened = page.waitForRequest((r) => r.url().includes('/api/students?') && !r.url().includes('engagementStatus'))
        await banner.getByRole('button', { name: lang === 'ar' ? 'عرض كل الطلاب' : 'Show all students' }).click()
        await widened
        await expect(banner).toHaveCount(0)
        expect(api.errors, 'uncaught runtime errors').toEqual([])
      })

      test('Admin: the trend chart shows rates, with the latest week called out', async ({ page }, info) => {
        await setLanguage(page, lang)
        await mockApi(page, admin())
        await openDashboard(page)

        const chart = page.getByRole('img', { name: lang === 'ar' ? /نسبة الحضور لآخر 8 أسابيع/ : /Attendance rate for the last 8 weeks/ })
        await chart.scrollIntoViewIfNeeded()
        await expect(chart).toBeVisible()
        await expect(chart).toHaveAttribute('aria-label', lang === 'ar' ? /82٪/ : /82%/)
        await shot(page, info.project.name, `${lang}-admin-attendance-trend`)
      })

      test('Reports: the school health score shows its working', async ({ page }, info) => {
        await setLanguage(page, lang)
        await mockApi(page, admin())
        await page.goto('/dashboard/reports')
        await expect(page.getByText('77', { exact: true }).first()).toBeVisible()

        await page.getByText(lang === 'ar' ? 'كيف تُحسب؟' : 'How is this calculated?').click()
        const breakdown = page.locator('details li')
        await expect(breakdown).toHaveCount(5) // four components and the explanation
        await expect(breakdown.nth(0)).toContainText('41/50')
        await expect(breakdown.nth(2)).toContainText('8/20')
        await shot(page, info.project.name, `${lang}-admin-health-breakdown`)

        // The at-risk card opens the list it counts.
        const card = page.getByRole('link', { name: lang === 'ar' ? /طلاب في خطر/ : /Students At Risk/ })
        await expect(card).toHaveAttribute('href', '/dashboard/students?engagement=at_risk')
      })
    })

    test('Admin: a student opens from the list with the keyboard (the name is the button)', async ({ page }) => {
      await setLanguage(page, lang)
      await mockApi(page, ROLES.find((r) => r.key === 'admin')!)
      await page.goto('/dashboard/students')

      const name = page.getByRole('button', { name: 'Mina Girgis', exact: true }).first()
      await expect(name).toBeVisible()
      await name.focus()
      await expect(name).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog')).toBeVisible()
    })

    test('Parent: sees only Dashboard and My Children in the bottom nav', async ({ page }) => {
      await setLanguage(page, lang)
      await mockApi(page, ROLES.find((r) => r.key === 'parent')!)
      await openDashboard(page)
      const nav = page.getByRole('navigation', { name: /bottom navigation|التنقل السفلي/i })
      await expect(nav.getByRole('link')).toHaveCount(2)
      await expect(nav.getByRole('button')).toHaveCount(0)
    })

    test('Student portal: login and dashboard fit the phone', async ({ page }, info) => {
      await setLanguage(page, lang)
      await mockApi(page, ROLES[0])
      await page.goto('/student-portal/login')
      await page.waitForLoadState('networkidle')
      await expectNoHorizontalOverflow(page)
      await shot(page, info.project.name, `${lang}-student-login`)

      await page.goto(`/student-portal/${STUDENT_CODE}`)
      await page.waitForLoadState('networkidle')
      await expectNoHorizontalOverflow(page)

      for (const label of [/switch to (english|arabic)/i, /^menu$/i]) {
        const btn = page.getByRole('button', { name: label })
        if (await btn.count()) {
          const box = (await btn.first().boundingBox())!
          expect(box.height, `${label} height`).toBeGreaterThanOrEqual(TAP_MIN)
          expect(box.width, `${label} width`).toBeGreaterThanOrEqual(TAP_MIN)
        }
      }
      await shot(page, info.project.name, `${lang}-student-dashboard`)
    })
  })
}
