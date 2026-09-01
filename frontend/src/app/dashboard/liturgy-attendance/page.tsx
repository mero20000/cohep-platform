'use client'

import { useCallback, useEffect, useState } from 'react'
import { Church, Check, X, AlertCircle, Save } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { TableSkeleton } from '@/components/ui/skeleton'

interface LiturgyStudent {
  studentId: string
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  photoUrl?: string
  status: 'present' | 'absent' | null
}

interface LiturgySession {
  date: string
  students: LiturgyStudent[]
}

export default function LiturgyAttendancePage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const { toast } = useToast()
  const [session, setSession] = useState<LiturgySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSession = useCallback(async () => {
    try {
      setLoading(true)
      const data = await http.get<LiturgySession>('/servants/liturgy-session')
      setSession(data)
    } catch {
      toast('error', t('Failed to load liturgy session', 'فشل تحميل جلسة القداس'))
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const toggleStatus = (studentId: string, newStatus: 'present' | 'absent') => {
    setSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        students: prev.students.map(s =>
          s.studentId === studentId
            ? { ...s, status: s.status === newStatus ? null : newStatus }
            : s,
        ),
      }
    })
  }

  const save = async () => {
    if (!session) return
    setSaving(true)
    try {
      const records = session.students
        .filter(s => s.status !== null)
        .map(s => ({
          studentId: s.studentId,
          status: s.status,
        }))

      await http.post('/servants/liturgy-attendance', { records })
      toast('success', t('Liturgy attendance saved', 'تم حفظ حضور القداس'))
      loadSession()
    } catch {
      toast('error', t('Failed to save attendance', 'فشل حفظ الحضور'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <TableSkeleton rows={8} cols={2} />
      </div>
    )
  }

  if (!session?.students.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6">
          <Church className="h-6 w-6 text-amber-700" />
          <h1 className="text-2xl font-bold text-gray-900">{t('Liturgy Attendance', 'حضور القداس')}</h1>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{t('No liturgy session scheduled for today', 'لا توجد جلسة قداس مجدولة لهذا اليوم')}</p>
        </div>
      </div>
    )
  }

  const presentCount = session.students.filter(s => s.status === 'present').length
  const absentCount = session.students.filter(s => s.status === 'absent').length
  const recordedCount = presentCount + absentCount

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Church className="h-6 w-6 text-amber-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('Liturgy Attendance', 'حضور القداس')}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {new Date(session.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-gray-600 uppercase mb-1">{t('Progress', 'التقدم')}</div>
          <div className="text-2xl font-bold text-gray-900">
            {recordedCount}/{session.students.length}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 mb-6 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-900 uppercase">{t('Present', 'حاضرون')}</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{presentCount}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-900 uppercase">{t('Absent', 'غائبون')}</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{absentCount}</p>
        </div>
      </div>

      {/* Student roster */}
      <div className="space-y-2 mb-6">
        {session.students.map(student => (
          <div
            key={student.studentId}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              student.status === 'present'
                ? 'border-emerald-300 bg-emerald-50'
                : student.status === 'absent'
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {lang === 'ar'
                  ? `${student.firstNameAr || student.firstName} ${student.lastNameAr || student.lastName}`
                  : `${student.firstName} ${student.lastName}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleStatus(student.studentId, 'present')}
                className={`p-2 rounded-lg transition-colors ${
                  student.status === 'present'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-700'
                }`}
                title={t('Present', 'حاضر')}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => toggleStatus(student.studentId, 'absent')}
                className={`p-2 rounded-lg transition-colors ${
                  student.status === 'absent'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'
                }`}
                title={t('Absent', 'غائب')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 sm:-mx-6 lg:-mx-8 mt-6">
        <div className="mx-4 sm:mx-6 lg:mx-8 flex gap-2">
          <Button
            onClick={loadSession}
            variant="outline"
            disabled={saving}
          >
            {t('Clear', 'مسح')}
          </Button>
          <Button
            onClick={save}
            disabled={saving || recordedCount === 0}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                {t('Saving...', 'جاري الحفظ...')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('Save Attendance', 'حفظ الحضور')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
