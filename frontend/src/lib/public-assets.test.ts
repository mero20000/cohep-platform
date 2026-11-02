import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Image weight budget for /public. cohep-logo.png was once a 1.5 MB, 1254px file shown at 56-120px and
 * precached by the service worker on first visit; it alone pushed the landing page's LCP to 11 s on a
 * slow phone. This fails the moment something like that comes back, without needing a Lighthouse run.
 */
const PUBLIC = join(process.cwd(), 'public')
const KB = 1024

// Anything shown on first load or precached must stay small.
const BUDGET_KB: Record<string, number> = { 'cohep-logo.png': 200 }
const DEFAULT_KB = 500 // everything else: install icons, manifest screenshots

function images(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'fonts' ? [] : images(full)
    return /\.(png|jpe?g|webp|gif)$/i.test(e.name) ? [full] : []
  })
}

describe('public image budget', () => {
  for (const file of images(PUBLIC)) {
    const rel = relative(PUBLIC, file)
    const budget = BUDGET_KB[rel] ?? DEFAULT_KB
    it(`${rel} stays under ${budget} KB`, () => {
      expect(statSync(file).size / KB).toBeLessThanOrEqual(budget)
    })
  }
})
