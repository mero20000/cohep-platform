'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ChevronRight, GraduationCap, Phone, CheckCircle2 } from 'lucide-react'
import { http } from '@/lib/http-client'

type GapKey = 'photo' | 'parent' | 'grade'
interface DataQuality { totalActiveStudents: number; gaps: { key: GapKey; missing: number }[] }

const COPY: Record<GapKey, { en: string; ar: string; whyEn: string; whyAr: string; icon: typeof Camera }> = {
  photo: { en: 'No photo', ar: 'بدون صورة', whyEn: 'Servants cannot recognise them on the register.', whyAr: 'لا يستطيع الخدام التعرف عليهم في كشف الحضور.', icon: Camera },
  parent: { en: 'No parent contact', ar: 'بدون وسيلة اتصال بولي الأمر', whyEn: 'No parent email and no linked parent account — nobody to reach about an absence.', whyAr: 'لا بريد لولي الأمر ولا حساب مرتبط — لا أحد للتواصل عند الغياب.', icon: Phone },
  grade: { en: 'No school grade', ar: 'بدون صف دراسي', whyEn: 'Cannot be placed in grade-based reports.', whyAr: 'لا يظهرون في التقارير حسب الصف الدراسي.', icon: GraduationCap },
}

export function DataQualitySection({ schoolId, lang }: { schoolId: string; lang: string }) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [data, setData] = useState<DataQuality | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true); setError(false)
    http.get<DataQuality>('/reports/data-quality', { schoolId })
      .then(d => { if (live) { setData(d); setLoading(false) } })
      .catch(() => { if (live) { setError(true); setLoading(false) } })
    return () => { live = false }
  }, [schoolId, tick])

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}</div>
  if (error || !data) return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-600">{t('Failed to load data quality.', 'فشل تحميل جودة البيانات.')}</p>
      <button type="button" onClick={() => setTick(k => k + 1)} className="mt-2 text-xs text-red-500 underline">{t('Retry', 'إعادة المحاولة')}</button>
    </div>
  )

  const allClear = data.gaps.every(g => g.missing === 0)
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {t(`Details missing from the ${data.totalActiveStudents} active students. Fixing these makes the other reports and the follow-up alerts more useful.`,
           `تفاصيل ناقصة من ${data.totalActiveStudents} طالبًا نشطًا. استكمالها يجعل التقارير الأخرى وتنبيهات المتابعة أنفع.`)}
      </p>
      {allClear && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t('Every active student has a photo, a parent contact and a grade.', 'لكل طالب نشط صورة ووسيلة اتصال بولي الأمر وصف دراسي.')}
        </div>
      )}
      <ul className="space-y-3" aria-label={t('Missing details', 'التفاصيل الناقصة')}>
        {data.gaps.map(g => {
          const c = COPY[g.key]
          const Icon = c.icon
          const pct = data.totalActiveStudents > 0 ? Math.round((g.missing / data.totalActiveStudents) * 100) : 0
          const body = (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600"><Icon className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{t(c.en, c.ar)}</p>
                <p className="text-[11px] text-gray-500">{t(c.whyEn, c.whyAr)}</p>
              </div>
              <div className="shrink-0 text-end">
                <p className={`text-xl font-black tabular-nums ${g.missing > 0 ? 'text-amber-700' : 'text-green-700'}`}>{g.missing}</p>
                <p className="text-[11px] text-gray-500">{pct}%</p>
              </div>
              {g.missing > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 rtl:rotate-180" aria-hidden="true" />}
            </>
          )
          return (
            <li key={g.key}>
              {g.missing > 0 ? (
                <Link href={`/dashboard/students?dataGap=${g.key}`}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-amber-200 bg-white p-4 hover:border-gold-400 transition">{body}</Link>
              ) : (
                <div className="flex min-h-14 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
