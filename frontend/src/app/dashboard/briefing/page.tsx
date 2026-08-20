'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Sun, CalendarDays, BookOpen, AlertTriangle, User, ChevronDown, CheckCircle2 } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { assetUrl } from '@/lib/asset-url'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface Note { category?: string; note?: string; isPrivate: boolean; createdAt: string }
interface RosterStudent {
  studentId: string; firstName: string; lastName: string
  firstNameAr?: string; lastNameAr?: string; photoUrl?: string
  attendanceRate: number; lastAttendanceStatus: string | null
  likelyAbsent: boolean; needsFollowUp: boolean; followUpReasons: string[]; notes: Note[]
}
interface WeeklyBriefing {
  generatedAt: string
  coptic: {
    coptic: { month: number; day: number; year: number; monthName: string; monthNameAr: string }
    season: string; seasonLabel: { en: string; ar: string }
    feastFast: { key: string; en: string; ar: string } | null
  }
  nextSession: {
    id: string; scheduledDate: string; levelId?: string; levelName?: string; levelNumber?: number; groupId?: string; groupName?: string
  } | null
  nextLesson: {
    lessonId: string; title: string; titleAr?: string; titleCoptic?: string
    levelName?: string; subjectName?: string; scheduledDate?: string
  } | null
  roster: RosterStudent[]
}

const REASON_LABEL: Record<string, { en: string; ar: string }> = {
  overdue_review: { en: 'Review due', ar: 'مراجعة مستحقة' },
  low_mastery: { en: 'New lesson', ar: 'درس جديد' },
  absent_3plus: { en: 'Missed 3+', ar: 'تغيب 3+' },
  ungraded_assessment: { en: 'To grade', ar: 'بانتظار التقييم' },
}

export default function BriefingPage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [data, setData] = useState<WeeklyBriefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openStudent, setOpenStudent] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(false)
    setLoading(true)
    http.get<WeeklyBriefing>('/dashboard/weekly-briefing')
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6"><div className="h-6 w-40 bg-gray-200 rounded animate-pulse" /></div>
        <TableSkeleton rows={4} cols={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-gray-900">{t('Could not load your briefing.', 'تعذر تحميل الموجز.')}</p>
          <button type="button" onClick={load} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            {t('Retry', 'إعادة المحاولة')}
          </button>
        </div>
      </div>
    )
  }

  const flagged = (data?.roster ?? []).filter(s => s.likelyAbsent || s.needsFollowUp)
  const copticLabel = data?.coptic
    ? lang === 'ar'
      ? `${data.coptic.coptic.day} ${data.coptic.coptic.monthNameAr} ${data.coptic.coptic.year}`
      : `${data.coptic.coptic.day} ${data.coptic.coptic.monthName} ${data.coptic.coptic.year}`
    : ''

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <Sun className="h-6 w-6 text-gold-500" />
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('This Sunday', 'أحد الأسبوع')}</h1>
      </div>

      {data?.coptic && (
        <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <CalendarDays className="h-4 w-4 text-gold-600" />
            <span className="font-semibold">{copticLabel}</span>
            <span>·</span>
            <span>{lang === 'ar' ? data.coptic.seasonLabel.ar : data.coptic.seasonLabel.en}</span>
          </div>
          {data.coptic.feastFast && (
            <span className="mt-2 inline-block rounded-full bg-gold-600 px-3 py-1 text-xs font-semibold text-gray-950">
              {lang === 'ar' ? data.coptic.feastFast.ar : data.coptic.feastFast.en}
            </span>
          )}
        </div>
      )}

      {data?.nextSession && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('Next session', 'الجلسة القادمة')}</div>
            <div className="mt-1 text-sm text-gray-900">
              {data.nextSession.groupName} · {data.nextSession.levelName} ·{' '}
              {new Date(data.nextSession.scheduledDate).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>
          <Link
            href={`/dashboard/attendance?sessionId=${data.nextSession.id}&prefill=present`}
            className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gold-600"
          >
            {t('Start Class', 'ابدأ الفصل')}
          </Link>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <BookOpen className="h-4 w-4" />
          {t('Prepare this lesson', 'حضّر هذا الدرس')}
        </div>
        {data?.nextLesson ? (
          <>
            <h2 className="mt-2 text-lg font-bold text-gray-900">
              {lang === 'ar' ? data.nextLesson.titleAr || data.nextLesson.title : data.nextLesson.title}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {data.nextLesson.titleCoptic && <span className="coptic-text">{data.nextLesson.titleCoptic} · </span>}
              {data.nextLesson.subjectName} · {data.nextLesson.levelName}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500">{t('No lesson scheduled yet.', 'لم يُجدول درس بعد.')}</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {t('Follow up before Sunday', 'متابعة قبل الأحد')}
        </h3>
        <Link href="/dashboard/my-class" className="text-xs font-medium text-blue-700 hover:text-blue-800">
          {t('View full class →', 'عرض الفصل كاملاً →')}
        </Link>
      </div>

      {flagged.length === 0 ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            {t('All caught up', 'لا توجد متابعات')}
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {flagged.map(s => {
            const open = openStudent === s.studentId
            return (
              <div key={s.studentId} className="rounded-xl border border-amber-200 bg-white">
                <button type="button" onClick={() => setOpenStudent(open ? null : s.studentId)} className="flex w-full items-center gap-3 p-3 text-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-500">
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(s.photoUrl)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {lang === 'ar' ? `${s.firstNameAr || s.firstName} ${s.lastNameAr || s.lastName}` : `${s.firstName} ${s.lastName}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {s.followUpReasons.map(r => (
                        <span key={r} className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                          {REASON_LABEL[r] ? (lang === 'ar' ? REASON_LABEL[r].ar : REASON_LABEL[r].en) : r}
                        </span>
                      ))}
                      {s.likelyAbsent && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">{t('Likely absent', 'غائب غالباً')}</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-3 py-3">
                    {s.notes.length > 0 ? (
                      <ul className="space-y-2">
                        {s.notes.map((n, i) => (
                          <li key={i} className={`rounded-lg p-2 text-sm ${n.isPrivate ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'text-gray-600'}`}>
                            {n.note}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400">{t('No notes.', 'لا توجد ملاحظات.')}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}