'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { http } from '@/lib/http-client'
import { ensurePortalSession, clearPortalSession, portalGet } from '@/lib/portal-session'
import { assetUrl } from '@/lib/asset-url'
import { AudioPlayer } from '@/components/audio-player'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')
import {
  Cross, Loader2, Calendar, CheckCircle2, XCircle, Clock, AlertCircle,
  Award, Star, BookOpen, ArrowLeft, Trophy, Play, Music,
  ChevronDown, ChevronRight, Search, Filter, ClipboardCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useStudentHymnMap, useStudentThisSunday, useStudentDueReview, useStudentStats, useStudentPractice } from '@/components/hymn-learning/student-hooks'
import { ThisSundayPanel } from '@/components/hymn-learning/this-sunday'
import { PracticeRecorder } from '@/components/hymn-learning/practice-recorder'
import { MASTERY_META, type HymnMapItem } from '@/components/hymn-learning/hooks'

interface PortalData {
  student: {
    id: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string;
    studentCode: string; photoUrl?: string;
    level: { id: string; name: string; number: number; nameAr?: string };
    group: { id: string; name: string; nameAr?: string };
  }
  school: {
    name: string; nameAr?: string; logoUrl?: string;
    churchName?: string; churchNameAr?: string;
  } | null
  attendance: { present: number; late: number; absent: number; excused: number; total: number }
  recentAttendance: Array<{ date: string; time?: string; status: string; homeworkStatus?: string }>
  badges: Array<{ id: string; name?: string; nameAr?: string; description?: string; iconUrl?: string; earnedAt: string }>
  totalXp: number
  upcomingSessions: Array<{ id: string; date: string; time?: string }>
  recentHomework: Array<{ date: string; status: string }>
  assessments: Array<{
    id: string; title: string; titleAr?: string; type: string;
    totalPoints: number; passingScore: number; dueDate?: string;
    level: { id: string; name: string };
    subject: { id: string; name: string; nameAr?: string };
    submissionStatus: string; submissionId: string; submittedAt: string;
  }>
}

const STATUS_ICONS: Record<string, any> = { present: CheckCircle2, late: Clock, absent: XCircle, excused: AlertCircle }
const STATUS_COLORS: Record<string, string> = {
  present: 'text-green-600 bg-green-50', late: 'text-amber-600 bg-amber-50',
  absent: 'text-red-600 bg-red-50', excused: 'text-gray-500 bg-gray-50',
}
const HW_COLORS: Record<string, string> = {
  completed: 'text-green-700 bg-green-100', partial: 'text-amber-700 bg-amber-100',
  not_submitted: 'text-red-700 bg-red-100',
}

type Tab = 'dashboard' | 'practice'

export default function StudentDashboard() {
  const params = useParams()
  const code = params?.code as string
  const lang: string = 'en'
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showName, setShowName] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  // Practice state
  const [practiceLesson, setPracticeLesson] = useState<HymnMapItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMastery, setFilterMastery] = useState('')
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!code) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await portalGet<PortalData>(code, `/student-portal/${encodeURIComponent(code)}`)
        if (!cancelled) setData(data)
      } catch (e: any) {
        // No valid session at all (bad/expired key): send to the login page.
        try { sessionStorage.removeItem('student_portal_token') } catch {}
        if (!cancelled) setError(e?.message || 'Student not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [code])

  // Practice hooks
  const { data: hymnMap, isLoading: hymnMapLoading } = useStudentHymnMap(code)
  const { data: sundayData, isLoading: sundayLoading } = useStudentThisSunday(code)
  const { data: dueReview } = useStudentDueReview(code)
  const { data: stats } = useStudentStats(code)
  const practiceMutation = useStudentPractice(code)

  const handleSelectHymn = (id: string, title: string, audioUrl?: string) => {
    if (!hymnMap) return
    const hymn = hymnMap.find(h => h.id === id)
    if (hymn) setPracticeLesson(hymn)
  }

  // Extract audio URL from resources array
  const getAudioUrl = (hymn: HymnMapItem): string | undefined => {
    return hymn.resources?.find(r => r.type === 'audio')?.fileUrl ?? undefined
  }

  const handleSubmitPractice = async (selfRating: number, recordingUrl?: string, durationSec?: number) => {
    if (!practiceLesson) return
    await practiceMutation.mutateAsync({
      lessonId: practiceLesson.id,
      selfRating,
      recordingUrl,
      durationSec,
    })
    setPracticeLesson(null)
  }

  // Filter and group hymns
  const filteredHymns = (hymnMap || []).filter(h => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match = h.title.toLowerCase().includes(q) ||
        h.titleAr?.toLowerCase().includes(q) ||
        h.titleCoptic?.toLowerCase().includes(q)
      if (!match) return false
    }
    if (filterMastery) {
      const status = h.progress?.masteryStatus ?? 'not_started'
      if (status !== filterMastery) return false
    }
    return true
  })

  const groupedByLevel = filteredHymns.reduce((acc, h) => {
    const key = `${h.level.number} - ${h.level.name}`
    if (!acc[key]) acc[key] = []
    acc[key].push(h)
    return acc
  }, {} as Record<string, HymnMapItem[]>)

  const toggleLevel = (level: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold-700 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading your dashboard...</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <XCircle className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Could not load dashboard</h2>
        <p className="text-sm text-gray-500 mb-4">{error || 'Check your student code and try again.'}</p>
        <Link href="/student-portal/login" className="text-sm text-blue-600 hover:underline">Go back to login</Link>
      </div>
    </div>
  )

  const { student, school, attendance, recentAttendance, badges, totalXp, upcomingSessions, recentHomework, assessments } = data
  const attendanceRate = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0

  const photoSrc = student.photoUrl
    ? (student.photoUrl.startsWith('http') ? student.photoUrl : `${API_ORIGIN}${student.photoUrl}`)
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/student-portal/login"
              onClick={() => { try { sessionStorage.removeItem('student_portal_token') } catch {} }}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Sign Out
            </Link>
            <button onClick={() => setShowName(!showName)} className="text-white/50 hover:text-white/80 text-xs">
              {showName ? 'Hide Name' : 'Show Name'}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm text-2xl font-bold overflow-hidden">
              {photoSrc ? (
                <Image src={photoSrc} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />
              ) : (
                <Cross className="h-7 w-7" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {showName && (
                <h1 className="text-2xl font-bold truncate">
                  {student.firstName} {student.lastName}
                </h1>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-medium">
                  Level {student.level.number} &middot; {student.group.name}
                </span>
                <span className="text-white/60 text-xs">{student.studentCode}</span>
              </div>
              {school && (
                <div className="mt-2 flex items-center gap-2 text-white/70 text-xs">
                  {school.logoUrl && (
                    <Image
                      src={school.logoUrl.startsWith('http') ? school.logoUrl : `${API_ORIGIN}${school.logoUrl}`}
                      alt="" width={16} height={16} className="rounded" unoptimized
                    />
                  )}
                  <span>{school.churchName || school.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-0">
            {(['dashboard', 'practice'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'dashboard' ? '📊 Dashboard' : '🎵 Practice'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* ─── DASHBOARD TAB ─────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
                <Trophy className="h-5 w-5 text-gold-700 mx-auto mb-1" />
                <div className="text-xl font-bold text-gray-900">{totalXp}</div>
                <div className="text-xs text-gray-500">Total XP</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
                <Award className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-gray-900">{badges.length}</div>
                <div className="text-xs text-gray-500">Badges</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-gray-900">{attendanceRate}%</div>
                <div className="text-xs text-gray-500">Attendance</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
                <BookOpen className="h-5 w-5 text-purple-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-gray-900">{recentHomework.filter(h => h.status === 'completed').length}/{recentHomework.length}</div>
                <div className="text-xs text-gray-500">Homework</div>
              </div>
            </div>

            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Upcoming Sessions
                </h2>
                <div className="space-y-2">
                  {upcomingSessions.map(s => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        {s.time && <div className="text-xs text-gray-500">{s.time}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Attendance */}
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Recent Attendance
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="rounded-lg bg-green-50 p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{attendance.present}</div>
                  <div className="text-xs text-green-600">Present</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 text-center">
                  <div className="text-lg font-bold text-amber-700">{attendance.late}</div>
                  <div className="text-xs text-amber-600">Late</div>
                </div>
                <div className="rounded-lg bg-red-50 p-2 text-center">
                  <div className="text-lg font-bold text-red-700">{attendance.absent}</div>
                  <div className="text-xs text-red-600">Absent</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{attendance.excused}</div>
                  <div className="text-xs text-gray-500">Excused</div>
                </div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 divide-y divide-gray-100">
                {recentAttendance.slice(0, 5).map((r, i) => {
                  const Icon = STATUS_ICONS[r.status] || AlertCircle
                  const color = STATUS_COLORS[r.status] || 'text-gray-500 bg-gray-50'
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 capitalize">{r.status}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {r.time ? ` at ${r.time}` : ''}
                        </div>
                      </div>
                      {r.homeworkStatus && r.homeworkStatus !== 'not_assigned' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${HW_COLORS[r.homeworkStatus] || 'bg-gray-100 text-gray-600'}`}>
                          {r.homeworkStatus.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  )
                })}
                {recentAttendance.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">No attendance records yet</div>
                )}
              </div>
            </section>

            {/* Badges */}
            {badges.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  Badges Earned
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {badges.slice(0, 8).map(b => (
                    <div key={b.id} className="rounded-xl bg-white border border-gray-200 p-3 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                        <Star className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="text-sm font-medium text-gray-900 truncate" title={b.name || ''}>{b.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(b.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Assigned Assessments */}
            {assessments.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                  Assigned Assessments ({assessments.length})
                </h2>
                <div className="space-y-2">
                  {assessments.map(a => {
                    const isCompleted = a.submissionStatus === 'completed'
                    const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && !isCompleted
                    const cardClasses = `rounded-xl border px-4 py-3 ${
                      isCompleted ? 'bg-green-50 border-green-200' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                    }`
                    const cardInner = (
                      <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {a.titleAr || a.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                                {a.type}
                              </span>
                              <span className="text-xs text-gray-500">{a.subject.nameAr || a.subject.name}</span>
                              <span className="text-xs text-gray-400">&middot;</span>
                              <span className="text-xs text-gray-500">{a.totalPoints} pts</span>
                            </div>
                            {a.dueDate && (
                              <div className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                Due: {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Done
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                                <AlertCircle className="h-3.5 w-3.5" /> Overdue
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                <Clock className="h-3.5 w-3.5" /> Pending
                              </span>
                            )}
                          </div>
                      </div>
                    )
                    return isCompleted ? (
                      <div key={a.id} className={cardClasses}>{cardInner}</div>
                    ) : (
                      <Link key={a.id} href={`/student-portal/${code}/assessment/${a.id}/take`} className={`block ${cardClasses}`}>{cardInner}</Link>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* ─── PRACTICE TAB ──────────────────────────────────────────── */}
        {activeTab === 'practice' && (
          <>
            {/* Learning Stats */}
            {stats && (
              <div className="grid grid-cols-5 gap-2">
                {(['not_started', 'introduced', 'practicing', 'known', 'mastered'] as const).map(s => {
                  const meta = MASTERY_META[s]
                  return (
                    <div key={s} className="rounded-lg bg-white border border-gray-200 p-2 text-center">
                      <div className="h-2 w-2 rounded-full mx-auto mb-1" style={{ background: meta.dot }} />
                      <div className="text-lg font-bold text-gray-900">{stats[s]}</div>
                      <div className="text-[10px] text-gray-500 leading-tight">{meta.label}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* This Sunday */}
            <ThisSundayPanel
              data={sundayData ?? null}
              isLoading={sundayLoading}
              hymnMap={hymnMap}
              onSelect={handleSelectHymn}
              lang="en"
            />

            {/* Due for Review */}
            {dueReview && dueReview.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                <div className="px-5 py-3 border-b border-amber-200">
                  <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Due for Review ({dueReview.length})
                  </h3>
                </div>
                <div className="divide-y divide-amber-100">
                  {dueReview.map(item => {
                    const meta = MASTERY_META[item.mastery]
                    return (
                      <button key={item.progressId}
                        onClick={() => {
                          const hymn = hymnMap?.find(h => h.id === item.lesson.id)
                          if (hymn) setPracticeLesson(hymn)
                        }}
                        className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-amber-100/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{item.lesson.title}</div>
                          {item.lesson.titleCoptic && <div className="text-xs text-gray-500 mt-0.5">{item.lesson.titleCoptic}</div>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-amber-700 font-medium">{item.overdueDays}d overdue</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* All Hymns */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Music className="h-4 w-4 text-blue-500" />
                  All Hymns
                </h3>
              </div>

              {/* Search & Filter */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search hymns..."
                    className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none" />
                </div>
                <select value={filterMastery} onChange={e => setFilterMastery(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none">
                  <option value="">All Status</option>
                  {(['not_started', 'introduced', 'practicing', 'known', 'mastered'] as const).map(s => (
                    <option key={s} value={s}>{MASTERY_META[s].label}</option>
                  ))}
                </select>
              </div>

              {hymnMapLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-700" /></div>
              ) : Object.keys(groupedByLevel).length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No hymns found</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groupedByLevel).map(([level, hymns]) => {
                    const isExpanded = expandedLevels.has(level) || (expandedLevels.size === 0 && !searchQuery && !filterMastery)
                    return (
                      <div key={level} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <button onClick={() => toggleLevel(level)}
                          className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                            <span className="text-sm font-medium text-gray-900">{level}</span>
                            <span className="text-xs text-gray-400">({hymns.length})</span>
                          </div>
                          <div className="flex -space-x-1">
                            {hymns.slice(0, 5).map(h => {
                              const m = MASTERY_META[h.progress?.masteryStatus ?? 'not_started']
                              return <div key={h.id} className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: m.dot }} />
                            })}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="divide-y divide-gray-100">
                            {hymns.map(hymn => {
                              const mastery = hymn.progress?.masteryStatus ?? 'not_started'
                              const meta = MASTERY_META[mastery]
                              return (
                                <div key={hymn.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: meta.dot }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-900 truncate">{hymn.title}</div>
                                    {hymn.titleCoptic && <div className="text-xs text-gray-400 truncate">{hymn.titleCoptic}</div>}
                                  </div>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color} flex-shrink-0`}>
                                    {meta.label}
                                  </span>
                                  <button onClick={() => setPracticeLesson(hymn)}
                                    className="flex-shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                                    <Play className="h-3 w-3 inline mr-1" /> Practice
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ─── PRACTICE MODAL ─────────────────────────────────────────── */}
      {practiceLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPracticeLesson(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            {practiceLesson?.referenceRecordingUrl && (
              <div className="mt-3 rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'تسجيل المرجع' : 'Reference recording'}{practiceLesson.referenceRecordingName ? ` — ${practiceLesson.referenceRecordingName}` : ''}</div>
                <AudioPlayer src={assetUrl(practiceLesson.referenceRecordingUrl)} />
              </div>
            )}
            <PracticeRecorder
              lessonId={practiceLesson.id}
              lessonTitle={practiceLesson.title}
              referenceAudioUrl={getAudioUrl(practiceLesson)}
              onSubmit={handleSubmitPractice}
              onCancel={() => setPracticeLesson(null)}
              lang="en"
              code={code}
            />
          </div>
        </div>
      )}
    </div>
  )
}
