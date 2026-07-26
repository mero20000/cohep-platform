'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, Cross } from 'lucide-react'

interface HymnPresentationProps {
  htmlContent: string
  title: string
  titleCoptic?: string
  onExit: () => void
}

type SlideType = 'title' | 'english' | 'coptic' | 'arabic'

function classifySlide(html: string): SlideType {
  if (html.includes('title-slide')) return 'title'
  if (html.includes('arabic')) return 'arabic'
  if (html.includes('coptic')) return 'coptic'
  return 'english'
}

/** Extract <p> elements from an HTML string, returning their innerHTML */
function extractParagraphs(html: string): string[] {
  const parts: string[] = []
  const re = /<p[^>]*>([\s\S]*?)<\/p>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    parts.push(match[1].trim())
  }
  return parts
}

/** Extract the slide header text (People • pilaoc • الشعب) from HTML */
function extractHeader(html: string): string | null {
  const m = html.match(/<span[^>]*class="slide-header"[^>]*>([\s\S]*?)<\/span>/)
  if (m) return m[1].replace(/<[^>]+>/g, '').trim()
  const m2 = html.match(/<span[^>]*class="title-label"[^>]*>([\s\S]*?)<\/span>/)
  if (m2) return m2[1].replace(/<[^>]+>/g, '').trim()
  return null
}

/** Extract the Coptic hymn title */
function extractCopticTitle(html: string): string | null {
  const m = html.match(/<h1[^>]*class="hymn-title-coptic"[^>]*>([\s\S]*?)<\/h1>/)
  return m ? m[1].trim() : null
}

/** Extract the English subtitle from title slide */
function extractEnglishSub(html: string): string | null {
  const m = html.match(/<p[^>]*class="hymn-title-en"[^>]*>([\s\S]*?)<\/p>/)
  return m ? m[1].trim() : null
}

const BG = '#0a0a0a'

export function HymnPresentation({ htmlContent, title, titleCoptic, onExit }: HymnPresentationProps) {
  const rawSlides = htmlContent.split('<!-- slide -->').map(s => s.trim()).filter(Boolean)
  const slides = rawSlides.map(html => ({ html, type: classifySlide(html) }))

  const [current, setCurrent] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const touchX = useRef(0)
  const total = slides.length

  const goNext = useCallback(() => { if (current < total - 1) setCurrent(c => c + 1) }, [current, total])
  const goPrev = useCallback(() => { if (current > 0) setCurrent(c => c - 1) }, [current])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev() }
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, onExit])

  if (total === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: BG }}>
        <p className="text-white/40 text-xl">No content</p>
      </div>
    )
  }

  const s = slides[current]

  return (
    <div ref={ref} className="fixed inset-0 z-50 select-none" style={{ background: BG }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        const d = touchX.current - e.changedTouches[0].clientX
        if (Math.abs(d) > 50) { if (d > 0) goNext(); else goPrev() }
      }}
      onClick={e => {
        if (!ref.current) return
        const x = e.clientX / ref.current.offsetWidth
        if (x < 0.25) goPrev()
        else if (x > 0.75) goNext()
      }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(180,120,40,0.06) 0%, transparent 70%)' }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5">
        <button onClick={e => { e.stopPropagation(); onExit() }}
          className="text-white/25 hover:text-white/60 text-xs tracking-widest uppercase transition-colors">
          <X className="h-3 w-3 inline mr-1" /> Exit
        </button>
        <span className="text-white/20 text-sm tabular-nums">{current + 1} / {total}</span>
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex items-center justify-center px-6 md:px-16 lg:px-24" style={{ height: 'calc(100% - 9rem)' }}>
        <div key={current} className="w-full max-w-5xl mx-auto" style={{ animation: 'fadeSlideIn 0.35s ease-out' }}>
          {s.type === 'title' && <TitleSlide html={s.html} />}
          {s.type === 'english' && <VerseSlide html={s.html} lang="english" />}
          {s.type === 'coptic' && <VerseSlide html={s.html} lang="coptic" />}
          {s.type === 'arabic' && <VerseSlide html={s.html} lang="arabic" />}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <button onClick={e => { e.stopPropagation(); goPrev() }} disabled={current === 0}
          className="p-2.5 rounded-full transition-all disabled:opacity-0 hover:bg-white/5"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <ChevronLeft className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.3)' }} />
        </button>

        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i) }}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? '2.5rem' : '0.4rem',
                height: '0.4rem',
                background: i === current ? '#c9a030' : 'rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </div>

        <button onClick={e => { e.stopPropagation(); goNext() }} disabled={current === total - 1}
          className="p-2.5 rounded-full transition-all disabled:opacity-0 hover:bg-white/5"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <ChevronRight className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.3)' }} />
        </button>
      </div>

      <style>{`@keyframes fadeSlideIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

/* ─── Title Slide ─── */

function TitleSlide({ html }: { html: string }) {
  const copticTitle = extractCopticTitle(html)
  const enSub = extractEnglishSub(html)
  const header = extractHeader(html)

  return (
    <div className="text-center">
      {header && (
        <p style={{
          fontSize: 'clamp(0.7rem, 1.2vw, 1.25rem)',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          marginBottom: 'clamp(1.5rem, 4vh, 3.5rem)',
          fontWeight: 300,
        }}>
          {header}
        </p>
      )}
      {copticTitle && (
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 4.5rem)',
          fontWeight: 700,
          color: '#c9a030',
          lineHeight: 1.3,
          marginBottom: 'clamp(0.8rem, 2vh, 1.5rem)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          textShadow: '0 2px 20px rgba(0,0,0,0.5)',
        }}>
          {copticTitle}
        </h1>
      )}
      {enSub && (
        <p style={{
          fontSize: 'clamp(0.9rem, 2vw, 1.6rem)',
          color: 'rgba(255,248,235,0.5)',
          fontWeight: 300,
          lineHeight: 1.6,
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          {enSub}
        </p>
      )}
      <p style={{
        fontSize: 'clamp(1.5rem, 3vw, 3rem)',
        color: 'rgba(180,120,40,0.15)',
        marginTop: 'clamp(1.5rem, 4vh, 3rem)',
      }}>
        <Cross className="h-8 w-8" />
      </p>
    </div>
  )
}

/* ─── Verse Slide ─── */

const VERSE_COLORS: Record<string, { text: string; font: string }> = {
  english: { text: 'rgba(255,248,235,0.88)', font: 'Georgia, "Times New Roman", serif' },
  coptic: { text: '#d4af37', font: 'Georgia, "Times New Roman", serif' },
  arabic: { text: '#45b7a0', font: 'Georgia, "Times New Roman", serif' },
}

function VerseSlide({ html, lang }: { html: string; lang: 'english' | 'coptic' | 'arabic' }) {
  const header = extractHeader(html)
  const paragraphs = extractParagraphs(html)
  const colors = VERSE_COLORS[lang]

  return (
    <div className="text-center">
      {header && (
        <p style={{
          fontSize: 'clamp(0.6rem, 0.9vw, 0.9rem)',
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: 'clamp(1.5rem, 4vh, 3.5rem)',
          paddingBottom: '0.6rem',
          borderBottom: '1px solid rgba(180,120,40,0.12)',
          display: 'inline-block',
          fontWeight: 300,
        }}>
          {header}
        </p>
      )}
      <div className="space-y-4 md:space-y-6" style={{ maxWidth: '720px', margin: '0 auto' }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 2.2rem)',
            lineHeight: lang === 'coptic' ? 2.1 : lang === 'arabic' ? 2.1 : 1.9,
            margin: '0.6rem 0',
            fontWeight: 400,
            textShadow: '0 1px 10px rgba(0,0,0,0.3)',
            color: colors.text,
            fontFamily: colors.font,
            textAlign: 'center',
            ...(lang === 'arabic' ? { direction: 'rtl' as const } : {}),
          }}>
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}
