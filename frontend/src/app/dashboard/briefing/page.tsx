'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Sun, BookOpen, AlertTriangle, User, ChevronDown, CheckCircle2, FileText, Presentation, Clock } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { assetUrl } from '@/lib/asset-url'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { AudioPlayer } from '@/components/audio-player'

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
    subjectColor?: string | null
    subjectItemId?: string | null
    audioUrl?: string | null
    hazzat?: string | null
    presentationUrl?: string | null
  } | null
  roster: RosterStudent[]
}

const REASON_LABEL: Record<string, { en: string; ar: string }> = {
  overdue_review: { en: 'Review due', ar: 'مراجعة مستحقة' },
  low_mastery: { en: 'New lesson', ar: 'درس جديد' },
  absent_3plus: { en: 'Missed 3+', ar: 'تغيب 3+' },
  ungraded_assessment: { en: 'To grade', ar: 'بانتظار التقييم' },
}

// Resolve a readable subject chip (color comes from settings). Falls back to a neutral gray chip.
// Uses inline styles (not dynamic Tailwind classes) so any hex color renders correctly.
function subjectChipStyle(hex?: string | null): React.CSSProperties {
  if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex)) {
    return { backgroundColor: '#f3f4f6', color: '#374151' };
  }
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Light colors (incl. white) need a dark foreground; dark colors get white text.
  if (luminance > 0.6) return { backgroundColor: `#${c}26`, color: '#1f2937' };
  return { backgroundColor: `#${c}`, color: '#ffffff' };
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

  // Georgian date + countdown. Anchor to the scheduled session when present,
  // otherwise fall back to the next calendar Sunday so the header always shows
  // the same "season · coptic date / date / countdown" pattern as students see.
  const nextSundayDate = data?.nextSession?.scheduledDate
    ? new Date(data.nextSession.scheduledDate)
    : (() => {
        const d = new Date()
        const untilSunday = (7 - d.getDay()) % 7
        d.setDate(d.getDate() + untilSunday)
        d.setHours(9, 0, 0, 0)
        return d
      })()
  const georgianLabel = nextSundayDate
    ? nextSundayDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''
  const countdownLabel = (() => {
    if (!nextSundayDate) return null
    const diffMs = nextSundayDate.getTime() - Date.now()
    if (diffMs <= 0) return null
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) return t(`in ${days}d ${hours}h`, `بعد ${days}ي ${hours}س`)
    return t(`in ${hours}h`, `بعد ${hours}س`)
  })()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Student-style header: season · coptic date (left), georgian + countdown (right) */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <Sun className="h-5 w-5 text-gold-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-gray-900">{t('This Sunday', 'أحد الأسبوع')}</h1>
              <p className="text-xs text-gold-700 mt-0.5 truncate">
                {data?.coptic
                  ? `${lang === 'ar' ? data.coptic.seasonLabel.ar : data.coptic.seasonLabel.en} · ${lang === 'ar' ? `${copticLabel}` : `${copticLabel}`}`
                  : t('Regular Season', 'الزمن العادي')}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-500">{georgianLabel}</div>
            {countdownLabel && (
              <div className="flex items-center gap-1 justify-end mt-0.5 text-xs text-blue-600 font-medium">
                <Clock className="h-3 w-3" />
                {countdownLabel}
              </div>
            )}
          </div>
        </div>
        {data?.coptic?.feastFast && (
          <span className="mt-2 inline-block rounded-full bg-gold-600 px-3 py-1 text-xs font-semibold text-gray-950">
            {lang === 'ar' ? data.coptic.feastFast.ar : data.coptic.feastFast.en}
          </span>
        )}
      </div>

      {data?.nextSession && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('Next session', 'الجلسة القادمة')}</div>
            <div className="mt-1 text-sm text-gray-900">
              {data.nextSession.groupName} · {data.nextSession.levelName} ·{' '}
              {new Date(data.nextSession.scheduledDate).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </div>
            {countdownLabel && (
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 font-medium">
                <Clock className="h-3 w-3" />
                {countdownLabel}
              </div>
            )}
          </div>
          <Link
            href={`/dashboard/attendance?sessionId=${data.nextSession.id}&prefill=present${data.nextLesson?.subjectItemId ? `&subjectItemId=${data.nextLesson.subjectItemId}` : ''}`}
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
          (() => {
            const nl = data.nextLesson
            const chip = subjectChipStyle(nl.subjectColor)
            return (
              <>
                <h2 className="mt-2 text-lg font-bold text-gray-900">
                  {lang === 'ar' ? nl.titleAr || nl.title : nl.title}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  {nl.titleCoptic && <span className="coptic-text">{nl.titleCoptic}</span>}
                  {nl.subjectName && (
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold" style={chip}>
                      {nl.subjectName}
                    </span>
                  )}
                  {nl.levelName && <span>· {nl.levelName}</span>}
                </p>

                {(nl.audioUrl || nl.hazzat || nl.presentationUrl) && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {nl.audioUrl && <AudioPlayer src={assetUrl(nl.audioUrl)} compact />}
                    {nl.hazzat && (
                      <a
                        href={assetUrl(nl.hazzat)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <FileText className="h-4 w-4" /> {t('Hazzat', 'الحزّات')}
                      </a>
                    )}
                    {nl.presentationUrl && (
                      <a
                        href={assetUrl(nl.presentationUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <Presentation className="h-4 w-4" /> {t('PowerPoint', 'باور بوينت')}
                      </a>
                    )}
                  </div>
                )}
              </>
            )
          })()
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