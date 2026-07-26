'use client'

import { useState, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import type { Level, Subject } from './types'

interface ImportModalProps {
  levels: Level[]
  subjects: Subject[]
  onImport: (levelId: string, data: Record<string, string>[], subjectId: string) => void
  onClose: () => void
}

export function ImportModal({ levels, subjects, onImport, onClose }: ImportModalProps) {
  const lang = useLanguage()
  const [importData, setImportData] = useState<Record<string, string>[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importTargetLevel, setImportTargetLevel] = useState('')
  const [importSubjectId, setImportSubjectId] = useState('')
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of text) {
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === '\n' && !inQuotes) {
        lines.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    if (current.trim()) lines.push(current)

    const cleaned = lines.filter(l => l.trim())
    if (cleaned.length < 2) return []

    const rawHeaders = cleaned[0]
    const headerParts: string[] = []
    let hBuf = ''
    let hQuotes = false
    for (const ch of rawHeaders) {
      if (ch === '"') {
        hQuotes = !hQuotes
      } else if (ch === ',' && !hQuotes) {
        headerParts.push(hBuf.trim())
        hBuf = ''
      } else {
        hBuf += ch
      }
    }
    headerParts.push(hBuf.trim())
    const headers = headerParts.map(h => h.toLowerCase())

    return cleaned.slice(1).map(line => {
      const cols: string[] = []
      let buf = ''
      let quotes = false
      for (const ch of line) {
        if (ch === '"') {
          quotes = !quotes
        } else if (ch === ',' && !quotes) {
          cols.push(buf.trim())
          buf = ''
        } else {
          buf += ch
        }
      }
      cols.push(buf.trim())
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = cols[i] || '' })
      return row
    })
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('')
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)

    if (file.name.endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        if (!text) { setImportError(lang === 'ar' ? 'ملف فارغ' : 'Empty file'); return }
        try {
          const parsed = parseCSV(text)
          if (parsed.length === 0) { setImportError(lang === 'ar' ? 'لم يتم العثور على بيانات في الملف' : 'No data found in file'); return }
          setImportData(parsed)
        } catch {
          setImportError(lang === 'ar' ? 'فشل تحليل الملف' : 'Failed to parse file')
        }
      }
      reader.readAsText(file)
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
        const normalized = json.map((row: Record<string, string>) => {
          const out: Record<string, string> = {}
          for (const [k, v] of Object.entries(row)) {
            out[k.toLowerCase()] = String(v ?? '')
          }
          return out
        })
        if (normalized.length === 0) { setImportError(lang === 'ar' ? 'لم يتم العثور على بيانات في الملف' : 'No data found in file'); return }
        setImportData(normalized)
      } catch {
        setImportError(lang === 'ar' ? 'فشل قراءة ملف Excel' : 'Failed to read Excel file')
      }
    } else {
      setImportError(lang === 'ar' ? 'يرجى رفع ملف CSV أو Excel' : 'Please upload a CSV or Excel file')
    }
  }

  const handleSubmit = async () => {
    if (!importData.length || !importTargetLevel || !importSubjectId) {
      setImportError(lang === 'ar' ? 'يرجى اختيار المستوى والمادة' : 'Please select level and subject')
      return
    }
    setImporting(true)
    setImportError('')
    try {
      await onImport(importTargetLevel, importData, importSubjectId)
    } catch {
      setImportError(lang === 'ar' ? 'فشل الاستيراد' : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const hasRequired = !!importData.length && !!importTargetLevel && !!importSubjectId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label={lang === 'ar' ? 'استيراد التسبائح' : 'Import Hymns'} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-900">{lang === 'ar' ? 'استيراد التسبائح' : 'Import Hymns'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label={lang === 'ar' ? 'إغلاق' : 'Close dialog'}><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {importError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{importError}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المستوى المستهدف' : 'Target Level'}</label>
            <select value={importTargetLevel} onChange={e => setImportTargetLevel(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">{lang === 'ar' ? 'اختر مستوى...' : 'Select a level...'}</option>
              {levels.map(l => <option key={l.id} value={l.id}>{lang === 'ar' ? 'المستوى' : 'Level'} {l.number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المادة' : 'Subject'}</label>
            <select value={importSubjectId} onChange={e => setImportSubjectId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">{lang === 'ar' ? 'اختر مادة...' : 'Select a subject...'}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.nameAr ? ` (${s.nameAr})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'ملف الاستيراد' : 'Import File'}</label>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            <p className="text-xs text-gray-400 mt-1">{lang === 'ar' ? 'الأعمدة المدعومة: العنوان، العنوان_عربي، العنوان_قبطي، الوصف، المدة، الجلسات' : 'Supported columns: title, titleAr, titleCoptic, description, duration, sessions'}</p>
          </div>
          {importData.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700">{importData.length} {lang === 'ar' ? 'تسبيحة جاهزة للاستيراد' : 'hymns ready to import'}</p>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-gray-500 space-y-1">
                {importData.slice(0, 5).map((row, i) => <div key={i}>{row.title || row.name || `${lang === 'ar' ? 'تسبيحة' : 'Hymn'} ${i + 1}`}</div>)}
                {importData.length > 5 && <div>{lang === 'ar' ? `...و ${importData.length - 5} أخرى` : `...and ${importData.length - 5} more`}</div>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={() => { setImportData([]); setImportFile(null); onClose() }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleSubmit} disabled={importing || !hasRequired}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-50">
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}{lang === 'ar' ? 'استيراد' : 'Import'} {importData.length} {lang === 'ar' ? 'تسبيحة' : 'Hymns'}
          </button>
        </div>
      </div>
    </div>
  )
}
