'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, AlertTriangle, BookOpen, User, CalendarDays } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { assetUrl } from '@/lib/asset-url'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface Note { category?: string; note?: string; isPrivate: boolean; createdAt: string }
interface RosterStudent {
  studentId: string
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  photoUrl?: string
  attendanceRate: number
  lastAttendanceStatus: string | null
  likelyAbsent: boolean
  needsFollowUp: boolean
  followUpReasons: string[]
  notes: Note[]
}
interface ClassOverview {
  servant: { id: string; firstName?: string; lastName?: string }
  nextSession: {
    id: string; scheduledDate: string; levelId?: string; levelName?: string; levelNumber?: number; groupId?: string; groupName?: string
  } | null
  todayLesson: {
    lessonId: string; title: string; titleAr?: string; titleCoptic?: string; levelName?: string; subjectName?: string; scheduledDate?: string
  } | null
  roster: RosterStudent[]
}

const REASON_LABEL: Record<string, { en: string; ar: string }> = {
  overdue_review: { en: 'Review due', ar: 'مراجعة مستحقة' },
  low_mastery: { en: 'New lesson', ar: 'درس جديد' },
  absent_3plus: { en: 'Missed 3+', ar: 'تغيب 3+' },
  ungraded_assessment: { en: 'To grade', ar: 'بانتظار التقييم' },
}

const STATUS_BADGE: Record<string, { en: string; ar: string; cls: string }> = {
  present: { en: 'Present', ar: 'حاضر', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  late: { en: 'Late', ar: 'متأخر', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  absent: { en: 'Absent', ar: 'غائب', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export default function MyClassPage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [data, setData] = useState<ClassOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openStudent, setOpenStudent] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(false)
    setLoading(true)
    http.get<ClassOverview>('/dashboard/class-overview')
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flagged = (data?.roster ?? []).filter(s => s.likelyAbsent || s.needsFollowUp)
  const settled = (data?.roster ?? []).filter(s => !(s.likelyAbsent || s.needsFollowUp))

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6"><div className="h-6 w-40 bg-gray-200 rounded animate-pulse" /></div>
        <TableSkeleton rows={5} cols={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('My Class', 'صفي')}</h1>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title={t("Couldn't load your class", 'تعذر تحميل الفصل')}
            description={t('Something went wrong. Please try again.', 'حدث خطأ ما. حاول مرة أخرى.')}
            action={
              <button
                type="button"
                onClick={load}
                className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-gold-600 transition-colors"
              >
                {t('Retry', 'إعادة المحاولة')}
              </button>
            }
          />
        </div>
      </div>
    )
  }

  if (!data || (data.roster.length === 0 && !data.todayLesson)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('My Class', 'صفي')}</h1>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white">
          <EmptyState title={t('No class yet', 'لا توجد فصول بعد')} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('My Class', 'صفي')}</h1>
          {data.nextSession && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
              <CalendarDays className="h-4 w-4" />
              {data.nextSession.groupName} · {data.nextSession.levelName} ·{' '}
              {new Date(data.nextSession.scheduledDate).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400">{data.roster.length} {t('students', 'طالب')}</span>
      </div>

      {data.todayLesson && (
        <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-700">
            <BookOpen className="h-4 w-4" />
            {t("Today's lesson", 'درس اليوم')}
          </div>
          <h2 className="mt-2 text-lg font-bold text-gray-900">{lang === 'ar' ? data.todayLesson.titleAr || data.todayLesson.title : data.todayLesson.title}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {data.todayLesson.titleCoptic && <span className="coptic-text">{data.todayLesson.titleCoptic} · </span>}
            {data.todayLesson.subjectName} · {data.todayLesson.levelName}
          </p>
        </div>
      )}

      {flagged.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t('Needs attention', 'بحاجة لانتباه')}
          </h3>
          <div className="space-y-2">{flagged.map(s => renderRow(s))}</div>
        </div>
      )}

      {settled.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('Class', 'الفصل')}</h3>
          <div className="space-y-2">{settled.map(s => renderRow(s))}</div>
        </div>
      )}
    </div>
  )

  function renderRow(s: RosterStudent) {
    const open = openStudent === s.studentId
    return (
      <div key={s.studentId} className={`rounded-xl border bg-white ${s.likelyAbsent || s.needsFollowUp ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'}`}>
        <button
          type="button"
          onClick={() => setOpenStudent(open ? null : s.studentId)}
          className="flex w-full items-center gap-3 p-3 text-left"
        >
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
            <div className="mt-1 h-1.5 w-32 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.attendanceRate}%` }} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {s.lastAttendanceStatus && (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[s.lastAttendanceStatus]?.cls ?? 'border-gray-200 text-gray-600'}`}>
                {STATUS_BADGE[s.lastAttendanceStatus] ? (lang === 'ar' ? STATUS_BADGE[s.lastAttendanceStatus].ar : STATUS_BADGE[s.lastAttendanceStatus].en) : s.lastAttendanceStatus}
              </span>
            )}
            {s.likelyAbsent && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">{t('Likely absent', 'غائب غالباً')}</span>
            )}
            {s.needsFollowUp && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">{t('Follow up', 'متابعة')}</span>
            )}
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {open && (
          <div className="border-t border-gray-100 px-3 py-3">
            <div className="flex flex-wrap gap-1.5">
              {s.followUpReasons.map(r => (
                <span key={r} className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {REASON_LABEL[r] ? (lang === 'ar' ? REASON_LABEL[r].ar : REASON_LABEL[r].en) : r}
                </span>
              ))}
            </div>
            {s.notes.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {s.notes.map((n, i) => (
                  <li key={i} className={`rounded-lg p-2 text-sm ${n.isPrivate ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'text-gray-600'}`}>
                    {n.note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-gray-400">{t('No notes.', 'لا توجد ملاحظات.')}</p>
            )}
          </div>
        )}
      </div>
    )
  }
}