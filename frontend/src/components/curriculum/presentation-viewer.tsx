'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Columns3, Languages, Maximize, Minimize, ExternalLink } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { PptxViewer } from './pptx-viewer'
import type { PresentationData } from './types'

interface PresentationViewerProps {
  data: PresentationData
  title?: string
  titleCoptic?: string
  titleAr?: string
  hazzat?: string
  presentationUrl?: string
  onExit: () => void
  contained?: boolean
}

type DisplayMode = 'both' | 'en' | 'cop' | 'ar'

const BG = '#0a0a0a'

export function PresentationViewer({ data, title, titleCoptic, titleAr, hazzat, presentationUrl, onExit, contained }: PresentationViewerProps) {
  const lang = useLanguage()
  const [current, setCurrent] = useState(0)
  const [displayMode, setDisplayMode] = useState<DisplayMode>(data.format || 'both')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pptxTotal, setPptxTotal] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const touchX = useRef(0)

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      ref.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!contained) {
      const timer = setTimeout(() => {
        ref.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [contained])

  const verses = data.verses || []
  const total = verses.length
  const hasHazzat = !!hazzat
  const hasPptx = !!presentationUrl
  const verseAndHazzat = total + (hasHazzat ? 1 : 0)
  const maxSlide = verseAndHazzat + pptxTotal

  const goNext = useCallback(() => { if (current < maxSlide) setCurrent(c => c + 1) }, [current, maxSlide])
  const goPrev = useCallback(() => { if (current > 0) setCurrent(c => c - 1) }, [current])

  // slide layout: 0 = title, 1 = hazzat (if present), then verses, then pptx
  const isTitleSlide = current === 0
  const isHazzatSlide = hasHazzat && current === 1
  const verseStart = hasHazzat ? 2 : 1
  const verseEnd = verseStart + total
  const verseIdx = current - verseStart
  const verse = !isTitleSlide && !isHazzatSlide && verseIdx >= 0 && verseIdx < total ? verses[verseIdx] : null
  const isPptxSlide = hasPptx && current >= verseEnd && pptxTotal > 0
  const pptxSlideIdx = isPptxSlide ? current - verseEnd : 0

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev() }
      if (e.key === 'Escape') { if (!document.fullscreenElement) onExit() }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === '1') setDisplayMode('both')
      if (e.key === '2') setDisplayMode('en')
      if (e.key === '3') setDisplayMode('cop')
      if (e.key === '4') setDisplayMode('ar')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, onExit])

  const slideCount = total + 1 + (hasHazzat ? 1 : 0) + pptxTotal // title + hazzat + verses + pptx

  const toggleMode = () => {
    const modes: DisplayMode[] = ['both', 'en', 'cop', 'ar']
    const idx = modes.indexOf(displayMode)
    setDisplayMode(modes[(idx + 1) % modes.length])
  }

  const content = (
    <div ref={ref} className={`${contained ? 'relative w-full h-full' : 'fixed inset-0 z-[100]'} select-none`} style={{ background: BG }}
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
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(180,120,40,0.06) 0%, transparent 70%)' }} />

      {/* Top bar — minimal */}
      <div className="relative z-10 flex items-center justify-between px-4 md:px-8 py-2">
        <button onClick={e => { e.stopPropagation(); onExit() }}
          className="text-white/20 hover:text-white/50 text-[10px] tracking-widest uppercase transition-colors">
          <X className="h-2.5 w-2.5 inline mr-0.5" /> {lang === 'ar' ? 'خروج' : 'Exit'}
        </button>

        <div className="flex items-center gap-2">
          {presentationUrl && (
            <a href={presentationUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
              <ExternalLink className="h-2.5 w-2.5" />
              Open PPTX
            </a>
          )}
          <button onClick={e => { e.stopPropagation(); toggleFullscreen() }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
            {isFullscreen ? <Minimize className="h-2.5 w-2.5" /> : <Maximize className="h-2.5 w-2.5" />}
            {isFullscreen ? 'Exit FS' : 'Fullscreen'}
          </button>
          <button onClick={e => { e.stopPropagation(); toggleMode() }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
            {displayMode === 'both' ? <Columns3 className="h-2.5 w-2.5" /> : <Languages className="h-2.5 w-2.5" />}
            {displayMode === 'both' ? '3-Col' : displayMode.toUpperCase()}
          </button>
          <span className="text-white/15 text-xs tabular-nums">{current + 1} / {slideCount}</span>
        </div>
      </div>

      {/* Content — fills remaining space */}
      <div className="relative z-10 flex items-center justify-center px-4 md:px-8" style={{ height: 'calc(100% - 5rem)' }}>
        <div key={current} className="w-full mx-auto" style={{ animation: 'fadeSlideIn 0.35s ease-out' }}>
          {isTitleSlide ? (
            <TitleSlide title={title} titleCoptic={titleCoptic} titleAr={titleAr} speaker={data.speaker} />
          ) : isHazzatSlide ? (
            <HazzatSlide text={hazzat!} title={title} titleCoptic={titleCoptic} titleAr={titleAr} />
          ) : isPptxSlide ? (
            <PptxViewer url={presentationUrl!} slideIndex={pptxSlideIdx} onTotalSlides={setPptxTotal} />
          ) : verse ? (
            <VerseSlide verse={verse} mode={displayMode} speaker={data.speaker} />
          ) : null}

          {/* Hidden pre-loader for PPTX — reports total slides so nav includes them */}
          {hasPptx && !isPptxSlide && (
            <div style={{ display: 'none' }}>
              <PptxViewer url={presentationUrl!} slideIndex={0} onTotalSlides={setPptxTotal} />
            </div>
          )}
          {verseIdx === total - 1 && data.note && (
            <p className="text-center mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {data.note}
            </p>
          )}
        </div>
      </div>

      {/* Bottom nav — minimal */}
      <div className="relative z-10 flex items-center justify-between px-4 md:px-8 py-2">
        <button onClick={e => { e.stopPropagation(); goPrev() }} disabled={current === 0}
          className="p-1.5 rounded-full transition-all disabled:opacity-0 hover:bg-white/5"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <ChevronLeft className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
        </button>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: slideCount }).map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i) }}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? '1.8rem' : '0.35rem',
                height: '0.35rem',
                background: i === current ? '#c9a030' : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>

        <button onClick={e => { e.stopPropagation(); goNext() }} disabled={current === slideCount - 1}
          className="p-1.5 rounded-full transition-all disabled:opacity-0 hover:bg-white/5"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <ChevronRight className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
        </button>
      </div>

      <style>{`@keyframes fadeSlideIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
  if (contained) return content
  return createPortal(content, document.body)
}

/* ─── Title Slide ─── */
function TitleSlide({ title, titleCoptic, titleAr, speaker }: {
  title?: string; titleCoptic?: string; titleAr?: string; speaker?: string
}) {
  return (
    <div className="text-center">
      {speaker && (
        <p style={{
          fontSize: 'clamp(1rem, 2vw, 2rem)', color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 'clamp(2rem, 5vh, 4rem)', fontWeight: 300,
        }}>{speaker}</p>
      )}
      {titleCoptic && (
        <h1 style={{
          fontSize: 'clamp(3.5rem, 8vw, 7rem)', fontWeight: 700, color: '#c9a030', lineHeight: 1.2,
          marginBottom: 'clamp(1rem, 3vh, 2.5rem)', fontFamily: FONTS.coptic,
          textShadow: '0 2px 30px rgba(0,0,0,0.5)',
        }}>{titleCoptic}</h1>
      )}
      {title && (
        <p style={{
          fontSize: 'clamp(1.4rem, 3vw, 2.8rem)', color: 'rgba(255,248,235,0.5)',
          fontWeight: 300, lineHeight: 1.5, maxWidth: '80%', margin: '0 auto',
          fontFamily: FONTS.english,
        }}>{title}</p>
      )}
      {titleAr && (
        <p style={{
          fontSize: 'clamp(1.4rem, 3vw, 2.8rem)', color: 'rgba(69,183,160,0.5)',
          fontWeight: 300, lineHeight: 1.5, marginTop: '1.5rem', direction: 'rtl',
          fontFamily: FONTS.arabic,
        }}>{titleAr}</p>
      )}
    </div>
  )
}

/* ─── Hazzat Slide ─── */
function HazzatSlide({ text, title, titleCoptic, titleAr }: {
  text: string; title?: string; titleCoptic?: string; titleAr?: string
}) {
  return (
    <div className="text-center px-4" style={{ maxWidth: '85vw', margin: '0 auto' }}>
      {titleCoptic && (
        <p style={{
          fontSize: 'clamp(1.2rem, 2.5vw, 2.2rem)', color: '#c9a030', fontWeight: 600,
          fontFamily: FONTS.coptic, marginBottom: '0.5rem',
        }}>{titleCoptic}</p>
      )}
      {title && (
        <p style={{
          fontSize: 'clamp(0.9rem, 1.5vw, 1.4rem)', color: 'rgba(255,248,235,0.4)',
          fontWeight: 300, fontFamily: FONTS.english,
        }}>{title}</p>
      )}
      {titleAr && (
        <p style={{
          fontSize: 'clamp(0.9rem, 1.5vw, 1.4rem)', color: 'rgba(69,183,160,0.4)',
          fontWeight: 300, direction: 'rtl', fontFamily: FONTS.arabic,
        }}>{titleAr}</p>
      )}
      <div style={{
        marginTop: 'clamp(1.5rem, 4vh, 3rem)',
        padding: 'clamp(1rem, 2vw, 2rem)',
        borderRadius: '0.75rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(180,120,40,0.1)',
      }}>
        <p style={{
          fontSize: 'clamp(1.8rem, 4vw, 4rem)',
          lineHeight: 2.2,
          fontFamily: FONTS.hazzat,
          color: '#d4af37',
          textShadow: '0 1px 20px rgba(0,0,0,0.4)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>{text}</p>
      </div>
    </div>
  )
}

/* ─── Verse Slide ─── */
function VerseSlide({ verse, mode, speaker }: {
  verse: { en: string; cop: string; ar: string }; mode: DisplayMode; speaker?: string
}) {
  return (
    <div className="text-center px-2">
      {speaker && (
        <p style={{
          fontSize: 'clamp(0.9rem, 1.6vw, 1.5rem)', color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 'clamp(1.5rem, 4vh, 4rem)',
          paddingBottom: '0.5rem', borderBottom: '1px solid rgba(180,120,40,0.1)',
          display: 'inline-block', fontWeight: 300,
        }}>{speaker}</p>
      )}

      {mode === 'both' ? (
        <div className="flex gap-6 md:gap-10 justify-center items-start w-full" style={{ maxWidth: '90vw', margin: '0 auto' }}>
          <Column text={verse.en} color="rgba(255,248,235,0.88)" font="english" />
          <Column text={verse.cop} color="#d4af37" font="coptic" />
          <Column text={verse.ar} color="#45b7a0" dir="rtl" font="arabic" />
        </div>
      ) : (
        <div style={{ maxWidth: '80vw', margin: '0 auto' }}>
          {mode === 'en' && <Column text={verse.en} color="rgba(255,248,235,0.88)" font="english" large />}
          {mode === 'cop' && <Column text={verse.cop} color="#d4af37" font="coptic" large />}
          {mode === 'ar' && <Column text={verse.ar} color="#45b7a0" font="arabic" large dir="rtl" />}
        </div>
      )}
    </div>
  )
}

const FONTS = {
  coptic: "'CS Avva Shenouda', 'Noto Sans Coptic', 'Antinoou', serif",
  arabic: "'Noto Naskh Arabic', 'Traditional Arabic', serif",
  english: "Georgia, 'Times New Roman', serif",
  hazzat: "'Hazzat', 'CS Avva Shenouda', monospace",
} as const

function Column({ text, color, dir, large, font }: {
  text: string; color: string; dir?: 'rtl'; large?: boolean; font?: keyof typeof FONTS
}) {
  if (!text) return <div />
  return (
    <p style={{
      fontSize: large ? 'clamp(2.5rem, 5vw, 5rem)' : 'clamp(1.4rem, 3vw, 3rem)',
      lineHeight: 1.8, color, fontFamily: FONTS[font ?? 'english'],
      textAlign: 'center', textShadow: '0 1px 15px rgba(0,0,0,0.3)',
      ...(dir ? { direction: 'rtl' } : {}),
      ...(large ? {} : { flex: '1 1 0', minWidth: 0 }),
    }}>{text}</p>
  )
}
