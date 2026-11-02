import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudentAvatar, initialsOf } from '../student-avatar'

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Mina Girgis')).toBe('MG')
    expect(initialsOf('Mary Ann Smith')).toBe('MA')
    expect(initialsOf('mina')).toBe('M')
  })

  it('handles Arabic names and stray whitespace', () => {
    expect(initialsOf('  مينا   جرجس ')).toBe('مج')
  })

  it('never returns an empty string', () => {
    expect(initialsOf('')).toBe('?')
    expect(initialsOf('   ')).toBe('?')
  })
})

describe('StudentAvatar', () => {
  it('shows initials when the student has no photo', () => {
    render(<StudentAvatar name="Mina Girgis" photoUrl={null} />)
    expect(screen.getByTestId('student-avatar')).toHaveTextContent('MG')
    expect(document.querySelector('img')).toBeNull()
  })

  it('shows the photo, lazily loaded and sized to avoid layout shift', () => {
    render(<StudentAvatar name="Mina Girgis" photoUrl="https://cdn.example.com/a.jpg" size={36} />)
    const img = document.querySelector('img')!
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/a.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('width', '36')
    expect(img).toHaveAttribute('height', '36')
  })

  it('falls back to initials when the photo fails to load', () => {
    render(<StudentAvatar name="Mina Girgis" photoUrl="https://cdn.example.com/missing.jpg" />)
    fireEvent.error(document.querySelector('img')!)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByTestId('student-avatar')).toHaveTextContent('MG')
  })

  it('tries again when the photo changes after a failure', () => {
    const { rerender } = render(<StudentAvatar name="Mina Girgis" photoUrl="https://cdn.example.com/missing.jpg" />)
    fireEvent.error(document.querySelector('img')!)
    expect(document.querySelector('img')).toBeNull()
    rerender(<StudentAvatar name="Marina Samir" photoUrl="https://cdn.example.com/other.jpg" />)
    expect(document.querySelector('img')).not.toBeNull()
  })

  it('is hidden from assistive technology (the name is always shown beside it)', () => {
    render(<StudentAvatar name="Mina Girgis" photoUrl="https://cdn.example.com/a.jpg" />)
    expect(screen.getByTestId('student-avatar')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('gives the same student the same colour every time', () => {
    const { unmount } = render(<StudentAvatar name="Mina Girgis" />)
    const first = screen.getByTestId('student-avatar').className
    unmount()
    render(<StudentAvatar name="Mina Girgis" />)
    expect(screen.getByTestId('student-avatar').className).toBe(first)
  })
})
