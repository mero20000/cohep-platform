'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Church, Check, X, Save, Search, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { http } from '@/lib/http-client'
import { photoSrc } from '@/app/dashboard/students/_components/student-types'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'
import { TableSkeleton } from '@/components/ui/skeleton'

interface LiturgyStudent {
  studentId: string
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  photoUrl?: string
  gradeName?: string
  gradeNameAr?: string
  status: 'present' | 'absent' | null
}

interface LiturgySession {
  date: string
  sessionId: string
  groupId?: string
  levelId: string
  students: LiturgyStudent[]
}

interface Group {
  id: string
  name: string
  nameAr?: string
}

interface Level {
  id: string
  name: string
  nameAr?: string
}

interface Grade {
  id: string
  name: string
  nameAr?: string
}

export default function CreateLiturgyPage() {
  const lang = useLanguage()
  const t = useMemo(() => (en: string, ar: string) => lang === 'ar' ? ar : en, [lang])
  const router = useRouter()
  const { toast } = useToast()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [groupId, setGroupId] = useState('')
  const [levelId, setLevelId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [session, setSession] = useState<LiturgySession | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'unrecorded'>('all')
  const mountedRef = useRef(true)

  const loadMetadata = useCallback(async () => {
    try {
      const [groupsData, levelsData, gradesData] = await Promise.all([
        http.get<Group[]>('/groups'),
        http.get<Level[]>('/curriculum/levels'),
        http.get<Grade[]>('/curriculum/grades'),
      ]).catch(() => [[], [], []])
      if (mountedRef.current) {
        setGroups(Array.isArray(groupsData) ? groupsData : [])
        setLevels(Array.isArray(levelsData) ? levelsData : [])
        setGrades(Array.isArray(gradesData) ? gradesData : [])
      }
    } catch (err) {
      console.error('Failed to load metadata:', err)
    }
  }, [])

  const loadSession = useCallback(async () => {
    if (!date) return
    try {
      setLoading(true)
      const params: any = { date }
      if (groupId) params.groupId = groupId
      else if (levelId) params.levelId = levelId
      else if (gradeId) params.gradeId = gradeId
      else {
        toast('error', t('Please select a group, level, or grade', 'يرجى اختيار مجموعة أو مستوى أو صف'))
        return
      }
      const data = await http.post<LiturgySession>('/servants/liturgy-session/create', params)
      if (mountedRef.current) setSession(data)
    } catch (err: any) {
      if (mountedRef.current) {
        const msg = err?.message || t('Failed to create session', 'فشل إنشاء الجلسة')
        toast('error', msg)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [date, groupId, levelId, gradeId, t, toast])

  const counts = useMemo(() => ({
    all: session?.students.length ?? 0,
    present: session?.students.filter(s => s.status === 'present').length ?? 0,
    absent: session?.students.filter(s => s.status === 'absent').length ?? 0,
    unrecorded: session?.students.filter(s => s.status === null).length ?? 0,
  }), [session?.students])

  const filteredStudents = useMemo(() => {
    if (!session?.students) return []
    let list = session.students
    if (filterStatus !== 'all') {
      list = list.filter(s => filterStatus === 'unrecorded' ? s.status === null : s.status === filterStatus)
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(s => {
      const nameEn = `${s.firstName} ${s.lastName}`.toLowerCase()
      const nameAr = `${s.firstNameAr || ''} ${s.lastNameAr || ''}`.toLowerCase()
      const grade = lang === 'ar' ? (s.gradeNameAr || s.gradeName || '') : (s.gradeName || '')
      return nameEn.includes(q) || nameAr.includes(q) || grade.toLowerCase().includes(q)
    })
  }, [session?.students, search, filterStatus, lang])

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

  const markAll = (newStatus: 'present' | 'absent') => {
    setSession(prev => {
      if (!prev) return prev
      return { ...prev, students: prev.students.map(s => ({ ...s, status: newStatus })) }
    })
  }

  const clearAll = () => {
    setSession(prev => {
      if (!prev) return prev
      return { ...prev, students: prev.students.map(s => ({ ...s, status: null })) }
    })
    setFilterStatus('all')
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

      await http.post('/servants/liturgy-attendance', { date, records })
      toast('success', t('Liturgy attendance saved', 'تم حفظ حضور القداس'))
      setTimeout(() => router.push('/dashboard/liturgy-attendance'), 500)
    } catch {
      toast('error', t('Failed to save attendance', 'فشل حفظ الحضور'))
    } finally {
      setSaving(false)
    }
  }

  const presentCount = session?.students.filter(s => s.status === 'present').length ?? 0
  const absentCount = session?.students.filter(s => s.status === 'absent').length ?? 0
  const recordedCount = presentCount + absentCount

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => router.back()} className="p-1 hover:bg-gray-100 rounded">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <Church className="h-6 w-6 text-amber-700" />
          <h1 className="text-2xl font-bold text-gray-900">{t('Create Liturgy Session', 'إنشاء جلسة القداس')}</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('Date', 'التاريخ')}</label>
            <DatePicker value={date} onChange={setDate} max={new Date().toISOString().split('T')[0]} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="group" className="block text-sm font-medium text-gray-700 mb-2">{t('Group', 'المجموعة')}</label>
              <select
                id="group"
                value={groupId}
                onChange={(e) => { setGroupId(e.target.value); setLevelId(''); setGradeId('') }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">{t('Select group', 'اختر مجموعة')}</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {lang === 'ar' ? g.nameAr || g.name : g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-2">{t('Level', 'المستوى')}</label>
              <select
                id="level"
                value={levelId}
                onChange={(e) => { setLevelId(e.target.value); setGroupId(''); setGradeId('') }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">{t('Select level', 'اختر مستوى')}</option>
                {levels.map(l => (
                  <option key={l.id} value={l.id}>
                    {lang === 'ar' ? l.nameAr || l.name : l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">{t('Grade', 'الصف')}</label>
              <select
                id="grade"
                value={gradeId}
                onChange={(e) => { setGradeId(e.target.value); setGroupId(''); setLevelId('') }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">{t('Select grade', 'اختر صف')}</option>
                {grades.map(gr => (
                  <option key={gr.id} value={gr.id}>
                    {lang === 'ar' ? gr.nameAr || gr.name : gr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button onClick={() => { loadMetadata(); loadSession() }} disabled={loading} className="w-full">
            {loading ? t('Loading...', 'جاري التحميل...') : t('Create Session', 'إنشاء جلسة')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1 hover:bg-gray-100 rounded">
            <ArrowLeft className="h-6 w-6" />
          </button>
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('Search by name...', 'بحث بالاسم...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {([
          { key: 'all', label: t('All', 'الكل') },
          { key: 'present', label: t('Present', 'حاضر') },
          { key: 'absent', label: t('Absent', 'غائب') },
          { key: 'unrecorded', label: t('Not recorded', 'غير مسجل') },
        ] as const).map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterStatus(f.key)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterStatus === f.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            {f.label}
            <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-600">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => markAll('present')}>
          {t('Mark all present', 'تحديد الكل حاضر')}
        </Button>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          {t('Clear', 'مسح')}
        </Button>
      </div>

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

      <div className="space-y-2 mb-6">
        {filteredStudents.map(student => (
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
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
              {student.photoUrl ? (
                <Image
                  src={photoSrc(student.photoUrl)}
                  alt={student.firstName}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-amber-100 text-sm font-bold text-amber-700">
                  {student.firstName.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {lang === 'ar'
                  ? `${student.firstNameAr || student.firstName} ${student.lastNameAr || student.lastName}`
                  : `${student.firstName} ${student.lastName}`}
              </p>
              {(student.gradeName || student.gradeNameAr) && (
                <p className="text-xs text-gray-500 truncate">
                  {lang === 'ar' ? student.gradeNameAr || student.gradeName : student.gradeName}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => toggleStatus(student.studentId, 'present')}
                className={`min-h-[44px] min-w-[44px] p-2 rounded-lg transition-colors ${
                  student.status === 'present'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-700'
                }`}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => toggleStatus(student.studentId, 'absent')}
                className={`min-h-[44px] min-w-[44px] p-2 rounded-lg transition-colors ${
                  student.status === 'absent'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-16 lg:bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 -mx-4 sm:-mx-6 lg:-mx-8 mt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-4 sm:mx-6 lg:mx-8 flex gap-2">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            disabled={saving}
          >
            {t('Reset', 'إعادة تعيين')}
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
