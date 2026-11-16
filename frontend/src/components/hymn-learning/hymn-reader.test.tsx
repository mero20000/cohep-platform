import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HymnReader, looksLikeFileUrl, readerShowsWords, resolveReaderContent } from './hymn-reader'

// pdf.js needs a real canvas/worker; the PDF path is covered by the browser check.
vi.mock('./score-pdf', () => ({ default: ({ src }: { src: string }) => <div data-testid="pdf" data-src={src} /> }))

const verses = [{ cop: 'Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ', en: 'Alleluia', ar: 'هللويا' }]

describe('HymnReader', () => {
  it('renders nothing when there is nothing to read', () => {
    const { container } = render(<HymnReader source={{}} lang="en" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows verses with a language filter', () => {
    render(<HymnReader source={{ presentationData: { verses } }} lang="en" />)
    expect(screen.getByText('Alleluia')).toBeTruthy()
    expect(screen.getByText('هللويا')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByText('Alleluia')).toBeTruthy()
    expect(screen.queryByText('هللويا')).toBeNull()
  })

  it('falls back to plain memorization text when there are no verses', () => {
    render(<HymnReader source={{ requiredMemorization: 'Line one\nLine two' }} lang="en" />)
    expect(screen.getByText(/Line one/)).toBeTruthy()
  })

  it('offers Words, Hazzat and Score tabs and switches between them', () => {
    render(<HymnReader source={{ presentationData: { verses }, hazzat: 'xyz', hazzatFileUrl: 'https://cdn.example.com/s.png' }} lang="en" />)
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Words', 'Hazzat', 'Score'])
    fireEvent.click(screen.getByRole('tab', { name: 'Hazzat' }))
    expect(screen.getByText('xyz').className).toContain('hazzat-text')
    fireEvent.click(screen.getByRole('tab', { name: 'Score' }))
    expect((screen.getByAltText('Hazzat score') as HTMLImageElement).src).toContain('s.png')
  })

  it('renders a PDF score through the in-page viewer, not a link', async () => {
    render(<HymnReader source={{ hazzatFileUrl: 'https://cdn.example.com/s.pdf?x=1' }} lang="en" />)
    expect((await screen.findByTestId('pdf')).getAttribute('data-src')).toContain('s.pdf')
  })

  it('treats a legacy hazzat URL as a score file, not as text', () => {
    expect(looksLikeFileUrl('https://x.test/a.pdf')).toBe(true)
    expect(looksLikeFileUrl('/uploads/audio/a.png')).toBe(true)
    expect(looksLikeFileUrl('ⲁⲃⲅ some text')).toBe(false)
    const c = resolveReaderContent({ hazzat: 'https://x.test/a.pdf' }, 'en')
    expect(c.fileUrl).toBe('https://x.test/a.pdf')
    expect(c.hazzatText).toBe('')
  })

  it('collapses and expands, and stays sticky', () => {
    render(<HymnReader source={{ hazzat: 'abc' }} lang="en" />)
    expect(screen.getByRole('region', { name: 'Hymn text' }).className).toContain('sticky')
    fireEvent.click(screen.getByRole('button', { name: 'Hide text' }))
    expect(screen.queryByText('abc')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show text' }))
    expect(screen.getByText('abc')).toBeTruthy()
  })

  it('readerShowsWords tells callers whether to hide their own copy', () => {
    expect(readerShowsWords({ presentationData: { verses } }, 'en')).toBe(true)
    expect(readerShowsWords({ requiredMemorizationAr: 'x' }, 'ar')).toBe(true)
    expect(readerShowsWords({ hazzat: 'only hazzat' }, 'en')).toBe(false)
  })
})

describe('HymnReader fonts and encoding', () => {
  it('shows Coptic verses with the same class as the Coptic name, converting raw CS keystrokes', () => {
    render(<HymnReader source={{ presentationData: { verses: [{ cop: 'ouo`w', en: '' }] } }} lang="en" />)
    const el = screen.getByText('ⲟⲩⲟ`ⲱ')
    expect(el.className).toContain('coptic-text')
  })

  it('leaves text that is already Unicode Coptic untouched', () => {
    render(<HymnReader source={{ presentationData: { verses: [{ cop: 'Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ' }] } }} lang="en" />)
    expect(screen.getByText('Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ').className).toContain('coptic-text')
  })

  it('shows hazzat exactly as stored: no conversion, spacing and line breaks kept, no re-wrap', () => {
    const raw = 'K `= cua_=.== pwoY__\n= lH_= = .= qw_=.'
    render(<HymnReader source={{ hazzat: raw }} lang="en" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Hazzat' }))
    const el = screen.getByText((_, n) => n?.textContent === raw && n.className.includes('hazzat-text'))
    expect(el.className).toContain('whitespace-pre')
    expect(el.className).not.toContain('whitespace-pre-wrap')
    expect(el.className).not.toContain('text-center')
  })
})
