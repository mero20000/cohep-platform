'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { BookOpen, ChevronDown, ChevronUp, Maximize2, Minimize2, Minus, Plus, ExternalLink } from 'lucide-react'
import { assetUrl } from '@/lib/asset-url'
import { toDisplayCoptic } from '@/lib/coptic-converter'

const ScorePdf = dynamic(() => import('./score-pdf'), { ssr: false })

export interface HymnReaderSource {
  /** Pasted hazzat text (Coptic + hazzat font characters). */
  hazzat?: string | null
  /** Uploaded image or PDF of the score. */
  hazzatFileUrl?: string | null
  /** Coptic / English / Arabic verses authored in the presentation editor. */
  presentationData?: { format?: string; verses?: { en?: string; cop?: string; ar?: string }[] } | null
  /** Plain-text words, used only when there are no verses. */
  requiredMemorization?: string | null
  requiredMemorizationAr?: string | null
}

type Tab = 'words' | 'hazzat' | 'score'
type WordsLang = 'all' | 'cop' | 'en' | 'ar'

/** Legacy data: the assessment screen treated `hazzat` as a link, so some rows may hold a bare URL. */
export function looksLikeFileUrl(s: string): boolean {
  return /^(https?:\/\/|\/uploads\/)\S+$/i.test(s.trim())
}

function fileKind(url: string): 'pdf' | 'image' {
  const path = url.split(/[?#]/)[0].toLowerCase()
  return path.endsWith('.pdf') ? 'pdf' : 'image'
}

export function resolveReaderContent(src: HymnReaderSource, lang: 'en' | 'ar') {
  const verses = (src.presentationData?.verses ?? []).filter(v => v && (v.cop || v.en || v.ar))
  const plainWords = (lang === 'ar'
    ? src.requiredMemorizationAr || src.requiredMemorization
    : src.requiredMemorization || src.requiredMemorizationAr) || null
  const rawHazzat = src.hazzat?.trim() || ''
  const hazzatIsUrl = !!rawHazzat && looksLikeFileUrl(rawHazzat)
  const fileUrl = src.hazzatFileUrl || (hazzatIsUrl ? rawHazzat : null)
  const hazzatText = hazzatIsUrl ? '' : rawHazzat
  return { verses, plainWords, hazzatText, fileUrl }
}

/** True when the reader would show the words, so callers can avoid printing them twice. */
export function readerShowsWords(src: HymnReaderSource, lang: 'en' | 'ar'): boolean {
  const c = resolveReaderContent(src, lang)
  return c.verses.length > 0 || !!c.plainWords
}

const FONT_STEPS = [0.9, 1, 1.2, 1.5, 1.9]

/**
 * What a student reads and follows while recording: the words, the hazzat, and the score
 * image/PDF. It is sticky, so it stays on screen when the recorder below is in use, and its
 * body scrolls independently.
 */
export function HymnReader({
  source, lang, title, titleCoptic,
}: { source: HymnReaderSource; lang: 'en' | 'ar'; title?: string; titleCoptic?: string | null }) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const content = useMemo(() => resolveReaderContent(source, lang), [source, lang])
  const { verses, plainWords, hazzatText, fileUrl } = content

  const tabs = useMemo(() => {
    const list: Tab[] = []
    if (verses.length > 0 || plainWords) list.push('words')
    if (hazzatText) list.push('hazzat')
    if (fileUrl) list.push('score')
    return list
  }, [verses.length, plainWords, hazzatText, fileUrl])

  const [tab, setTab] = useState<Tab | null>(null)
  const [open, setOpen] = useState(true)
  const [tall, setTall] = useState(false)
  const [fontStep, setFontStep] = useState(1)
  const [scoreZoom, setScoreZoom] = useState(1)
  const [pdfFailed, setPdfFailed] = useState(false)
  const [wordsLang, setWordsLang] = useState<WordsLang>('all')

  if (tabs.length === 0) return null
  const active: Tab = tab && tabs.includes(tab) ? tab : tabs[0]

  const hasCop = verses.some(v => v.cop)
  const hasEn = verses.some(v => v.en)
  const hasAr = verses.some(v => v.ar)
  const langOptions: { id: WordsLang; label: string }[] = [
    { id: 'all', label: t('All', 'الكل') },
    ...(hasCop ? [{ id: 'cop' as const, label: t('Coptic', 'قبطي') }] : []),
    ...(hasEn ? [{ id: 'en' as const, label: 'English' }] : []),
    ...(hasAr ? [{ id: 'ar' as const, label: 'العربية' }] : []),
  ]
  const tabLabel: Record<Tab, string> = {
    words: t('Words', 'الكلمات'),
    hazzat: t('Hazzat', 'الحزّات'),
    score: t('Score', 'النوتة'),
  }
  const fs = FONT_STEPS[fontStep]
  const show = (l: 'cop' | 'en' | 'ar') => wordsLang === 'all' || wordsLang === l

  return (
    <section
      aria-label={t('Hymn text', 'نص اللحن')}
      // Sticky inside the practice modal: the recorder below can scroll, this stays in view.
      className="sticky top-0 z-10 rounded-xl border border-gold-200 bg-white shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-gold-100 px-3 py-2">
        <BookOpen className="h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
        <div role="tablist" aria-label={t('Reading material', 'مواد القراءة')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {tabs.map(id => (
            <button key={id} type="button" role="tab" aria-selected={active === id}
              onClick={() => { setTab(id); setOpen(true) }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${active === id ? 'bg-gold-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {tabLabel[id]}
            </button>
          ))}
        </div>
        {open && (
          <button type="button" onClick={() => setTall(v => !v)}
            aria-label={tall ? t('Smaller panel', 'تصغير اللوحة') : t('Larger panel', 'تكبير اللوحة')}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
            {tall ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
          aria-label={open ? t('Hide text', 'إخفاء النص') : t('Show text', 'إظهار النص')}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-1.5">
            {active === 'words' && verses.length > 0 && langOptions.length > 2 && (
              <div role="group" aria-label={t('Language', 'اللغة')} className="flex overflow-hidden rounded-lg border border-gray-300">
                {langOptions.map(o => (
                  <button key={o.id} type="button" aria-pressed={wordsLang === o.id}
                    onClick={() => setWordsLang(o.id)}
                    className={`px-2.5 py-1 text-xs font-semibold ${wordsLang === o.id ? 'bg-gold-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <div className="ms-auto flex items-center gap-1" role="group" aria-label={t('Size', 'الحجم')}>
              {active === 'score' ? (
                <>
                  <button type="button" disabled={scoreZoom <= 1} onClick={() => setScoreZoom(z => Math.max(1, +(z - 0.5).toFixed(1)))}
                    aria-label={t('Zoom out', 'تصغير')} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-10 text-center text-xs text-gray-500">{Math.round(scoreZoom * 100)}%</span>
                  <button type="button" disabled={scoreZoom >= 3} onClick={() => setScoreZoom(z => Math.min(3, +(z + 0.5).toFixed(1)))}
                    aria-label={t('Zoom in', 'تكبير')} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <button type="button" disabled={fontStep <= 0} onClick={() => setFontStep(s => Math.max(0, s - 1))}
                    aria-label={t('Smaller text', 'تصغير الخط')} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                  <button type="button" disabled={fontStep >= FONT_STEPS.length - 1} onClick={() => setFontStep(s => Math.min(FONT_STEPS.length - 1, s + 1))}
                    aria-label={t('Larger text', 'تكبير الخط')} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                </>
              )}
            </div>
          </div>

          <div
            data-testid="hymn-reader-body"
            className={`overflow-auto overscroll-contain px-3 py-3 ${tall ? 'max-h-[65vh]' : 'max-h-[34vh]'}`}
          >
            {active === 'words' && (
              verses.length > 0 ? (
                <div className="space-y-4" style={{ fontSize: `${fs}rem` }}>
                  {(titleCoptic || title) && (
                    <p className="text-center text-xs text-gray-400" style={{ fontSize: '0.75rem' }}>{[toDisplayCoptic(titleCoptic), title].filter(Boolean).join(' · ')}</p>
                  )}
                  {verses.map((v, i) => (
                    <div key={i} className="space-y-1 border-b border-gray-100 pb-3 last:border-0">
                      {show('cop') && v.cop && (
                        // Same class as the Coptic name in Subject items; size set here so the A-/A+ control still applies.
                        <p className="coptic-text leading-loose text-gold-800 whitespace-pre-wrap" style={{ fontSize: `${fs}rem` }}>{toDisplayCoptic(v.cop)}</p>
                      )}
                      {show('en') && v.en && <p className="leading-relaxed text-gray-800 whitespace-pre-wrap" style={{ fontFamily: 'Georgia, serif' }}>{v.en}</p>}
                      {show('ar') && v.ar && <p dir="rtl" className="leading-loose text-teal-800 whitespace-pre-wrap" style={{ fontFamily: "'Noto Naskh Arabic', 'Traditional Arabic', serif" }}>{v.ar}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed text-gray-800" style={{ fontSize: `${fs}rem` }}>{plainWords}</p>
              )
            )}

            {active === 'hazzat' && (
              // Shown exactly as stored: left-aligned, spaces and line breaks kept, never re-wrapped (a wrapped
              // line would pull notation marks away from the letters they belong to). Wide lines scroll sideways.
              <p className="hazzat-text whitespace-pre text-gray-900"
                style={{ fontSize: `${1.15 * fs}rem`, lineHeight: 2.1 }}>{hazzatText}</p>
            )}

            {active === 'score' && fileUrl && (
              <div>
                {fileKind(fileUrl) === 'image' ? (
                  <div className="overflow-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(fileUrl)} alt={t('Hazzat score', 'نوتة الحزّات')}
                      style={{ width: `${scoreZoom * 100}%`, maxWidth: 'none', height: 'auto' }} className="mx-auto block" />
                  </div>
                ) : pdfFailed ? (
                  <p className="py-4 text-center text-sm text-gray-600">
                    {t('The score could not be shown here.', 'تعذر عرض الملف هنا.')}{' '}
                    <a href={assetUrl(fileUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{t('Open the PDF', 'افتح ملف PDF')}
                    </a>
                  </p>
                ) : (
                  <ScorePdf src={assetUrl(fileUrl)} zoom={scoreZoom} label={t('Score page', 'صفحة النوتة')} onError={() => setPdfFailed(true)} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
