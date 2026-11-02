import { it, expect, describe } from 'vitest'
import { render } from '@testing-library/react'
import { BadgeIcon } from '../badge-icon'

describe('BadgeIcon', () => {
  it('renders an uploaded image for a path or URL', () => {
    const { container } = render(<BadgeIcon iconUrl="/uploads/b.png" apiOrigin="https://api.x" />)
    expect(decodeURIComponent(container.querySelector('img')?.getAttribute('src') ?? '')).toContain('https://api.x/uploads/b.png')
    const second = render(<BadgeIcon iconUrl="https://cdn.x/b.png" apiOrigin="https://api.x" />)
    expect(decodeURIComponent(second.container.querySelector('img')?.getAttribute('src') ?? '')).toContain('https://cdn.x/b.png')
  })

  it('renders an emoji for a symbolic name instead of crashing next/image', () => {
    const { container } = render(<BadgeIcon iconUrl="cake" apiOrigin="https://api.x" />)
    expect(container.textContent).toBe('🎂')
    expect(container.querySelector('img')).toBeNull()
  })

  it('falls back to a generic icon for an unknown name or no icon', () => {
    for (const iconUrl of ['mystery-name', '', null, undefined]) {
      const { container } = render(<BadgeIcon iconUrl={iconUrl} apiOrigin="https://api.x" />)
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('svg')).not.toBeNull()
    }
  })
})
