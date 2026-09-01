'use client'

import { useState, useRef } from 'react'
import { http } from '@/lib/http-client'
import { X, Download, Loader2, FileText } from 'lucide-react'

interface TermReport {
  studentId: string
  academicYear: string
  term: number
  period: { start: string; end: string }
  hymns: { title: string; titleAr: string | null; completedAt: string }[]
  liturgies: { date: string }[]
  badges: { name: string; nameAr: string | null; awardedAt: string }[]
  practiceCount: number
  attendanceRate: number
  totalXp: number
  servantNote: string | null
}

interface Props {
  childId: string
  language: string
  open: boolean
  onClose: () => void
}

export function TermReportModal({ childId, language, open, onClose }: Props) {
  const t = (en: string, ar: string) => language === 'ar' ? ar : en
  const [report, setReport] = useState<TermReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [term, setTerm] = useState(1)
  const reportRef = useRef<HTMLDivElement>(null)

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await http.get(`/parents/me/children/${childId}/term-report?term=${term}`) as TermReport
      setReport(res)
    } catch {
      setError(t('Failed to load report', 'فشل تحميل التقرير'))
    }
    setLoading(false)
  }

  const handleDownload = async () => {
    if (!reportRef.current) return
    const html2pdf = (await import('html2pdf.js')).default
    const opt: any = {
      margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
      filename: `term-report-${childId}-term${term}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
    }
    html2pdf().set(opt).from(reportRef.current).save()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-700" />
            <h2 className="text-lg font-bold text-gray-900">{t('Spiritual Growth Report', 'تقرير النمو الروحي')}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-600">{t('Term:', 'الفصل:')}</label>
            {[1, 2, 3].map(tn => (
              <button key={tn} onClick={() => { setTerm(tn); setReport(null) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  term === tn ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {tn}
              </button>
            ))}
          </div>

          <button onClick={fetchReport} disabled={loading} className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all mb-4">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('Generate Report', 'إنشاء التقرير')}
          </button>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {report && (
            <>
              <div ref={reportRef} className="bg-white border border-gray-200 rounded-xl p-6 font-serif" style={{ width: '10in', minHeight: '7in' }}>
                <div className="text-center mb-6 border-b-2 border-amber-700 pb-4">
                  <p className="text-2xl text-amber-700">✝</p>
                  <h1 className="text-xl font-bold text-gray-900">COHEP</h1>
                  <p className="text-sm text-gray-500">{t('Spiritual Growth Report', 'تقرير النمو الروحي')}</p>
                  <p className="text-xs text-gray-400">{report.academicYear} — {t('Term', 'الفصل')} {report.term}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{report.hymns.length}</p>
                    <p className="text-xs text-gray-600">{t('Hymns Learned', 'الألحان المحفوظة')}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{report.liturgies.length}</p>
                    <p className="text-xs text-gray-600">{t('Liturgies Attended', 'القداسات المحضورة')}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{report.totalXp}</p>
                    <p className="text-xs text-gray-600">{t('Total XP', 'إجمالي النقاط')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">{report.badges.length}</p>
                    <p className="text-xs text-gray-600">{t('Badges Earned', 'الشارات المحصل عليها')}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-700">{report.practiceCount}</p>
                    <p className="text-xs text-gray-600">{t('Practices', 'التدريبات')}</p>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-teal-700">{report.attendanceRate}%</p>
                    <p className="text-xs text-gray-600">{t('Attendance Rate', 'نسبة الحضور')}</p>
                  </div>
                </div>

                {report.hymns.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-1 mb-2">{t('Hymns Memorized', 'الألحان المحفوظة')}</h3>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {report.hymns.map((h, i) => (
                        <li key={i}>{language === 'ar' && h.titleAr ? h.titleAr : h.title}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.badges.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-1 mb-2">{t('Badges Earned', 'الشارات المحصل عليها')}</h3>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {report.badges.map((b, i) => (
                        <li key={i}>{language === 'ar' && b.nameAr ? b.nameAr : b.name}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.servantNote && (
                  <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-bold text-gray-700 mb-1">{t("Servant's Note", 'ملاحظة الخادم')}</p>
                    <p className="text-xs text-gray-600">{report.servantNote}</p>
                  </div>
                )}

                <div className="text-center mt-8 text-xs text-gray-400">
                  {t('Generated on', 'تم الإنشاء في')} {new Date().toLocaleDateString('en-GB')}
                </div>
              </div>

              <button onClick={handleDownload} className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm bg-green-600 text-white hover:bg-green-700 active:scale-95 transition-all mt-4">
                <Download className="w-4 h-4" />
                {t('Download PDF', 'تنزيل PDF')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
