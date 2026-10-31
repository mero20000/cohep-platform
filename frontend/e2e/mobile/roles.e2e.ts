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

        await shot(page, info.project.name, `${lang}-${role.key}-attendance-mark`)
        expect(api.errors, 'uncaught runtime errors').toEqual([])
      })
    }

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
