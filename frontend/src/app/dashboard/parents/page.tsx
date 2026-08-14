'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { motion } from 'motion/react'
import {
  Baby, UserPlus, Link2, AlertCircle, Search,
  CalendarClock, UserCheck, Crown, Trash2, Star,
  ClipboardCheck, Loader2,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import DashboardHero from '../hero'

interface ChildStudent {
  id: string
  studentCode: string
  firstName: string
  lastName: string
  photoUrl?: string | null
  levelNumber?: number
  levelName?: string
  groupName?: string
  gradeName?: string
  status?: string
  present: number
  late: number
  absent: number
  total: number
  totalPoints?: number
  badges?: number
  attendanceRate: number
  upcomingSessions: number
  rank?: number
  totalStudents?: number
  xpToNextLevel?: number
}

interface LinkedChild {
  relationship: string
  isPrimary: boolean
  student: ChildStudent
}

interface ChildAssessment {
  id: string
  assessmentId: string
  title: string
  titleAr?: string
  subject?: string
  subjectAr?: string
  status: string
  score: number
  maxScore: number
  percentage: number
  passed: boolean
  gradedAt?: string | null
  referenceRecordingUrl?: string | null
  referenceRecordingName?: string | null
}

const RELATIONSHIPS = [
  { value: 'father', en: 'Father', ar: 'أب' },
  { value: 'mother', en: 'Mother', ar: 'أم' },
  { value: 'guardian', en: 'Guardian', ar: 'ولي أمر' },
]

function ChildAssessments({ studentId, lang }: { studentId: string; lang: string }) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [assessments, setAssessments] = useState<ChildAssessment[] | null>(null)

  useEffect(() => {
    let active = true
    setAssessments(null)
    http.get<ChildAssessment[]>(`/parents/me/children/${studentId}/assessments`)
      .then((d) => { if (active) setAssessments(d || []) })
      .catch(() => { if (active) setAssessments([]) })
    return () => { active = false }
  }, [studentId])

  if (assessments === null) {
    return <Skeleton className="h-16 w-full" />
  }

  if (assessments.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">{t('No assessment results yet', 'لا توجد نتائج تقييم بعد')}</p>
    )
  }

  return (
    <div className="space-y-3">
      {assessments.map((a) => (
        <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h5 className="font-semibold text-gray-900">{lang === 'ar' && a.titleAr ? a.titleAr : a.title}</h5>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                {a.subject && <span>{a.subject}</span>}
                <span className={`font-medium ${a.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {a.passed ? t('Passed', 'ناجح') : t('Not passed', 'غير ناجح')}
                </span>
                <span>{t('Score', 'الدرجة')}: {a.score}/{a.maxScore} ({a.percentage}%)</span>
              </div>
            </div>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
              a.percentage >= 80 ? 'bg-green-100 text-green-700' :
              a.percentage >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {a.percentage}%
            </div>
          </div>
          {a.referenceRecordingUrl && (
            <div className="mt-2">
              <div className="text-xs text-gray-500">{t('Reference recording', 'تسجيل المرجع')}</div>
              <audio controls src={a.referenceRecordingUrl} className="w-full" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ParentsPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const [children, setChildren] = useState<LinkedChild[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [schoolIdentity, setSchoolIdentity] = useState<{ name: string; nameAr?: string; churchName?: string; logoUrl?: string | null; churchLogoUrl?: string | null } | null>(null)
  const [code, setCode] = useState('')
  const [rel, setRel] = useState('father')
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unlinkConfirm, setUnlinkConfirm] = useState<{ id: string; name: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    http.get<LinkedChild[]>('/parents/me/children')
      .then((d) => { setChildren(d || []); setLoading(false) })
      .catch(() => { setError(lang === 'ar' ? 'تعذر تحميل الأبناء' : 'Failed to load children'); setLoading(false) })
  }, [lang])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    http.get<any>('/users/schools/me').then(s => {
      const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'
      const churchName = s?.church?.name || s?.church?.schoolNameEn || ''
      const name = s?.church?.schoolNameEn || s?.name || ''
      const nameAr = s?.church?.schoolNameAr || s?.nameAr || ''
      const churchLogoUrl = s?.church?.logoUrl ? (s.church.logoUrl.startsWith('http') ? s.church.logoUrl : API_ORIGIN + s.church.logoUrl) : null
      const logoUrl = s?.logoUrl ? (s.logoUrl.startsWith('http') ? s.logoUrl : API_ORIGIN + s.logoUrl) : null
      setSchoolIdentity({ name, nameAr, churchName, logoUrl, churchLogoUrl })
    }).catch(() => {})
  }, [])

  const link = async () => {
    const value = code.trim()
    if (!value) return
    setLinking(true)
    setError(null)
    try {
      const d = await http.post<LinkedChild[]>('/parents/me/children/link', { studentCode: value, relationship: rel })
      setChildren(d || [])
      setCode('')
      toast('success', lang === 'ar' ? 'تم ربط الطالب بحسابك' : 'Child linked to your account')
    } catch (e: any) {
      const msg = e?.message || (lang === 'ar' ? 'تعذر الربط' : 'Failed to link child')
      setError(msg)
      toast('error', msg)
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkConfirm = async () => {
    if (!unlinkConfirm) return
    const { id: studentId, name } = unlinkConfirm
    setUnlinking(studentId)
    setUnlinkConfirm(null)
    try {
      const d = await http.delete<LinkedChild[]>(`/parents/me/children/${studentId}`)
      setChildren(d || [])
      toast('success', lang === 'ar' ? 'تم فك الربط' : 'Child unlinked')
    } catch (e: any) {
      toast('error', e?.message || (lang === 'ar' ? 'تعذر فك الربط' : 'Failed to unlink child'))
    } finally {
      setUnlinking(null)
    }
  }

  return (
    <div className="space-y-6">
      <title>{lang === 'ar' ? 'أولادي' : 'My Children'} — Coptic Orthodox Hymn Education Platform (COHEP)</title>

      <DashboardHero
        bg="var(--hymn-indigo)"
        orbTint="bg-indigo-500/10"
        avatar={
          schoolIdentity?.churchLogoUrl ? (
            <Image src={schoolIdentity.churchLogoUrl} alt={schoolIdentity.churchName || 'Church'} width={56} height={56}
              className="h-14 w-14 object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center bg-white/10">
              <Baby className="h-7 w-7 text-indigo-200" />
            </div>
          )
        }
        title={lang === 'ar' ? 'أولادي' : 'My Children'}
        badges={
          schoolIdentity ? (
            <div className="flex flex-wrap items-center gap-2">
              {schoolIdentity.churchName && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90">
                  {schoolIdentity.churchName}
                </span>
              )}
              {schoolIdentity.churchName && schoolIdentity.name && <span className="text-white/30">·</span>}
              {schoolIdentity.name && (
                <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
                  {schoolIdentity.logoUrl && (
                    <Image src={schoolIdentity.logoUrl} alt="" width={14} height={14} className="rounded" />
                  )}
                  {lang === 'ar' && schoolIdentity.nameAr ? schoolIdentity.nameAr : schoolIdentity.name}
                </span>
              )}
            </div>
          ) : undefined
        }
        description={
          lang === 'ar'
            ? 'يظهر أبناؤك تلقائياً إذا كان بريدهم مسجلاً ببريدك، أو اربطهم يدوياً بكود الطالب.'
            : 'Your children appear automatically when their record uses your login email, or link them manually by student code.'
        }
      />

      {/* Link form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700">
            <UserPlus className="h-4 w-4" />
          </div>
          <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'ربط طالب' : 'Link a Child'}</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') link() }}
              placeholder={lang === 'ar' ? 'أدخل كود الطالب (مثل 18192)' : 'Enter student code (e.g. 18192)'}
              className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm shadow-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={rel}
            onChange={(e) => setRel(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>{lang === 'ar' ? r.ar : r.en}</option>
            ))}
          </select>
          <Button
            onClick={link}
            disabled={linking || !code.trim()}
          >
            <Link2 className="h-4 w-4" />
            {linking ? (lang === 'ar' ? 'جارٍ الربط…' : 'Linking…') : (lang === 'ar' ? 'ربط' : 'Link')}
          </Button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Children list */}
      {loading && !children ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : children && children.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState icon={Baby} title={lang === 'ar' ? 'لا يوجد أبناء مرتبطون' : 'No children linked'} description={lang === 'ar' ? 'إذا كان بريدك مسجلاً على سجل الطالب يظهر تلقائياً، أو استخدم النموذج أعلاه للربط بكود الطالب.' : 'Students with your email on their record appear automatically — or use the form above to link by student code.'} action={<Button onClick={() => (document.querySelector<HTMLInputElement>('input[type=\"text\"]'))?.focus()}>{lang === 'ar' ? 'ربط طالب' : 'Link a Child'}</Button>} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {children?.map((c, i) => {
            const s = c.student
            const initials = `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-4 p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 font-bold text-lg">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{s.firstName} {s.lastName}</h3>
                      {c.isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          <Crown className="h-3 w-3" />{lang === 'ar' ? 'أساسي' : 'Primary'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {lang === 'ar' ? 'كود' : 'Code'}: {s.studentCode}
                      {s.levelName ? ` · ${s.levelName}` : ''}{s.groupName ? ` · ${s.groupName}` : ''}
                      {s.gradeName ? ` · ${lang === 'ar' ? 'المرحلة' : 'Grade'}: ${s.gradeName}` : ''}
                    </p>
                  </div>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 capitalize">
                      {RELATIONSHIPS.find((r) => r.value === c.relationship) ? (lang === 'ar' ? RELATIONSHIPS.find((r) => r.value === c.relationship)!.ar : RELATIONSHIPS.find((r) => r.value === c.relationship)!.en) : c.relationship}
                    </span>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setUnlinkConfirm({ id: s.id, name: `${s.firstName} ${s.lastName}` })}
                      disabled={unlinking === s.id}
                      title={lang === 'ar' ? 'فك الربط' : 'Unlink'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-amber-50 border border-gold-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                          <Star className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{lang === 'ar' ? 'الترتيب الشخصي' : 'Personal Rank'}</span>
                      </div>
                      {s.rank != null && s.totalStudents ? (
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="text-2xl font-bold text-blue-700">#{s.rank}</span>
                          <span className="text-sm text-gray-500">{lang === 'ar' ? `من ${s.totalStudents}` : `/ ${s.totalStudents}`}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mb-2">{lang === 'ar' ? 'غير متاح' : 'Unavailable'}</div>
                      )}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{lang === 'ar' ? 'إجمالي النقاط' : 'Total XP'}</span>
                          <span className="font-semibold text-gray-900">{s.totalPoints ?? 0}</span>
                        </div>
                        {s.totalPoints != null && (
                          <div className="h-1.5 rounded-full bg-gold-200/50 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-blue-500" style={{ width: `${Math.min(100, (s.totalPoints % 1000) / 10)}%` }} />
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{lang === 'ar' ? 'الشارات' : 'Badges'}</span>
                          <span className="font-semibold text-gray-900">{s.badges ?? 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                          <UserCheck className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{lang === 'ar' ? 'الحضور' : 'Attendance'}</span>
                      </div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className={`text-2xl font-bold ${s.attendanceRate >= 75 ? 'text-emerald-700' : s.attendanceRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{s.attendanceRate}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
                        <div className={`h-full rounded-full transition-all ${s.attendanceRate >= 75 ? 'bg-emerald-400' : s.attendanceRate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${s.attendanceRate}%` }} />
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />{lang === 'ar' ? 'حاضر' : 'Present'} <strong>{s.present}</strong></span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />{lang === 'ar' ? 'غائب' : 'Absent'} <strong>{s.absent}</strong></span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />{lang === 'ar' ? 'متأخر' : 'Late'} <strong>{s.late}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                        <CalendarClock className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm text-gray-700">{lang === 'ar' ? 'الجلسات القادمة' : 'Upcoming Sessions'}</span>
                    </div>
                    <span className="text-lg font-bold text-indigo-700">{s.upcomingSessions}</span>
                  </div>
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <ClipboardCheck className="h-4 w-4 text-gold-500" />
                      {lang === 'ar' ? 'التقييمات' : 'Assessments'}
                    </h4>
                    <ChildAssessments studentId={s.id} lang={lang} />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!unlinkConfirm}
        onClose={() => setUnlinkConfirm(null)}
        variant="danger"
        title={lang === 'ar' ? 'فك رابط الطالب' : 'Unlink Student'}
        message={unlinkConfirm ? (lang === 'ar' ? `هل أنت متأكد من فك رابط ${unlinkConfirm.name}؟` : `Are you sure you want to unlink ${unlinkConfirm.name}?`) : ''}
        confirmLabel={lang === 'ar' ? 'فك الربط' : 'Unlink'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        loading={unlinking === unlinkConfirm?.id}
        onConfirm={handleUnlinkConfirm}
      />
    </div>
  )
}


