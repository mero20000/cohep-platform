'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, ClipboardPaste, Loader2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import type { PresentationData } from './types'

interface SlideEditorProps {
  value?: PresentationData
  onChange: (data: PresentationData) => void
  schoolApiBase?: string
}

const DEFAULT_DATA: PresentationData = {
  format: 'both',
  speaker: '',
  verses: [{ en: '', cop: '', ar: '' }],
  note: '',
}

export function SlideEditor({ value, onChange, schoolApiBase }: SlideEditorProps) {
  const lang = useLanguage()
  const [data, setData] = useState<PresentationData>(value || DEFAULT_DATA)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  const update = useCallback((patch: Partial<PresentationData>) => {
    const next = { ...data, ...patch }
    setData(next)
    onChange(next)
  }, [data, onChange])

  const updateVerse = (idx: number, field: 'en' | 'cop' | 'ar', val: string) => {
    const verses = data.verses.map((v, i) => i === idx ? { ...v, [field]: val } : v)
    update({ verses })
  }

  const addVerse = () => update({ verses: [...data.verses, { en: '', cop: '', ar: '' }] })
  const removeVerse = (idx: number) => {
    if (data.verses.length <= 1) return
    update({ verses: data.verses.filter((_, i) => i !== idx) })
  }

  const handlePasteHtml = async () => {
    const html = prompt(lang === 'ar' ? 'الصق HTML من copticchurch.net هنا:' : 'Paste HTML from CopticChurch.net here:')
    if (!html) return
    setParsing(true)
    setParseError('')
    try {
      const base = schoolApiBase || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${base}/curriculum/parse-html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const parsed: PresentationData = await res.json()
      setData(parsed)
      onChange(parsed)
    } catch (e) {
      setParseError(lang === 'ar' ? 'فشل تحليل HTML' : 'Failed to parse HTML')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">
          {lang === 'ar' ? 'محرر الشرائح' : 'Slide Editor'}
        </h4>
        <button onClick={handlePasteHtml} disabled={parsing}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
          {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardPaste className="h-3.5 w-3.5" />}
          {lang === 'ar' ? 'لصق HTML' : 'Paste HTML'}
        </button>
      </div>
      {parseError && <p className="text-xs text-red-500">{parseError}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'القائل' : 'Speaker'}</label>
          <input value={data.speaker || ''} onChange={e => update({ speaker: e.target.value })}
            placeholder="People / Priest / Deacon"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'العرض' : 'Display'}</label>
          <select value={data.format} onChange={e => update({ format: e.target.value as PresentationData['format'] })}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="both">{lang === 'ar' ? 'ثلاثي الأعمدة' : '3-Column (Both)'}</option>
            <option value="en">{lang === 'ar' ? 'إنجليزي فقط' : 'English Only'}</option>
            <option value="cop">{lang === 'ar' ? 'قبطي فقط' : 'Coptic Only'}</option>
            <option value="ar">{lang === 'ar' ? 'عربي فقط' : 'Arabic Only'}</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {data.verses.map((verse, idx) => (
          <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">
                {lang === 'ar' ? 'مقطع' : 'Verse'} {idx + 1}
              </span>
              <button onClick={() => removeVerse(idx)} disabled={data.verses.length <= 1}
                className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-0.5">English</label>
                <textarea value={verse.en} onChange={e => updateVerse(idx, 'en', e.target.value)} rows={3}
                  className="block w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Coptic</label>
                <textarea value={verse.cop} onChange={e => updateVerse(idx, 'cop', e.target.value)} rows={3}
                  className="block w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{lang === 'ar' ? 'عربي' : 'Arabic'}</label>
                <textarea value={verse.ar} onChange={e => updateVerse(idx, 'ar', e.target.value)} rows={3} dir="rtl"
                  className="block w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-arabic focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addVerse}
        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
        <Plus className="h-3.5 w-3.5" /> {lang === 'ar' ? 'إضافة مقطع' : 'Add Verse'}
      </button>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'ملاحظة' : 'Note'}</label>
        <input value={data.note || ''} onChange={e => update({ note: e.target.value })}
          placeholder={lang === 'ar' ? 'تُقال في جميع أيام الصوم...' : 'Said on all fasting days...'}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
    </div>
  )
}
