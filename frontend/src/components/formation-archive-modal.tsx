'use client'

import { useState, useRef } from 'react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { X, Download, Loader2, FileText } from 'lucide-react'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

interface Props {
  childId: string
  childName: string
  open: boolean
  onClose: () => void
}

export function FormationArchiveModal({ childId, childName, open, onClose }: Props) {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const res = await http.get(`/parents/me/children/${childId}/archive`)
      setData(res)
    } catch { /* ignore */ }
    setLoading(false)
  }

  async function downloadPdf() {
    if (!reportRef.current) return
    setGenerating(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      const opt = {
        margin: 0.5,
        filename: `${childName.replace(/\s+/g, '-').toLowerCase()}-formation-archive.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } as any,
      }
      await html2pdf().set(opt).from(reportRef.current).save()
    } catch { /* ignore */ }
    setGenerating(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">{t('Formation Archive', 'أرشيف التكوين')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!data ? (
          <button onClick={fetchData} disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
            {loading && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
            {t('Load Archive Data', 'تحميل بيانات الأرشيف')}
          </button>
        ) : (
          <>
            <button onClick={downloadPdf} disabled={generating}
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              ) : (
                <Download className="w-4 h-4 inline mr-2" />
              )}
              {t('Download PDF', 'تحميل PDF')}
            </button>

            <div ref={reportRef} className="p-6 bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <h1 className="text-xl font-bold text-center mb-1">{data.student.name}</h1>
              <p className="text-xs text-gray-500 text-center mb-1">{data.student.nameEn}</p>
              <p className="text-xs text-gray-500 text-center mb-6">{data.student.level}</p>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{data.stats.lessonsCount}</p>
                  <p className="text-xs text-gray-500">{t('Hymns', 'تراتيل')}</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{data.stats.liturgiesCount}</p>
                  <p className="text-xs text-gray-500">{t('Liturgies', 'قداسات')}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{data.stats.badgesCount}</p>
                  <p className="text-xs text-gray-500">{t('Badges', 'شارات')}</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">
                {t('Journey Timeline', 'الجدول الزمني للرحلة')}
              </h3>
              {data.milestones.map((m: any, i: number) => (
                <div key={i} className="mb-4 pb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5 shrink-0">
                      {m.type === 'lesson' ? '📖' : m.type === 'liturgy' ? '✝️' : '🏅'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{m.title}</p>
                      <p className="text-xs text-gray-400">{new Date(m.date).toLocaleDateString()}</p>
                      {m.milestonePhotoUrl && (
                        <img src={`${API_ORIGIN}${m.milestonePhotoUrl}`} alt="" className="mt-1 max-h-24 rounded border" />
                      )}
                      {m.photoUrl && (
                        <img src={`${API_ORIGIN}${m.photoUrl}`} alt="" className="mt-1 max-h-24 rounded border" />
                      )}
                      {m.milestoneCaption && <p className="text-xs text-gray-600 mt-1 italic">{m.milestoneCaption}</p>}
                      {m.servantNote && <p className="text-xs text-gray-600 mt-1 italic">{m.servantNote}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
