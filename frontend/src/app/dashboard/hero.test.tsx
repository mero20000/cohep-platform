import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import DashboardHero from './hero'
import { useLanguage } from '@/lib/use-language'

vi.mock('motion/react', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  const DomDiv = ({ children, style }: any) => React.createElement('div', { 'data-motion': '', style }, children)
  return {
    motion: { div: DomDiv },
    useScroll: () => ({ scrollY: { get: () => 0 } }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: (v: any) => v,
    useReducedMotion: () => true,
  }
})

vi.mock('lucide-react', () => ({
  Sun: (p: any) => <span data-testid="icon-sun" {...p} />,
}))

vi.mock('@/lib/use-language', () => ({ useLanguage: vi.fn(() => 'en') }))

vi.mock('@/lib/datetime', () => ({
  getGreeting: () => 'Good morning',
  getGreetingAr: () => 'صباح الخير',
}))

describe('DashboardHero', () => {
  it('renders title, logos, badges and children', () => {
    render(
      <DashboardHero
        bg="var(--hymn-green)"
        title="My School"
        greeting={<span>Hi there</span>}
        badges={<span data-testid="badge">Badge</span>}
        logos={<span data-testid="logo">Logo</span>}
      >
        <div data-testid="stats">stat grid</div>
      </DashboardHero>,
    )
    expect(screen.getByRole('heading', { name: 'My School' })).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByTestId('logo')).toBeInTheDocument()
    expect(screen.getByTestId('stats')).toBeInTheDocument()
  })

  it('renders a default greeting with the Sun icon when no greeting prop is given', () => {
    render(<DashboardHero bg="var(--hymn-navy)" title="Platform" />)
    expect(screen.getByText('Good morning')).toBeInTheDocument()
    expect(screen.getByTestId('icon-sun')).toBeInTheDocument()
  })

  it('renders the Arabic default greeting when the language is ar', () => {
    vi.mocked(useLanguage).mockReturnValue('ar')
    render(<DashboardHero bg="var(--hymn-navy)" title="منصة" />)
    expect(screen.getByText('صباح الخير')).toBeInTheDocument()
  })
})
