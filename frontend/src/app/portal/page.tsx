'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Users, Calendar, ClipboardCheck, TrendingUp, Loader2, ChevronRight, Cross, Baby, UserPlus, Link2, Search, AlertCircle, Crown, Star, Trash2, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

interface ChildData {
  relationship: string
  isPrimary: boolean
  student: {
    id: string
    studentCode: string
    firstName: string
    lastName: string
    firstNameAr?: string
    lastNameAr?: string
    photoUrl?: string
    levelNumber: number
    levelName: string
    groupName: string
    status: string
    total: number
    present: number
    late: number
    absent: number
    excused: number
    upcomingSessions: number
    attendanceRate: number
    rank?: number
    totalStudents?: number
    totalPoints?: number
    badges?: number
    xpToNextLevel?: number
  }
}

const RELATIONSHIPS = [
  { value: 'father', en: 'Father', ar: 'أب' },
  { value: 'mother', en: 'Mother', ar: 'أم' },
  { value: 'guardian', en: 'Guardian', ar: 'ولي أمر' },
]

export default function PortalPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [children, setChildren] = useState<ChildData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schoolIdentity, setSchoolIdentity] = useState<{ name: string; nameAr?: string; churchName?: string; logoUrl?: string | null; churchLogoUrl?: string | null } | null>(null)

  const [studentCode, setStudentCode] = useState('')
  const [relationship, setRelationship] = useState('father')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [linkSuccess, setLinkSuccess] = useState('')

  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [unlinkConfirm, setUnlinkConfirm] = useState<{ id: string; name: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await http.get<any[]>('/parents/me/children')
      setChildren(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    http.get<any>('/users/schools/me').then(s => {
      const churchName = s?.church?.name || s?.church?.schoolNameEn || ''
      const name = s?.church?.schoolNameEn || s?.name || ''
      const nameAr = s?.church?.schoolNameAr || s?.nameAr || ''
      const churchLogoUrl = s?.church?.logoUrl ? API_ORIGIN + s.church.logoUrl : null
      const logoUrl = s?.logoUrl ? API_ORIGIN + s.logoUrl : null
      setSchoolIdentity({ name, nameAr, churchName, logoUrl, churchLogoUrl })
    }).catch(() => {})
  }, [refresh])

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLinking(true)
    setLinkError('')
    setLinkSuccess('')
    try {
      await http.post('/parents/me/children/link', { studentCode: studentCode.trim(), relationship })
      setStudentCode('')
      setRelationship('father')
      setLinkSuccess(t('Child linked successfully', 'تم ربط الطالب بنجاح'))
      await refresh()
    } catch (err: any) {
      setLinkError(err.message || t('Could not link child', 'تعذر ربط الطالب'))
    }
    setLinking(false)
  }

  const handleUnlink = async () => {
    if (!unlinkConfirm) return
    const studentId = unlinkConfirm.id
    setUnlinking(studentId)
    setUnlinkConfirm(null)
    try {
      const d = await http.delete<ChildData[]>(`/parents/me/children/${studentId}`)
      setChildren(d || [])
      toast('success', t('Child unlinked', 'تم فك الربط'))
    } catch (e: any) {
      toast('error', e?.message || t('Failed to unlink', 'تعذر فك الربط'))
    }
    setUnlinking(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
    </div>
  )

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-red-700">{error}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* School branding hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 p-6 sm:p-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-400/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="relative flex items-start gap-4">
          {schoolIdentity?.churchLogoUrl ? (
            <Image src={schoolIdentity.churchLogoUrl} alt={schoolIdentity.churchName || 'Church'} width={56} height={56}
              className="rounded-2xl border-2 border-white/20 object-cover flex-shrink-0" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 border-2 border-white/20 flex-shrink-0">
              <Baby className="h-7 w-7 text-indigo-200" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('My Children', 'أبنائي')}</h1>
            {schoolIdentity && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {schoolIdentity.churchName && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90">
                    {schoolIdentity.churchName}
                  </span>
                )}
                {schoolIdentity.churchName && schoolIdentity.name && (
                  <span className="text-white/30">·</span>
                )}
                {schoolIdentity.name && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
                    {schoolIdentity.logoUrl && (
                      <Image src={schoolIdentity.logoUrl} alt="" width={14} height={14} className="rounded" />
                    )}
                    {lang === 'ar' && schoolIdentity.nameAr ? schoolIdentity.nameAr : schoolIdentity.name}
                  </span>
                )}
              </div>
            )}
            <p className="text-indigo-200/80 text-sm mt-3">
              {t('Your children appear automatically when their record uses your login email, or link them manually by student code.',
                'يظهر أبناؤك تلقائياً إذا كان بريدهم مسجلاً ببريدك، أو اربطهم يدوياً بكود الطالب.')}
            </p>
          </div>
        </div>
      </div>

      {/* Link form */}
      <form onSubmit={handleLink} className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-sm font-semibold text-blue-800 mb-1">{t('Link a child', 'ربط طالب')}</h2>
        <p className="text-xs text-blue-700/80 mb-3">{t("Enter the student code from your child's enrollment card to connect their account.", 'أدخل كود الطالب الموجود ببطاقة التسجيل لربط حسابه.')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={studentCode}
              onChange={e => setStudentCode(e.target.value)}
              placeholder={t('Student code (e.g. STU-0001)', 'كود الطالب (مثال STU-0001)')}
              className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2.5 text-sm focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200"
            />
          </div>
          <select
            value={relationship}
            onChange={e => setRelationship(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200 sm:w-48"
          >
            {RELATIONSHIPS.map(r => (
              <option key={r.value} value={r.value}>{t(r.en, r.ar)}</option>
            ))}
          </select>
          <Button
            type="submit"
            disabled={linking || !studentCode.trim()}
          >
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {t('Link child', 'ربط')}
          </Button>
        </div>
        {linkError && <p className="mt-2 text-xs text-red-600">{linkError}</p>}
        {linkSuccess && <p className="mt-2 text-xs text-green-600">{linkSuccess}</p>}
      </form>

      {children.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Users className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('No children linked', 'لا يوجد أبناء مرتبطون')}</h3>
          <p className="text-sm text-gray-500">{t('Your account is not linked to any students. Contact the school administrator.', 'حسابك غير مرتبط بأي طلاب. تواصل مع إدارة المدرسة.')}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {children.map(child => {
            const s = child.student
            const primaryName = (lang === 'ar' && s.firstNameAr)
              ? `${s.firstNameAr} ${s.lastNameAr}`
              : `${s.firstName} ${s.lastName}`
            const secondaryName = (lang === 'ar' && s.firstNameAr)
              ? `${s.firstName} ${s.lastName}`
              : (s.firstNameAr ? `${s.firstNameAr} ${s.lastNameAr}` : '')
            const relLabel = RELATIONSHIPS.find(r => r.value === child.relationship)
            return (
            <div key={s.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-all group">
              <Link href={`/portal/children/${s.id}`} className="block p-5 pb-3">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 text-lg font-bold overflow-hidden">
                    {s.photoUrl ? (
                      <Image src={API_ORIGIN + s.photoUrl} alt="" width={56} height={56} className="h-full w-full object-cover" />
                    ) : (
                      <span>{s.firstName[0]}{s.lastName[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{primaryName}</h3>
                      {secondaryName && (
                        <span className="text-sm text-gray-400 font-medium truncate">{secondaryName}</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gold-500 transition-colors ml-auto shrink-0 rtl:rotate-180" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {relLabel && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 capitalize">
                          {t(relLabel.en, relLabel.ar)}
                        </span>
                      )}
                      {child.isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          <Crown className="h-3 w-3" />{t('Primary', 'أساسي')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                  <span>Level {s.levelNumber} — {s.groupName}</span>
                  <span>Code: {s.studentCode}</span>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  <div className="rounded-lg bg-green-50 p-2 text-center">
                    <div className="text-sm font-bold text-green-700">{s.attendanceRate}%</div>
                    <div className="text-[10px] text-green-600">{t('Attend.', 'حضور')}</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2 text-center">
                    <div className="text-sm font-bold text-blue-700">{s.total}</div>
                    <div className="text-[10px] text-blue-600">{t('Total', 'إجمالي')}</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2 text-center">
                    <div className="text-sm font-bold text-amber-700">{s.absent}</div>
                    <div className="text-[10px] text-amber-600">{t('Absent', 'غائب')}</div>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-2 text-center">
                    <div className="text-sm font-bold text-purple-700">{s.upcomingSessions}</div>
                    <div className="text-[10px] text-purple-600">{t('Upcoming', 'قادم')}</div>
                  </div>
                </div>

                {(s.rank != null || s.totalPoints != null || s.badges != null) && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg bg-gradient-to-r from-blue-50 to-amber-50 border border-gold-100 px-3 py-2">
                    {s.rank != null && s.totalStudents != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-700">
                        <Award className="h-3.5 w-3.5 text-blue-600" />
                        #{s.rank}/{s.totalStudents}
                      </span>
                    )}
                    {s.totalPoints != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-700">
                        <Star className="h-3.5 w-3.5 text-blue-600" />
                        {s.totalPoints} XP
                      </span>
                    )}
                    {s.badges != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-700">
                        <Crown className="h-3.5 w-3.5 text-blue-600" />
                        {s.badges} {t('badges', 'شارات')}
                      </span>
                    )}
                  </div>
                )}
              </Link>
              <div className="px-5 pb-4 flex items-center justify-between gap-2">
                <Link href={`/portal/children/${s.id}/home`} className="flex-1">
                  <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/50 transition-all active:scale-95">
                    <span>🎵</span>
                    <span>{lang === 'ar' ? `عرض ${s.firstNameAr || s.firstName}` : `${s.firstName}'s View`}</span>
                  </button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.preventDefault(); setUnlinkConfirm({ id: s.id, name: primaryName }) }}
                  className="text-xs text-gray-400 hover:text-red-600 shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!unlinkConfirm}
        onClose={() => setUnlinkConfirm(null)}
        variant="danger"
        title={t('Unlink Student', 'فك رابط الطالب')}
        message={unlinkConfirm ? t(`Are you sure you want to unlink ${unlinkConfirm.name}?`, `هل أنت متأكد من فك رابط ${unlinkConfirm.name}؟`) : ''}
        confirmLabel={t('Unlink', 'فك الربط')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={unlinking === unlinkConfirm?.id}
        onConfirm={handleUnlink}
      />
    </div>
  )
}
