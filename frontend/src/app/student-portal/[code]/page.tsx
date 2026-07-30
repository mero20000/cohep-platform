'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { http } from '@/lib/http-client'
import {
  Cross, Loader2, Calendar, CheckCircle2, XCircle, Clock, AlertCircle,
  Award, Star, BookOpen, ArrowLeft, Trophy, Sparkles
} from 'lucide-react'
import Link from 'next/link'

interface PortalData {
  student: {
    id: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string;
    studentCode: string; photoUrl?: string;
    level: { id: string; name: string; number: number; nameAr?: string };
    group: { id: string; name: string; nameAr?: string };
  }
  attendance: { present: number; late: number; absent: number; excused: number; total: number }
  recentAttendance: Array<{ date: string; time?: string; status: string; homeworkStatus?: string }>
  badges: Array<{ id: string; name?: string; nameAr?: string; description?: string; iconUrl?: string; earnedAt: string }>
  totalXp: number
  upcomingSessions: Array<{ id: string; date: string; time?: string }>
  recentHomework: Array<{ date: string; status: string }>
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

export default function StudentDashboard() {
  const params = useParams()
  const code = params?.code as string
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showName, setShowName] = useState(true)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    http.get<PortalData>(`/student-portal/${encodeURIComponent(code)}`)
      .then(setData)
      .catch((e: any) => setError(e?.message || 'Student not found'))
      .finally(() => setLoading(false))
  }, [code])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold-500 mx-auto mb-4" />
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

  const { student, attendance, recentAttendance, badges, totalXp, upcomingSessions, recentHomework } = data
  const attendanceRate = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/student-portal/login" className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm">
              <ArrowLeft className="h-4 w-4" />
              Sign Out
            </Link>
            <button onClick={() => setShowName(!showName)} className="text-white/50 hover:text-white/80 text-xs">
              {showName ? 'Hide Name' : 'Show Name'}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm text-2xl font-bold">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="" className="h-full w-full object-cover rounded-2xl" />
              ) : (
                <Cross className="h-7 w-7" />
              )}
            </div>
            <div>
              {showName && (
                <h1 className="text-2xl font-bold">
                  {student.firstName} {student.lastName}
                </h1>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-medium">
                  Level {student.level.number} &middot; {student.group.name}
                </span>
                <span className="text-white/60 text-xs">{student.studentCode}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
            <Trophy className="h-5 w-5 text-gold-500 mx-auto mb-1" />
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
      </main>
    </div>
  )
}
