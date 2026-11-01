'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Download } from 'lucide-react'
import { http } from '@/lib/http-client'
import { downloadCsv } from '@/lib/csv'
import { usePermission } from '@/lib/use-permission'

export interface UnitRow {
  id: string; name: string; nameAr: string | null; students: number
  attendanceRate: number | null; prevAttendanceRate: number | null
  atRisk: number; passRate: number | null; gradedCount: number
}
interface Overview { windowDays: number; attendanceTarget: number; levels: UnitRow[]; groups: UnitRow[] }

type Kind = 'levels' | 'groups'
type Sort = 'attention' | 'attendance' | 'atRisk' | 'students'

const WINDOWS = [7, 30, 90] as const

/** Lower attendance first, units with no attendance data last, so "needs attention" really is first. */
function sortRows(rows: UnitRow[], sort: Sort): UnitRow[] {
  const copy = [...rows]
  switch (sort) {
    case 'attendance':
      return copy.sort((a, b) => (a.attendanceRate ?? 101) - (b.attendanceRate ?? 101))
    case 'atRisk':
      return copy.sort((a, b) => b.atRisk - a.atRisk)
    case 'students':
      return copy.sort((a, b) => b.students - a.students)
    default:
      // Attention: most at-risk share first, then lowest attendance.
      return copy.sort((a, b) => {
        const ra = a.students ? a.atRisk / a.students : 0
        const rb = b.students ? b.atRisk / b.students : 0
        return rb - ra || (a.attendanceRate ?? 101) - (b.attendanceRate ?? 101)
      })
  }
}

export function LevelGroupSection({ schoolId, lang }: { schoolId: string; lang: string }) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [days, setDays] = useState<number>(30)
  const [kind, setKind] = useState<Kind>('levels')
  const [sort, setSort] = useState<Sort>('attention')
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const { can } = usePermission()
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    try { setIsAdmin(((JSON.parse(localStorage.getItem('user') || '{}').roles || []) as string[]).some(r => r === 'super_admin' || r === 'admin')) } catch {}
  }, [])

  useEffect(() => {
    let live = true
    setLoading(true); setError(false)
    http.get<Overview>('/reports/level-group-overview', { schoolId, days: String(days) })
      .then(d => { if (live) { setData(d); setLoading(false) } })
      .catch(() => { if (live) { setError(true); setLoading(false) } })
    return () => { live = false }
  }, [schoolId, days, tick])

  const rows = useMemo(() => sortRows(data?.[kind] ?? [], sort), [data, kind, sort])
  const param = kind === 'levels' ? 'levelId' : 'groupId'
  const nameOf = (r: UnitRow) => (lang === 'ar' && r.nameAr ? r.nameAr : r.name)

  const exportCsv = () => {
    if (!data) return
    const name = (r: UnitRow) => (lang === 'ar' && r.nameAr ? r.nameAr : r.name)
    const head = lang === 'ar'
      ? [kind === 'levels' ? 'المرحلة' : 'المجموعة', 'الطلاب النشطون', 'الحضور %', 'الحضور في الفترة السابقة %', 'في خطر', 'نسبة النجاح %', 'عدد المُقيَّم']
      : [kind === 'levels' ? 'Level' : 'Group', 'Active students', 'Attendance %', 'Previous window attendance %', 'At risk', 'Pass rate %', 'Graded']
    downloadCsv(
      `${kind}-comparison-${data.windowDays}d-${new Date().toISOString().split('T')[0]}.csv`,
      [head, ...rows.map(r => [name(r), r.students, r.attendanceRate, r.prevAttendanceRate, r.atRisk, r.passRate, r.gradedCount])],
    )
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold min-h-9 ${active ? 'border-gold-500 bg-gold-50 text-gold-800' : 'border-gray-200 bg-white text-gray-600'}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('Compare', 'قارن')} className="flex gap-2">
          <button type="button" aria-pressed={kind === 'levels'} onClick={() => setKind('levels')} className={chip(kind === 'levels')}>{t('Levels', 'المراحل')}</button>
          <button type="button" aria-pressed={kind === 'groups'} onClick={() => setKind('groups')} className={chip(kind === 'groups')}>{t('Groups', 'المجموعات')}</button>
        </div>
        <div role="group" aria-label={t('Time window', 'الفترة')} className="flex gap-2">
          {WINDOWS.map(w => (
            <button key={w} type="button" aria-pressed={days === w} onClick={() => setDays(w)} className={chip(days === w)}>
              {t(`${w} days`, `${w} يومًا`)}
            </button>
          ))}
        </div>
        {can('reports:export') && data && rows.length > 0 && (
          <button type="button" onClick={exportCsv} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-300">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />{t('Export CSV', 'تصدير CSV')}
          </button>
        )}
        <label className="ms-auto flex items-center gap-2 text-xs text-gray-500">
          {t('Sort', 'ترتيب')}
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800">
            <option value="attention">{t('Needs attention first', 'الأحوج للاهتمام أولًا')}</option>
            <option value="attendance">{t('Lowest attendance', 'الأقل حضورًا')}</option>
            <option value="atRisk">{t('Most at risk', 'الأكثر في خطر')}</option>
            <option value="students">{t('Most students', 'الأكثر طلابًا')}</option>
          </select>
        </label>
      </div>

      {isAdmin && data && <TargetEditor schoolId={schoolId} target={data.attendanceTarget} lang={lang} onSaved={() => setTick(k => k + 1)} />}

      {loading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}</div>}

      {!loading && (error || !data) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{t('Failed to load the comparison.', 'فشل تحميل المقارنة.')}</p>
          <button type="button" onClick={() => setTick(k => k + 1)} className="mt-2 text-xs text-red-500 underline">{t('Retry', 'إعادة المحاولة')}</button>
        </div>
      )}

      {!loading && data && rows.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
          {kind === 'levels' ? t('No levels set up yet.', 'لم تُنشأ مراحل بعد.') : t('No groups set up yet.', 'لم تُنشأ مجموعات بعد.')}
        </div>
      )}

      {!loading && data && rows.length > 0 && (
        <>
          <p className="text-[11px] text-gray-500">
            {t(`Target ${data.attendanceTarget}% (red = below). Attendance and pass rate cover the last ${data.windowDays} days (class sessions only); the arrow compares with the ${data.windowDays} days before. A dash means nothing was recorded.`,
               `الهدف ${data.attendanceTarget}٪ (الأحمر = أقل منه). الحضور ونسبة النجاح لآخر ${data.windowDays} يومًا (الحصص فقط)، والسهم يقارن بالـ ${data.windowDays} يومًا السابقة. الشرطة تعني عدم وجود تسجيل.`)}
          </p>
          <ul className="space-y-3" aria-label={kind === 'levels' ? t('Levels', 'المراحل') : t('Groups', 'المجموعات')}>
            {rows.map(r => {
              const delta = r.attendanceRate !== null && r.prevAttendanceRate !== null ? r.attendanceRate - r.prevAttendanceRate : null
              const target = data.attendanceTarget
              const low = r.attendanceRate !== null && r.attendanceRate < target
              return (
                <li key={r.id} className={`rounded-xl border bg-white p-4 ${low || r.atRisk > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-gray-900">{nameOf(r)}</h3>
                      <p className="text-[11px] text-gray-500">{t(`${r.students} active students`, `${r.students} طالبًا نشطًا`)}</p>
                    </div>
                    <Link href={`/dashboard/students?${param}=${r.id}`} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 text-xs font-semibold text-gold-700 hover:underline" aria-label={t(`View students in ${nameOf(r)}`, `عرض طلاب ${nameOf(r)}`)}>
                      {t('Students', 'الطلاب')} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                    </Link>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dt className="text-[11px] text-gray-500">{t('Attendance', 'الحضور')}</dt>
                      <dd className={`text-lg font-black tabular-nums ${low ? 'text-red-600' : 'text-gray-900'}`} title={low ? t(`Below the ${target}% target`, `أقل من هدف ${target}٪`) : undefined}>
                        {r.attendanceRate === null ? '—' : `${r.attendanceRate}%`}
                      </dd>
                      {delta !== null && delta !== 0 && (
                        <dd className={`inline-flex items-center text-[11px] font-bold ${delta > 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {delta > 0 ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                          <span className="sr-only">{delta > 0 ? t('up', 'ارتفع') : t('down', 'انخفض')}</span>{Math.abs(delta)}
                        </dd>
                      )}
                    </div>
                    <div>
                      <dt className="text-[11px] text-gray-500">{t('At risk', 'في خطر')}</dt>
                      <dd className="text-lg font-black tabular-nums">
                        {r.atRisk > 0 ? (
                          <Link href={`/dashboard/students?${param}=${r.id}&engagement=at_risk`} className="inline-flex items-center gap-1 text-red-600 hover:underline" aria-label={t(`${r.atRisk} at risk in ${nameOf(r)} — view`, `${r.atRisk} في خطر في ${nameOf(r)} — عرض`)}>
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{r.atRisk}
                          </Link>
                        ) : <span className="text-gray-900">0</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-gray-500">{t('Pass rate', 'نسبة النجاح')}</dt>
                      <dd className="text-lg font-black tabular-nums text-gray-900">{r.passRate === null ? '—' : `${r.passRate}%`}</dd>
                      {r.gradedCount > 0 && <dd className="text-[11px] text-gray-500">{t(`${r.gradedCount} graded`, `${r.gradedCount} مُقيَّم`)}</dd>}
                    </div>
                  </dl>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

/** Admins set the attendance goal that the dashboard, trend line and this comparison all use. */
function TargetEditor({ schoolId, target, lang, onSaved }: { schoolId: string; target: number; lang: string; onSaved: () => void }) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [value, setValue] = useState(String(target))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<'saved' | 'error' | null>(null)
  useEffect(() => { setValue(String(target)) }, [target])

  const n = Number(value)
  const valid = Number.isInteger(n) && n >= 1 && n <= 100
  const save = async () => {
    if (!valid || n === target) return
    setSaving(true); setMsg(null)
    try {
      await http.post(`/users/schools/${schoolId}/config`, { key: 'attendance_target', value: n, description: 'Attendance goal (%) shown on the dashboard and reports' })
      setMsg('saved'); onSaved()
    } catch { setMsg('error') } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600">
      <label htmlFor="attendance-target" className="font-semibold text-gray-800">{t('Attendance target', 'هدف الحضور')}</label>
      <input id="attendance-target" type="number" inputMode="numeric" min={1} max={100} value={value} onChange={e => { setValue(e.target.value); setMsg(null) }}
        aria-invalid={!valid} className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
      <span>%</span>
      <button type="button" onClick={save} disabled={!valid || saving || n === target}
        className="min-h-9 rounded-lg bg-gold-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40">{t('Save', 'حفظ')}</button>
      {!valid && <span role="alert" className="text-red-600">{t('Enter a whole number from 1 to 100', 'أدخل رقمًا صحيحًا من 1 إلى 100')}</span>}
      {msg === 'saved' && <span role="status" className="text-green-700">{t('Saved', 'تم الحفظ')}</span>}
      {msg === 'error' && <span role="alert" className="text-red-600">{t('Could not save', 'تعذّر الحفظ')}</span>}
    </div>
  )
}
