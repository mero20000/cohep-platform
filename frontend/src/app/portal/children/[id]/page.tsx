'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import {
  Calendar, ClipboardCheck, TrendingUp, Loader2, ArrowLeft, User,
  CheckCircle2, Clock, XCircle, AlertCircle, Award, FileText,
  Star, Crown, Cross
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

interface AttendanceRecord {
  id: string; date: string; status: string; homeworkStatus: string; note?: string;
  levelNumber?: number; levelName?: string;
}

interface AssessmentResult {
  id: string; assessmentId: string; title: string; titleAr?: string;
  subject?: string; subjectAr?: string; status: string;
  score: number; maxScore: number; percentage: number; passed: boolean; gradedAt?: string;
}

interface ProgressData {
  sessions: { id: string; scheduledDate: string; levelId: string }[];
  assessments: { id: string; createdAt: string; grades: { score: number; maxScore: number }[] }[];
}

interface GamificationData {
  rank?: number; totalStudents?: number; totalPoints?: number; badges?: number; xpToNextLevel?: number;
}

type TabType = 'attendance' | 'assessments' | 'progress'

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700', late: 'bg-amber-100 text-amber-700',
  absent: 'bg-red-100 text-red-700', excused: 'bg-gray-100 text-gray-600',
}

export default function ChildDetailPage() {
  const { id } = useParams()
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', lang)
  }, [lang])

  const [tab, setTab] = useState<TabType>('attendance')
  const [student, setStudent] = useState<{ firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string; photoUrl?: string; studentCode: string; levelNumber: number; levelName: string; groupName: string } | null>(null)
  const [gamification, setGamification] = useState<GamificationData | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [assessments, setAssessments] = useState<AssessmentResult[]>([])
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [stuRes, attRes, asmRes, proRes] = await Promise.all([
          http.get<any>(`/parents/me/children/${id}`),
          http.get<any[]>(`/parents/me/children/${id}/attendance`),
          http.get<any[]>(`/parents/me/children/${id}/assessments`),
          http.get<any>(`/parents/me/children/${id}/progress`),
        ])
        if (stuRes) {
          const s = stuRes
          setStudent({ firstName: s.firstName, lastName: s.lastName, firstNameAr: s.firstNameAr, lastNameAr: s.lastNameAr, photoUrl: s.photoUrl, studentCode: s.studentCode, levelNumber: s.level?.number, levelName: s.level?.name, groupName: s.group?.name })
          if (s.rank || s.totalPoints || s.badges) {
            setGamification({ rank: s.rank, totalStudents: s.totalStudents, totalPoints: s.totalPoints, badges: s.badges, xpToNextLevel: s.xpToNextLevel })
          }
        }
        if (attRes) setAttendance(attRes)
        if (asmRes) setAssessments(asmRes)
        if (proRes) setProgress(proRes)
      } catch { /* ignore */ }
      setLoading(false)
    }
    fetchAll()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
    </div>
  )

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'attendance', label: t('Attendance', 'الحضور'), icon: Calendar },
    { id: 'assessments', label: t('Assessments', 'التقييمات'), icon: ClipboardCheck },
    { id: 'progress', label: t('Progress', 'التقدم'), icon: TrendingUp },
  ]

  return (
    <div className={`space-y-6 ${lang === 'ar' ? 'rtl' : 'ltr'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('Back to Children', 'العودة للأبناء')}
      </Link>

      {student && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 text-xl font-bold overflow-hidden">
              {student.photoUrl ? (
                <Image src={API_ORIGIN + student.photoUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <span>{student.firstName[0]}{student.lastName[0]}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">
              {(lang === 'ar' && student.firstNameAr) ? `${student.firstNameAr} ${student.lastNameAr}` : `${student.firstName} ${student.lastName}`}
              {student.firstNameAr && <span className="text-gray-400 font-medium mr-2">{lang === 'ar' ? `${student.firstName} ${student.lastName}` : `${student.firstNameAr} ${student.lastNameAr}`}</span>}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              <span>{t('Level', 'المستوى')} {student.levelNumber} — {student.groupName}</span>
              <span>{t('Code', 'الكود')}: {student.studentCode}</span>
            </div>
          </div>
        </div>
      )}

      {/* Gamification bar */}
      {gamification && (gamification.rank != null || gamification.totalPoints != null || gamification.badges != null) && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-800">{t('Gamification', 'الألعاب التحفيزية')}</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {gamification.rank != null && gamification.totalStudents != null && (
              <div className="rounded-lg bg-white/70 border border-gold-100 p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">#{gamification.rank}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('Rank', 'الترتيب')} / {gamification.totalStudents}</div>
              </div>
            )}
            {gamification.totalPoints != null && (
              <div className="rounded-lg bg-white/70 border border-gold-100 p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">{gamification.totalPoints}</div>
                <div className="text-xs text-gray-500 mt-0.5">XP</div>
                {gamification.xpToNextLevel != null && (
                  <div className="mt-1 h-1.5 rounded-full bg-gold-200/50 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-blue-500" style={{ width: `${Math.min(100, ((gamification.totalPoints || 0) % 1000) / 10)}%` }} />
                  </div>
                )}
              </div>
            )}
            {gamification.badges != null && (
              <div className="rounded-lg bg-white/70 border border-gold-100 p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-purple-700">
                  <Crown className="h-5 w-5" /> {gamification.badges}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{t('Badges', 'الشارات')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="flex gap-6 border-b border-gray-200">
        {tabs.map(t => {
          const isActive = tab === t.id
          return (
            <Button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={isActive}
              variant="ghost"
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 ${
                isActive ? 'border-gold-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon className={`h-4 w-4 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
              {t.label}
              {t.id === 'attendance' && <span className="text-xs text-gray-400">({attendance.length})</span>}
              {t.id === 'assessments' && <span className="text-xs text-gray-400">({assessments.length})</span>}
            </Button>
          )
        })}
      </nav>

      {/* Attendance Tab */}
      {tab === 'attendance' && (
        <div className="space-y-3">
          {attendance.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">{t('No attendance records yet', 'لا توجد سجلات حضور بعد')}</p>
            </div>
          ) : (
            attendance.map(r => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                    {r.levelNumber && <span className="text-xs text-gray-400">Level {r.levelNumber}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.date ? new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                     {r.homeworkStatus && r.homeworkStatus !== 'not_assigned' && <span className="ml-2">• {t('HW', 'واجب')}: {r.homeworkStatus}</span>}
                  </p>
                  {r.note && <p className="text-xs text-gray-400 mt-0.5 italic">{r.note}</p>}
                </div>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  r.status === 'present' ? 'bg-green-100 text-green-600' :
                  r.status === 'late' ? 'bg-amber-100 text-amber-600' :
                  r.status === 'absent' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {r.status === 'present' ? <CheckCircle2 className="h-4 w-4" /> :
                   r.status === 'late' ? <Clock className="h-4 w-4" /> :
                   r.status === 'absent' ? <XCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Assessments Tab */}
      {tab === 'assessments' && (
        <div className="space-y-3">
          {assessments.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <ClipboardCheck className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">{t('No assessment results yet', 'لا توجد نتائج تقييم بعد')}</p>
            </div>
          ) : (
            assessments.map(a => (
              <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900">{lang === 'ar' && a.titleAr ? a.titleAr : a.title}</h4>
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
                <div className="mt-2 h-2 rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full ${
                    a.percentage >= 80 ? 'bg-green-500' :
                    a.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`} style={{ width: `${a.percentage}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Progress Tab */}
      {tab === 'progress' && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gold-500" /> {t('Recent Sessions', 'الجلسات الأخيرة')}
            </h3>
            {!progress || progress.sessions.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{t('No completed sessions', 'لا توجد جلسات مكتملة')}</p>
            ) : (
              <div className="space-y-2">
                {progress.sessions.slice(0, 10).map(s => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-gray-600">
                      {new Date(s.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                     <span className="text-gray-400 text-xs">{t('Session completed', 'تمت الجلسة')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-gold-500" /> {t('Assessment Progress', 'تقدم التقييمات')}
            </h3>
            {!progress || progress.assessments.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{t('No graded assessments', 'لا توجد تقييمات مصححة')}</p>
            ) : (
              <div className="space-y-2">
                {progress.assessments.map(a => {
                  const totalScore = a.grades.reduce((s, g) => s + Number(g.score), 0)
                  const maxScore = a.grades.reduce((s, g) => s + Number(g.maxScore), 0)
                  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
                  return (
                    <div key={a.id} className="flex items-center gap-3 text-sm">
                      <div className={`h-2 w-2 rounded-full ${pct >= 50 ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-gray-600">Score: {pct}%</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
