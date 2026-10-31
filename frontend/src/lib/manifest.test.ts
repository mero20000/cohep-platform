import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC = join(process.cwd(), 'public')
const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.json'), 'utf-8'))
const onDisk = (src: string) => existsSync(join(PUBLIC, src))

describe('web app manifest (public/manifest.json)', () => {
  it('has a stable id inside its scope', () => {
    expect(manifest.id).toBe('/')
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true)
  })

  it('has installable icons including a maskable one, all present on disk', () => {
    const sizes = manifest.icons.map((i: any) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i: any) => i.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) expect(onDisk(icon.src), icon.src).toBe(true)
  })

  it('offers at most 4 shortcuts (Android shows 4), each in scope with an icon on disk', () => {
    expect(manifest.shortcuts.length).toBeGreaterThan(0)
    expect(manifest.shortcuts.length).toBeLessThanOrEqual(4)
    for (const s of manifest.shortcuts) {
      expect(s.name, 'shortcut name').toBeTruthy()
      expect(s.url.startsWith('/'), s.url).toBe(true)
      for (const icon of s.icons ?? []) expect(onDisk(icon.src), icon.src).toBe(true)
    }
  })

  it('declares screenshots that exist, with the size the manifest claims', () => {
    expect(manifest.screenshots.length).toBeGreaterThan(0)
    for (const shot of manifest.screenshots) {
      expect(onDisk(shot.src), shot.src).toBe(true)
      // PNG header: width and height are big-endian u32 at bytes 16 and 20.
      const buf = readFileSync(join(PUBLIC, shot.src))
      expect(`${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`, shot.src).toBe(shot.sizes)
      expect(shot.form_factor).toMatch(/^(narrow|wide)$/)
    }
  })

  it('lets the browser pick text direction so Arabic names render correctly', () => {
    expect(manifest.dir).toBe('auto')
  })
})
