'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLanguage } from '@/lib/use-language'
import {
  ClipboardCheck, Plus, Pencil, Trash2, Loader2, ChevronRight, Zap,
  Calendar, FileText, Clock, Eye, Users, Check, Download, Printer, X, UserX, CheckCircle, XCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { FilterBar } from '@/components/ui/filter-bar'
import { DataTable } from '@/components/ui/data-table'
import { Modal } from '@/components/ui/modal'
import { FormField } from '@/components/ui/form-field'
import { DatePicker } from '@/components/ui/date-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Pagination } from '@/components/ui/pagination'
import { CardSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { getSchoolId } from '@/lib/school'
import { fetchActiveGrades, type GradeItem } from '@/lib/grades'
import { http } from '@/lib/http-client'

interface Level { id: string; name: string; number: number; status?: string }
interface Group { id: string; name: string; levelId: string; status?: string }
interface Subject { id: string; name: string }
interface Lesson { id: string; title: string }
interface AcademicYear { id: string; name: string; isCurrent: boolean }

interface AssessmentQuestion {
  id: string
  questionText: string
  type: string
  options?: any
  correctAnswer: string
  points: number
  orderIndex: number
}

interface StudentRow {
  id: string
  firstName: string
  lastName: string
  studentCode: string
  schoolGrade?: string
  status: string
  assigned: boolean
  submissionStatus: string | null
  mark: number | null
  maxMark: number
}

interface Assessment {
  id: string
  title: string
  description?: string
  type: string
  status: string
  totalPoints: number | string
  passingScore: number | string
  dueDate?: string
  term?: number
  levelId: string
  groupId?: string
  grade?: string
  lessonId?: string
  subjectId: string
  academicYearId?: string
  metadata?: { term?: number; academicYearId?: string; grade?: string }
  level: { id: string; name: string; number: number }
  group?: { id: string; name: string }
  lesson?: { id: string; title: string }
  subject: { id: string; name: string }
  questions?: AssessmentQuestion[]
  _count: { questions: number; submissions: number }
}

interface PaginatedResponse {
  data: Assessment[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface QuestionDraft {
  text: string
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  options: string
  correctAnswer: string
  points: string
}

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'default' | 'info' | 'danger'> = {
  published: 'success',
  draft: 'default',
  archived: 'info',
  closed: 'danger',
}

function termLabel(t: number, lang: 'en' | 'ar'): string {
  if (lang === 'ar') {
    const labels = ['', 'الفصل الأول', 'الفصل الثاني', 'الفصل الثالث']
    return labels[t] || `${lang === 'ar' ? 'الفصل' : 'Term'} ${t}`
  }
  return ['', 'Term 1', 'Term 2', 'Term 3'][t] || `Term ${t}`
}

const emptyForm = {
  title: '',
  description: '',
  levelId: '',
  groupId: '',
  grade: '',
  lessonId: '',
  subjectId: '',
  totalPoints: '',
  passingPoints: '',
  dueDate: '',
  term: '',
  status: 'draft',
  questions: [] as QuestionDraft[],
}

export default function AssessmentsPage() {
  const { toast } = useToast()
  const lang = useLanguage()

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  const [levels, setLevels] = useState<Level[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [gradeOptions, setGradeOptions] = useState<string[]>([])

  const [showForm, setShowForm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showStudents, setShowStudents] = useState(false)
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formDirty, setFormDirty] = useState(false)

  const [studentRows, setStudentRows] = useState<StudentRow[]>([])
  const [batchMode, setBatchMode] = useState(false)
  const [batchIndex, setBatchIndex] = useState(0)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentGradeFilter, setStudentGradeFilter] = useState('')
  const [savingMarks, setSavingMarks] = useState<Record<string, boolean>>({})
  const [gradeFilterOptions, setGradeFilterOptions] = useState<string[]>([])
  const [showReport, setShowReport] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const [markValues, setMarkValues] = useState<Record<string, string>>({})

  const deassignStudent = async (studentId: string) => {
    if (!selectedAssessment) return
    try {
      await http.delete(`/assessments/${selectedAssessment.id}/students/${studentId}`)
      setStudentRows(rows => rows.map(r => r.id === studentId ? { ...r, assigned: false, submissionStatus: null, mark: null } : r))
      toast('success', lang === 'ar' ? 'تم إلغاء تعيين الطالب' : 'Student unassigned')
    } catch {
      toast('error', lang === 'ar' ? 'فشل إلغاء تعيين الطالب' : 'Failed to unassign student')
    }
  }

  const visibleStudents = studentGradeFilter
    ? studentRows.filter(r => r.schoolGrade === studentGradeFilter)
    : studentRows

  const [stats, setStats] = useState({ total: 0, byStatus: [] as { status: string; count: number }[], grading: null as { gradedCount: number; passCount: number; passRate: number; avgScore: number } | null })

  const fetchAssessments = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        schoolId: getSchoolId(),
        page: String(page),
        limit: '20',
      }
      if (filterLevel) params.levelId = filterLevel
      if (filterSubject) params.subjectId = filterSubject
      if (filterStatus) params.status = filterStatus
      if (filterType) params.type = filterType
      const data = await http.get<PaginatedResponse>('/assessments', params)

      let filtered = data.data
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(a => a.title.toLowerCase().includes(q))
      }

      setAssessments(filtered)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Failed to fetch assessments', err)
      toast('error', getErrorMessage(err, 'Failed to load assessments', 'فشل تحميل التقييمات'))
    }
    setLoading(false)
  }, [filterLevel, filterSubject, filterStatus, filterType, search, lang])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await http.get<any>('/assessments/stats', { schoolId: getSchoolId() })
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats', err)
      toast('error', getErrorMessage(err, 'Failed to load stats', 'فشل تحميل الإحصائيات'))
    }
    setStatsLoading(false)
  }, [toast, lang])

  useEffect(() => { fetchAssessments(1) }, [fetchAssessments])
  useEffect(() => { fetchStats() }, [fetchStats])

  const schoolId = getSchoolId()

  useEffect(() => {
    const p = { schoolId }
    http.get<Level[]>('/curriculum/levels', p)
      .then((data: Level[]) => setLevels(data.filter(l => l.status !== 'inactive')))
      .catch(console.error)
    http.get<Subject[]>('/curriculum/subjects', p)
      .then((data: Subject[]) => setSubjects(data))
      .catch(console.error)
    http.get<AcademicYear[]>('/curriculum/academic-years', p)
      .then((data: AcademicYear[]) => setAcademicYears(data))
      .catch(console.error)
    fetchActiveGrades()
      .then((grades: GradeItem[]) => { if (grades.length) setGradeOptions(grades.map(g => g.name)) })
      .catch(console.error)
  }, [schoolId])

  useEffect(() => {
    if (!form.levelId) { setGroups([]); return }
    http.get<{ id: string; groups: Group[] }[]>('/students/groups/all', { schoolId })
      .then((data) => {
        const level = data.find(l => l.id === form.levelId)
        setGroups((level?.groups || []).filter(g => g.status !== 'inactive'))
      })
      .catch(console.error)
  }, [form.levelId, schoolId])

  useEffect(() => {
    if (!form.levelId) { setLessons([]); return }
    const params: Record<string, string> = { schoolId, levelId: form.levelId }
    if (form.subjectId) params.subjectId = form.subjectId
    http.get<Lesson[]>('/curriculum/lessons', params)
      .then((data: Lesson[]) => setLessons(data))
      .catch(console.error)
  }, [form.levelId, form.subjectId, schoolId])

  const openCreate = () => {
    setForm(emptyForm)
    setFormDirty(false)
    setFormError('')
    setSelectedAssessment(null)
    setShowForm(true)
  }

  const openEdit = async (a: Assessment) => {
    try {
      let detail = a
      if (!a.questions || a.questions.length === 0) {
        detail = await http.get<Assessment>(`/assessments/${a.id}`)
      }
      const meta = (detail.metadata || {}) as { term?: number; academicYearId?: string; grade?: string }
      setForm({
        title: detail.title,
        description: detail.description || '',
        levelId: detail.levelId,
        groupId: detail.groupId || '',
        grade: meta.grade || detail.grade || '',
        lessonId: detail.lessonId || '',
        subjectId: detail.subjectId,
        totalPoints: String(detail.totalPoints),
        passingPoints: String(detail.passingScore),
        dueDate: detail.dueDate ? detail.dueDate.split('T')[0] : '',
        term: meta.term ? String(meta.term) : '',
        status: detail.status,
        questions: (detail.questions || []).map(q => ({
          text: q.questionText,
          type: q.type as QuestionDraft['type'],
          options: Array.isArray(q.options) ? q.options.join('\n') : (q.options || ''),
          correctAnswer: q.correctAnswer,
          points: String(q.points),
        })),
      })
      setFormDirty(false)
      setSelectedAssessment(detail)
    } catch (err) {
      console.error('Failed to load assessment', err)
      toast('error', lang === 'ar' ? 'فشل تحميل تفاصيل التقييم' : 'Failed to load assessment details')
      return
    }
    setFormError('')
    setShowForm(true)
  }

  const openDelete = (a: Assessment) => {
    setSelectedAssessment(a)
    setShowDelete(true)
  }

  const openStudents = async (a: Assessment, grade?: string) => {
    setSelectedAssessment(a)
    setShowStudents(true)
    const assessmentGrade = (a.metadata as { grade?: string } | undefined)?.grade || a.grade || ''
    setStudentGradeFilter(grade || assessmentGrade)
    setStudentsLoading(true)
    let rows: StudentRow[] = []
    try {
      const p: Record<string, string> = {}
      if (grade) p.schoolGrade = grade
      const payload: any = await http.get(`/assessments/${a.id}/students`, p)
      rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : []
      setStudentRows(rows)
    } catch (err) {
      console.error('Failed to load students', err)
      setStudentRows([])
      toast('error', lang === 'ar' ? 'فشل تحميل الطلاب' : 'Failed to load students')
    }
    try {
      const active: GradeItem[] = await fetchActiveGrades()
      const settingsGrades = active.map(g => g.name)
      const studentGrades = Array.from(new Set(rows.map(r => r.schoolGrade).filter(Boolean))) as string[]
      setGradeFilterOptions(settingsGrades.length ? settingsGrades : studentGrades)
    } catch {
      setGradeFilterOptions(Array.from(new Set(rows.map(r => r.schoolGrade).filter(Boolean))) as string[])
    }
    setStudentsLoading(false)
  }

  const assignStudents = async (ids: string[]) => {
    if (!selectedAssessment) return
    try {
      await http.post(`/assessments/${selectedAssessment.id}/assign`, { studentIds: ids })
      setStudentRows(rows => rows.map(r => ids.includes(r.id) ? { ...r, assigned: true, submissionStatus: 'assigned' } : r))
      toast('success', lang === 'ar' ? `تم تعيين ${ids.length} طالب` : `Assigned ${ids.length} student(s)`)
    } catch {
      toast('error', lang === 'ar' ? 'فشل تعيين الطلاب' : 'Failed to assign students')
    }
  }

  const assignedStudents = studentRows.filter(r => r.assigned)

  const reportStats = useMemo(() => {
    const graded = assignedStudents.filter(r => r.mark !== null)
    const scores = graded.map(r => r.mark!)
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const maxScore = selectedAssessment ? Number(selectedAssessment.totalPoints) : 100
    const passThreshold = selectedAssessment ? Number(selectedAssessment.passingScore) : maxScore * 0.6
    const passed = scores.filter(s => s >= passThreshold).length
    return {
      total: studentRows.length,
      assigned: assignedStudents.length,
      graded: graded.length,
      avgScore: avg,
      maxScore,
      passThreshold,
      passed,
      passRate: graded.length ? Math.round((passed / graded.length) * 100) : 0,
    }
  }, [studentRows, selectedAssessment])

  const exportReportCSV = () => {
    const rows = [
      [
        lang === 'ar' ? 'كود الطالب' : 'Student Code',
        lang === 'ar' ? 'الاسم الأول' : 'First Name',
        lang === 'ar' ? 'اسم العائلة' : 'Last Name',
        lang === 'ar' ? 'الصف' : 'Grade',
        lang === 'ar' ? 'الحالة' : 'Status',
        lang === 'ar' ? 'الدرجة' : 'Mark',
        lang === 'ar' ? 'الدرجة القصوى' : 'Max Mark',
        lang === 'ar' ? 'نجاح/رسوب' : 'Pass/Fail',
      ],
      ...assignedStudents.map(r => [
        r.studentCode,
        r.firstName,
        r.lastName,
        r.schoolGrade || '',
        r.submissionStatus || '',
        r.mark?.toString() ?? '',
        r.maxMark.toString(),
        r.mark !== null ? (r.mark >= reportStats.passThreshold ? (lang === 'ar' ? 'نجاح' : 'Pass') : (lang === 'ar' ? 'رسوب' : 'Fail')) : '',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assessment-report-${selectedAssessment?.title?.replace(/\s+/g, '-') || 'export'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printReport = () => {
    const printWin = window.open('', '_blank')
    if (!printWin) return
    const graded = assignedStudents.filter(r => r.mark !== null)
    const rows = assignedStudents.map(r => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${r.studentCode}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.firstName} ${r.lastName}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.schoolGrade || '—'}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.submissionStatus || '—'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${r.mark !== null ? r.mark : '—'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${r.maxMark}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${r.mark !== null ? (r.mark >= reportStats.passThreshold ? (lang === 'ar' ? 'ناجح' : 'PASS') : (lang === 'ar' ? 'راسب' : 'FAIL')) : '—'}</td>
      </tr>
    `).join('')
    printWin.document.write(`
      <html><head><title>${lang === 'ar' ? 'تقرير التقييم' : 'Assessment Report'}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
        h1{font-size:18px;margin-bottom:4px}
        .meta{color:#666;margin-bottom:16px}
        .stats{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}
        .stat{background:#f5f5f5;padding:8px 14px;border-radius:6px}
        .stat-label{font-size:10px;color:#888;text-transform:uppercase}
        .stat-value{font-size:16px;font-weight:bold}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{background:#f0f0f0;padding:8px;border:1px solid #ddd;text-align:left;font-size:11px;text-transform:uppercase}
        td{font-size:12px}
        .pass{color:#16a34a;font-weight:bold}
        .fail{color:#dc2626;font-weight:bold}
        @media print{body{padding:0}.no-print{display:none}}
      </style></head><body>
      <h1>${selectedAssessment?.title || (lang === 'ar' ? 'تقرير التقييم' : 'Assessment Report')}</h1>
      <div class="meta">${selectedAssessment?.level?.name || ''} ${selectedAssessment?.group?.name ? '· ' + selectedAssessment.group.name : ''}</div>
      <div class="stats">
        <div class="stat"><div class="stat-label">${lang === 'ar' ? 'إجمالي الطلاب' : 'Total Students'}</div><div class="stat-value">${reportStats.total}</div></div>
        <div class="stat"><div class="stat-label">${lang === 'ar' ? 'تم التعيين' : 'Assigned'}</div><div class="stat-value">${reportStats.assigned}</div></div>
        <div class="stat"><div class="stat-label">${lang === 'ar' ? 'تم التقييم' : 'Graded'}</div><div class="stat-value">${reportStats.graded}</div></div>
        <div class="stat"><div class="stat-label">${lang === 'ar' ? 'متوسط الدرجات' : 'Avg Score'}</div><div class="stat-value">${reportStats.avgScore} / ${reportStats.maxScore}</div></div>
        <div class="stat"><div class="stat-label">${lang === 'ar' ? 'نسبة النجاح' : 'Pass Rate'}</div><div class="stat-value">${reportStats.passRate}%</div></div>
      </div>
      <table>
        <thead><tr>
          <th>${lang === 'ar' ? 'الكود' : 'Code'}</th><th>${lang === 'ar' ? 'الطالب' : 'Student'}</th><th>${lang === 'ar' ? 'الصف' : 'Grade'}</th><th>${lang === 'ar' ? 'الحالة' : 'Status'}</th><th>${lang === 'ar' ? 'الدرجة' : 'Mark'}</th><th>${lang === 'ar' ? 'القصوى' : 'Max'}</th><th>${lang === 'ar' ? 'النتيجة' : 'Result'}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#888;font-size:10px">${lang === 'ar' ? 'تم الإنشاء' : 'Generated'} ${new Date().toLocaleString()}</p>
      <button class="no-print" onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer">${lang === 'ar' ? 'طباعة' : 'Print'}</button>
      <script>window.print()</script>
      </body></html>
    `)
    printWin.document.close()
  }

  const markStudent = async (student: StudentRow, score: number, maxScore: number) => {
    if (!selectedAssessment) return
    setSavingMarks(m => ({ ...m, [student.id]: true }))
    try {
      await http.post(`/assessments/${selectedAssessment.id}/students/${student.id}/mark`, { score, maxScore, feedback: '' })
      setStudentRows(rows => rows.map(r => r.id === student.id ? { ...r, mark: score, maxMark: maxScore, assigned: true, submissionStatus: 'completed' } : r))
      toast('success', lang === 'ar' ? `تم تقييم ${student.firstName} ${student.lastName}` : `Marked ${student.firstName} ${student.lastName}`)
    } catch {
      toast('error', lang === 'ar' ? 'فشل تسجيل الدرجة' : 'Failed to record mark')
    }
    setSavingMarks(m => ({ ...m, [student.id]: false }))
  }

  const reassessStudent = async (student: StudentRow) => {
    if (!selectedAssessment) return
    try {
      await http.post(`/assessments/${selectedAssessment.id}/students/${student.id}/reassess`)
      setStudentRows(rows => rows.map(r => r.id === student.id ? { ...r, mark: null, submissionStatus: 'assigned' } : r))
      toast('success', lang === 'ar' ? `تم إعادة فتح تقييم ${student.firstName} ${student.lastName}` : `Re-opened ${student.firstName} ${student.lastName} for marking`)
    } catch {
      toast('error', lang === 'ar' ? 'فشل إعادة فتح التقييم' : 'Failed to re-open submission')
    }
  }

  const getErrorMessage = (err: any, fallbackEn: string, fallbackAr: string) => {
    const msg = err?.response?.data?.message || err?.message || err?.toString?.()
    if (typeof msg === 'string') return msg
    if (Array.isArray(msg)) return msg[0]
    return lang === 'ar' ? fallbackAr : fallbackEn
  }

  const handleCloseForm = () => {
    if (formDirty) {
      const msg = lang === 'ar' ? 'لديك تغييرات غير محفوظة. هل تريد المتابعة؟' : 'You have unsaved changes. Do you want to proceed?'
      if (!window.confirm(msg)) return
    }
    setShowForm(false)
  }

  const updateForm = (partial: Record<string, any>) => {
    setForm(prev => ({ ...prev, ...partial }))
    if (!formDirty) setFormDirty(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!form.title || !form.levelId || !form.subjectId || !form.totalPoints || !form.passingPoints) {
      setFormError(lang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields')
      return
    }
    setSaving(true)
    try {
      const currentYear = academicYears.find(y => y.isCurrent)
      const body: Record<string, any> = {
        title: form.title,
        description: form.description || undefined,
        levelId: form.levelId,
        groupId: form.groupId || undefined,
        grade: form.grade || undefined,
        lessonId: form.lessonId || undefined,
        subjectId: form.subjectId,
        totalPoints: parseInt(form.totalPoints, 10),
        passingPoints: parseInt(form.passingPoints, 10),
        dueDate: form.dueDate || undefined,
        status: form.status,
        term: form.term ? parseInt(form.term, 10) : undefined,
        academicYearId: currentYear?.id || undefined,
        questions: form.questions.map((q, i) => ({
          text: q.text,
          type: q.type,
          options: q.type === 'multiple_choice'
            ? q.options.split('\n').map(o => o.trim()).filter(Boolean)
            : undefined,
          correctAnswer: q.correctAnswer,
          points: parseInt(q.points, 10) || 0,
          orderIndex: i,
        })),
      }

      if (selectedAssessment) {
        await http.put(`/assessments/${selectedAssessment.id}`, body)
      } else {
        await http.post('/assessments', body, { schoolId })
      }

      setShowForm(false)
      fetchAssessments(pagination.page)
      fetchStats()
      toast('success', selectedAssessment ? (lang === 'ar' ? 'تم تحديث التقييم' : 'Assessment updated') : (lang === 'ar' ? 'تم إنشاء التقييم' : 'Assessment created'))
    } catch (err) {
      const msg = getErrorMessage(err, 'Could not save assessment', 'تعذر حفظ التقييم')
      setFormError(msg)
      toast('error', msg)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedAssessment) return
    try {
      await http.delete(`/assessments/${selectedAssessment.id}`)
      setShowDelete(false)
      fetchAssessments(pagination.page)
      fetchStats()
      toast('success', lang === 'ar' ? 'تم حذف التقييم' : 'Assessment deleted')
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not delete assessment', 'تعذر حذف التقييم'))
    }
  }

  const columns = [
    {
      key: 'title',
      header: lang === 'ar' ? 'التقييم' : 'Assessment',
      render: (a: Assessment) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{a.title}</div>
          <div className="text-xs text-gray-500">{a._count.questions} {lang === 'ar' ? 'سؤال' : 'questions'}</div>
        </div>
      ),
    },
    {
      key: 'level',
      header: lang === 'ar' ? 'المستوى' : 'Level',
      render: (a: Assessment) => (
        <span className="text-sm text-gray-700">{a.level?.name || '—'}</span>
      ),
    },
    {
      key: 'group',
      header: lang === 'ar' ? 'المجموعة' : 'Group',
      render: (a: Assessment) => (
        <span className="text-sm text-gray-700">{a.group?.name || '—'}</span>
      ),
    },
    {
      key: 'subject',
      header: lang === 'ar' ? 'المادة' : 'Subject',
      render: (a: Assessment) => (
        <span className="text-sm text-gray-700">{a.subject?.name || '—'}</span>
      ),
    },
    {
      key: 'lesson',
      header: lang === 'ar' ? 'المنهج' : 'Curriculum',
      render: (a: Assessment) => (
        <span className="text-sm text-gray-700">{a.lesson?.title || '—'}</span>
      ),
    },
    {
      key: 'term',
      header: lang === 'ar' ? 'الفصل' : 'Term',
      render: (a: Assessment) => {
        const meta = (a.metadata || {}) as { term?: number }
        const t = meta.term || (a as Assessment & { term?: number }).term
        return t ? (
          <Badge variant="outline" size="sm">{termLabel(t, lang)}</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        )
      },
    },
    {
      key: 'totalPoints',
      header: lang === 'ar' ? 'الدرجات' : 'Points',
      render: (a: Assessment) => (
        <span className="text-sm font-medium text-gray-900">{Number(a.totalPoints)}</span>
      ),
    },
    {
      key: 'dueDate',
      header: lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date',
      render: (a: Assessment) => (
        <span className="text-sm text-gray-700">
          {a.dueDate
            ? new Date(a.dueDate).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </span>
      ),
    },
    {
      key: 'type',
      header: lang === 'ar' ? 'النوع' : 'Type',
      render: (a: Assessment) => (
        <Badge variant={a.type === 'exam' ? 'danger' : a.type === 'test' ? 'warning' : 'info'} size="sm">
          {a.type === 'exam' ? (lang === 'ar' ? 'امتحان' : 'Exam') : a.type === 'test' ? (lang === 'ar' ? 'اختبار' : 'Test') : a.type === 'quiz' ? (lang === 'ar' ? 'مسابقة' : 'Quiz') : a.type === 'oral' ? (lang === 'ar' ? 'شفوي' : 'Oral') : a.type === 'homework' ? (lang === 'ar' ? 'واجب' : 'Homework') : a.type}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: lang === 'ar' ? 'الحالة' : 'Status',
      render: (a: Assessment) => (
        <Badge variant={STATUS_BADGE[a.status] || 'default'}>{a.status === 'draft' ? (lang === 'ar' ? 'مسودة' : 'Draft') : a.status === 'published' ? (lang === 'ar' ? 'منشور' : 'Published') : a.status === 'archived' ? (lang === 'ar' ? 'مؤرشف' : 'Archived') : a.status === 'closed' ? (lang === 'ar' ? 'مغلق' : 'Closed') : a.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (a: Assessment) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openStudents(a) }}
            aria-label={lang === 'ar' ? `طلاب ${a.title}` : `Students for ${a.title}`}
            className="text-gray-400 hover:bg-indigo-50 hover:text-indigo-600">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(a) }}
            aria-label={lang === 'ar' ? `تعديل ${a.title}` : `Edit ${a.title}`}
            className="text-gray-400 hover:bg-amber-50 hover:text-amber-600">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDelete(a) }}
            aria-label={lang === 'ar' ? `حذف ${a.title}` : `Delete ${a.title}`}
            className="text-gray-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]



  // ── Batch Review logic ─────────────────────────────────────────────────
  const ungradedStudents = visibleStudents.filter(r => r.assigned && r.submissionStatus !== 'completed')
  const batchCurrent = batchMode ? (ungradedStudents[batchIndex] ?? null) : null
  const batchEstimated = Math.ceil(ungradedStudents.length * 0.5)

  const batchNext = () => {
    if (batchIndex < ungradedStudents.length - 1) setBatchIndex(i => i + 1)
    else { setBatchMode(false); setBatchIndex(0) }
  }

  const batchMark = async (pass: boolean) => {
    if (!batchCurrent || !selectedAssessment) return
    const maxScore = selectedAssessment ? Number(selectedAssessment.totalPoints) : 10
    const score = pass ? maxScore : Math.floor(maxScore * 0.4)
    await markStudent(batchCurrent, score, maxScore)
    batchNext()
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Batch keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    if (!batchMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); batchMark(true) }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); batchMark(false) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); batchNext() }
      else if (e.key === 'Escape') { setBatchMode(false); setBatchIndex(0) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchMode, batchIndex, batchCurrent, selectedAssessment])
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Batch Review Modal ── */}
      {batchMode && batchCurrent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-indigo-600 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wide">
                  {lang === 'ar' ? 'وضع المراجعة السريعة' : 'Batch Review Mode'}
                </p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {batchIndex + 1} / {ungradedStudents.length} · ~{batchEstimated} {lang === 'ar' ? 'دقيقة' : 'min'}
                </p>
              </div>
              <button onClick={() => { setBatchMode(false); setBatchIndex(0) }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors text-lg font-bold">×</button>
            </div>
            <div className="h-1.5 bg-indigo-100">
              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(batchIndex / Math.max(1, ungradedStudents.length)) * 100}%` }} />
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-bold text-sm shrink-0">
                  {batchCurrent.firstName[0]}{batchCurrent.lastName[0]}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{batchCurrent.firstName} {batchCurrent.lastName}</p>
                  <p className="text-xs text-gray-400">{batchCurrent.studentCode}</p>
                </div>
              </div>
              <div className="mb-5 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-500 flex flex-wrap items-center gap-4">
                <span><kbd className="rounded bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-[10px]">P</kbd> {lang === 'ar' ? 'نجح' : 'Pass'}</span>
                <span><kbd className="rounded bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-[10px]">F</kbd> {lang === 'ar' ? 'راسب' : 'Fail'}</span>
                <span><kbd className="rounded bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-[10px]">→</kbd> {lang === 'ar' ? 'تخطي' : 'Skip'}</span>
                <span><kbd className="rounded bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> {lang === 'ar' ? 'خروج' : 'Exit'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => batchMark(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-500 hover:bg-green-600 active:scale-95 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md shadow-green-200">
                  <CheckCircle className="h-5 w-5" />
                  {lang === 'ar' ? 'نجح' : 'Pass'}
                </button>
                <button onClick={() => batchMark(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md shadow-red-200">
                  <XCircle className="h-5 w-5" />
                  {lang === 'ar' ? 'راسب' : 'Fail'}
                </button>
              </div>
              <button onClick={batchNext}
                className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                <ChevronRight className="h-4 w-4" />
                {lang === 'ar' ? 'تخطي' : 'Skip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'التقييمات' : 'Assessments'}</h1>
          <p className="text-sm text-gray-500">{pagination.total} {lang === 'ar' ? 'تقييم إجمالاً' : 'assessments total'}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {lang === 'ar' ? 'تقييم جديد' : 'New Assessment'}
        </Button>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={lang === 'ar' ? 'إجمالي التقييمات' : 'Total Assessments'} value={stats.total} icon={ClipboardCheck} iconBg="bg-blue-50" iconColor="text-blue-600" />
          {stats.byStatus.slice(0, 2).map(s => (
            <StatCard key={s.status} label={s.status === 'published' ? (lang === 'ar' ? 'منشور' : 'Published') : s.status === 'draft' ? (lang === 'ar' ? 'مسودة' : 'Draft') : s.status === 'archived' ? (lang === 'ar' ? 'مؤرشف' : 'Archived') : s.status === 'closed' ? (lang === 'ar' ? 'مغلق' : 'Closed') : s.status.charAt(0).toUpperCase() + s.status.slice(1)} value={s.count}
              icon={s.status === 'published' ? Eye : s.status === 'draft' ? FileText : s.status === 'archived' ? Clock : ClipboardCheck}
              iconBg={s.status === 'published' ? 'bg-green-50' : s.status === 'draft' ? 'bg-gray-100' : 'bg-blue-50'}
              iconColor={s.status === 'published' ? 'text-green-600' : s.status === 'draft' ? 'text-gray-600' : 'text-blue-600'} />
          ))}
          {stats.byStatus.length > 2 && (
            <StatCard label={lang === 'ar' ? 'حالات أخرى' : 'Other'} value={stats.byStatus.slice(2).reduce((s, x) => s + x.count, 0)} icon={ClipboardCheck}
              iconBg="bg-gray-100" iconColor="text-gray-600" />
          )}
          <StatCard label={lang === 'ar' ? 'تم التقييم' : 'Graded'} value={stats.grading?.gradedCount ?? 0} icon={Check} iconBg="bg-emerald-50" iconColor="text-emerald-600"
            subtitle={stats.grading?.gradedCount ? (lang === 'ar' ? `${stats.grading.passRate}% نسبة النجاح` : `${stats.grading.passRate}% pass rate`) : undefined} />
        </div>
      )}

      {/* Filters */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === 'ar' ? 'بحث عن تقييمات...' : 'Search assessments...'}
        filters={[
          {
            value: filterLevel, onChange: setFilterLevel, label: lang === 'ar' ? 'المستوى' : 'Level',
            options: [{ value: '', label: lang === 'ar' ? 'جميع المستويات' : 'All Levels' }, ...levels.map(l => ({ value: l.id, label: l.name }))],
          },
          {
            value: filterSubject, onChange: setFilterSubject, label: lang === 'ar' ? 'المادة' : 'Subject',
            options: [{ value: '', label: lang === 'ar' ? 'جميع المواد' : 'All Subjects' }, ...subjects.map(s => ({ value: s.id, label: s.name }))],
          },
          {
            value: filterStatus, onChange: setFilterStatus, label: lang === 'ar' ? 'الحالة' : 'Status',
            options: [
              { value: '', label: lang === 'ar' ? 'جميع الحالات' : 'All Status' },
              { value: 'draft', label: lang === 'ar' ? 'مسودة' : 'Draft' },
              { value: 'published', label: lang === 'ar' ? 'منشور' : 'Published' },
              { value: 'archived', label: lang === 'ar' ? 'مؤرشف' : 'Archived' },
            ],
          },
          {
            value: filterType, onChange: setFilterType, label: lang === 'ar' ? 'النوع' : 'Type',
            options: [
              { value: '', label: lang === 'ar' ? 'جميع الأنواع' : 'All Types' },
              { value: 'quiz', label: lang === 'ar' ? 'مسابقة' : 'Quiz' },
              { value: 'test', label: lang === 'ar' ? 'اختبار' : 'Test' },
              { value: 'exam', label: lang === 'ar' ? 'امتحان' : 'Exam' },
              { value: 'oral', label: lang === 'ar' ? 'شفوي' : 'Oral' },
              { value: 'homework', label: lang === 'ar' ? 'واجب' : 'Homework' },
            ],
          },
        ]}
      />

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <DataTable
          columns={columns}
          data={assessments}
          loading={loading}
          keyExtractor={(a) => a.id}
          emptyIcon={ClipboardCheck}
          emptyTitle={lang === 'ar' ? 'لم يتم العثور على تقييمات' : 'No assessments found'}
          emptyDescription={lang === 'ar' ? 'أنشئ تقييمك الأول للبدء' : 'Create your first assessment to get started'}
          emptyAction={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> {lang === 'ar' ? 'تقييم جديد' : 'New Assessment'}
            </Button>
          }
        />

        {!loading && assessments.length > 0 && (
          <div className="border-t border-gray-100">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={(p) => fetchAssessments(p)}
            />
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={showForm}
        onClose={handleCloseForm}
        title={selectedAssessment ? (lang === 'ar' ? 'تعديل التقييم' : 'Edit Assessment') : (lang === 'ar' ? 'إنشاء تقييم' : 'Create Assessment')}
        description={selectedAssessment ? (lang === 'ar' ? 'قم بتحديث تفاصيل التقييم أدناه' : 'Update the assessment details below') : (lang === 'ar' ? 'املأ التفاصيل لإنشاء تقييم جديد' : 'Fill in the details to create a new assessment')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={handleCloseForm}
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedAssessment ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إنشاء تقييم' : 'Create Assessment')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">
              {formError}
            </div>
          )}

          <FormField label={lang === 'ar' ? 'العنوان' : 'Title'} required value={form.title} onChange={e => updateForm({ title: e.target.value })} placeholder={lang === 'ar' ? 'عنوان التقييم' : 'Assessment title'} />

          <FormField label={lang === 'ar' ? 'الوصف' : 'Description'} as="textarea" value={form.description} onChange={e => updateForm({ description: e.target.value })} placeholder={lang === 'ar' ? 'وصف اختياري' : 'Optional description'} />

          <div className="grid grid-cols-3 gap-4">
            <FormField label={lang === 'ar' ? 'المستوى' : 'Level'} required as="select" value={form.levelId} onChange={e => updateForm({ levelId: e.target.value, groupId: '' })}>
              <option value="">{lang === 'ar' ? 'اختر المستوى' : 'Select level'}</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </FormField>
            <FormField label={lang === 'ar' ? 'المجموعة' : 'Group'} as="select" value={form.groupId} onChange={e => updateForm({ groupId: e.target.value })}>
              <option value="">{lang === 'ar' ? 'جميع المجموعات' : 'All Groups'}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </FormField>
            <FormField label={lang === 'ar' ? 'الصف' : 'Grade'} as="select" value={form.grade} onChange={e => updateForm({ grade: e.target.value })}>
              <option value="">{lang === 'ar' ? 'جميع الصفوف' : 'All Grades'}</option>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </FormField>
            <FormField label={lang === 'ar' ? 'المادة' : 'Subject'} required as="select" value={form.subjectId} onChange={e => updateForm({ subjectId: e.target.value })}>
              <option value="">{lang === 'ar' ? 'اختر المادة' : 'Select subject'}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FormField>
            <FormField label={lang === 'ar' ? 'عنصر المنهج' : 'Curriculum Item'} as="select" value={form.lessonId} onChange={e => updateForm({ lessonId: e.target.value })}>
              <option value="">{lang === 'ar' ? 'اختر عنصر المنهج' : 'Select curriculum item'}</option>
              {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label={lang === 'ar' ? 'الدرجة القصوى' : 'Total Points'} required type="number" min="1" value={form.totalPoints} onChange={e => updateForm({ totalPoints: e.target.value })} placeholder="100" />
            <FormField label={lang === 'ar' ? 'درجة النجاح' : 'Passing Points'} required type="number" min="1" value={form.passingPoints} onChange={e => updateForm({ passingPoints: e.target.value })} placeholder="60" />
            <div>
              <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
              <DatePicker value={form.dueDate} onChange={v => updateForm({ dueDate: v })} className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label={lang === 'ar' ? 'الفصل' : 'Term'} as="select" value={form.term} onChange={e => updateForm({ term: e.target.value })}>
              <option value="">{lang === 'ar' ? 'اختر الفصل' : 'Select term'}</option>
              <option value="1">{lang === 'ar' ? 'الفصل الأول (سبتمبر-ديسمبر)' : 'Term 1 (Sep-Dec)'}</option>
              <option value="2">{lang === 'ar' ? 'الفصل الثاني (يناير-مارس)' : 'Term 2 (Jan-Mar)'}</option>
              <option value="3">{lang === 'ar' ? 'الفصل الثالث (أبريل-يونيو)' : 'Term 3 (Apr-Jun)'}</option>
            </FormField>
            <FormField label={lang === 'ar' ? 'الحالة' : 'Status'} as="select" value={form.status} onChange={e => updateForm({ status: e.target.value })}>
              <option value="draft">{lang === 'ar' ? 'مسودة' : 'Draft'}</option>
              <option value="published">{lang === 'ar' ? 'منشور' : 'Published'}</option>
              <option value="archived">{lang === 'ar' ? 'مؤرشف' : 'Archived'}</option>
            </FormField>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'الأسئلة' : 'Questions'}</div>
              <Button variant="outline" size="sm" onClick={() => {
                updateForm({ questions: [...form.questions, { text: '', type: 'multiple_choice', options: '', correctAnswer: '', points: '1' }] })
              }}
                >
                <Plus className="h-3.5 w-3.5" /> {lang === 'ar' ? 'إضافة سؤال' : 'Add Question'}
              </Button>
            </div>

            {form.questions.length === 0 && (
              <p className="text-xs text-gray-400">{lang === 'ar' ? 'لم تتم إضافة أسئلة. يمكنك نشر تقييم بدون أسئلة، أو إضافة أسئلة أعلاه.' : 'No questions added. You can publish an assessment without questions, or add questions above.'}</p>
            )}

            <div className="space-y-3">
              {form.questions.map((q, qi) => (
                <div key={qi} className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-xs font-medium text-gray-400">#{qi + 1}</span>
                    <div className="flex-1">
                      <input value={q.text} onChange={e => {
                        const questions = [...form.questions]; questions[qi].text = e.target.value; updateForm({ questions })
                      }} placeholder={lang === 'ar' ? 'نص السؤال' : 'Question text'}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => updateForm({ questions: form.questions.filter((_, i) => i !== qi) })}
                      className="mt-1 text-red-600 hover:bg-red-50 border border-red-200">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <select value={q.type} onChange={e => {
                      const questions = [...form.questions]; questions[qi].type = e.target.value as QuestionDraft['type']; updateForm({ questions })
                    }}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="multiple_choice">{lang === 'ar' ? 'اختيار من متعدد' : 'Multiple Choice'}</option>
                      <option value="true_false">{lang === 'ar' ? 'صواب / خطأ' : 'True / False'}</option>
                      <option value="short_answer">{lang === 'ar' ? 'إجابة قصيرة' : 'Short Answer'}</option>
                      <option value="essay">{lang === 'ar' ? 'مقال' : 'Essay'}</option>
                    </select>
                    <input type="number" min="1" value={q.points} onChange={e => {
                      const questions = [...form.questions]; questions[qi].points = e.target.value; updateForm({ questions })
                    }} placeholder={lang === 'ar' ? 'الدرجات' : 'Points'}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  {q.type === 'multiple_choice' && (
                    <textarea value={q.options} onChange={e => {
                      const questions = [...form.questions]; questions[qi].options = e.target.value; updateForm({ questions })
                    }} placeholder={lang === 'ar' ? 'الخيارات (واحد لكل سطر)' : 'Options (one per line)'}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 pl-6" />
                  )}
                  <input value={q.correctAnswer} onChange={e => {
                    const questions = [...form.questions]; questions[qi].correctAnswer = e.target.value; updateForm({ questions })
                  }} placeholder={q.type === 'true_false' ? (lang === 'ar' ? 'صواب / خطأ' : 'true / false') : (lang === 'ar' ? 'الإجابة الصحيحة' : 'Correct answer')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 pl-6" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Students — Assign, Mark & Report */}
      <Modal
        open={showStudents}
        onClose={() => { setShowStudents(false); setShowReport(false) }}
        title={lang === 'ar' ? 'الطلاب' : 'Students'}
        description={selectedAssessment ? `${selectedAssessment.level?.name || ''} ${selectedAssessment.group?.name ? '· ' + selectedAssessment.group.name : ''}` : ''}
        size="lg"
      >
        {/* View toggle */}
        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
          <button onClick={() => setShowReport(false)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${!showReport ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Users className="h-4 w-4 inline mr-1.5" />{lang === 'ar' ? 'تعيين' : 'Assign'}
          </button>
          <button onClick={() => setShowReport(true)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${showReport ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <FileText className="h-4 w-4 inline mr-1.5" />{lang === 'ar' ? 'تقرير' : 'Report'}
          </button>
        </div>

        {!showReport ? (
          /* === Assign View === */
          <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <select value={studentGradeFilter} onChange={e => setStudentGradeFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">{lang === 'ar' ? 'جميع الصفوف' : 'All Grades'}</option>
                  {gradeFilterOptions.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div className="text-sm text-gray-500">
                  {lang === 'ar' ? `${visibleStudents.filter(r => r.assigned).length} من ${visibleStudents.length} تم تعيينهم` : `${visibleStudents.filter(r => r.assigned).length} of ${visibleStudents.length} assigned`}
                </div>
                <Button variant="outline" size="sm" onClick={() => assignStudents(visibleStudents.filter(r => !r.assigned).map(r => r.id))}
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                  {lang === 'ar' ? 'تعيين الكل' : 'Assign All'}
                </Button>
                {visibleStudents.filter(r => r.assigned).length > 0 && (
                  <Button variant="outline" size="sm" onClick={async () => {
                    const ids = visibleStudents.filter(r => r.assigned).map(r => r.id)
                    await Promise.allSettled(ids.map(id => deassignStudent(id)))
                  }}
                    className="text-red-600 border-red-200 hover:bg-red-50">
                    {lang === 'ar' ? 'إلغاء تعيين الكل' : 'Deassign All'}
                  </Button>
                )}
                {(() => {
                  const ungradedCount = visibleStudents.filter(r => r.assigned && r.submissionStatus !== 'completed').length
                  const estimatedMinutes = Math.ceil(ungradedCount * 0.5)
                  return ungradedCount > 0 ? (
                    <Button
                      size="sm"
                      onClick={() => { setBatchMode(true); setBatchIndex(0) }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {lang === 'ar' ? `مراجعة دُفعة (${ungradedCount}) ~${estimatedMinutes}د` : `Batch Review (${ungradedCount}) ~${estimatedMinutes}m`}
                    </Button>
                  ) : null
                })()}
              </div>

              {studentsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
                </div>
              ) : visibleStudents.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">{lang === 'ar' ? 'لم يتم العثور على طلاب لهذا المستوى/المجموعة.' : 'No students found for this level/group.'}</p>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
                  {visibleStudents.map(r => (
                    <div key={r.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {r.firstName} {r.lastName}
                          {r.schoolGrade && <span className="ml-2 text-xs text-gray-400">{r.schoolGrade}</span>}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">{r.studentCode || '—'}</div>
                      </div>

                      {!r.assigned ? (
                        <Button variant="outline" size="sm" onClick={() => assignStudents([r.id])}
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                          {lang === 'ar' ? 'تعيين' : 'Assign'}
                        </Button>
                      ) : r.submissionStatus === 'completed' ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 min-w-[3rem] text-right">{r.mark ?? '—'}</span>
                            <span className="text-xs text-gray-400">{r.maxMark}</span>
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{lang === 'ar' ? 'مكتمل' : 'Completed'}</span>
                              <Button variant="ghost" size="icon" onClick={() => deassignStudent(r.id)}
                                className="text-red-600 hover:bg-red-50 border border-red-200"
                                title={lang === 'ar' ? 'إلغاء التعيين' : 'De-assign'}>
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => reassessStudent(r)}
                              className="text-amber-700 border-amber-300 hover:bg-amber-50">
                              {lang === 'ar' ? 'إعادة تقييم' : 'Re-assess'}
                            </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">{lang === 'ar' ? 'تم التعيين' : 'Assigned'}</span>
                              <Button variant="ghost" size="icon" onClick={() => deassignStudent(r.id)}
                                className="text-red-600 hover:bg-red-50 border border-red-200"
                                title={lang === 'ar' ? 'إلغاء التعيين' : 'De-assign'}>
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <input
                            type="number"
                            min="0"
                            value={markValues[r.id] ?? (r.mark !== null ? String(r.mark) : '')}
                            onChange={e => setMarkValues(prev => ({ ...prev, [r.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const target = e.currentTarget
                                const val = target.value === '' ? 0 : Number(target.value)
                                if (val === 0 && !window.confirm(lang === 'ar' ? `تأكيد درجة 0 لـ ${r.firstName} ${r.lastName}؟` : `Submit score of 0 for ${r.firstName} ${r.lastName}?`)) return
                                markStudent(r, val, r.maxMark)
                                setMarkValues(prev => ({ ...prev, [r.id]: '' }))
                              }
                            }}
                            aria-label={lang === 'ar' ? `درجة ${r.firstName} ${r.lastName}` : `Mark for ${r.firstName} ${r.lastName}`}
                            placeholder={`/ ${r.maxMark}`}
                            className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const val = (markValues[r.id] || '') === '' ? 0 : Number(markValues[r.id])
                              if (val === 0 && !window.confirm(lang === 'ar' ? `تأكيد درجة 0 لـ ${r.firstName} ${r.lastName}؟` : `Submit score of 0 for ${r.firstName} ${r.lastName}?`)) return
                              markStudent(r, val, r.maxMark)
                              setMarkValues(prev => ({ ...prev, [r.id]: '' }))
                            }}
                            disabled={savingMarks[r.id]}
                            >
                            {savingMarks[r.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        ) : (
          /* === Report View === */
          <div ref={reportRef} className="space-y-4">
            {/* Stats summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: lang === 'ar' ? 'إجمالي الطلاب' : 'Total Students', value: reportStats.total, color: 'text-gray-900' },
                { label: lang === 'ar' ? 'تم التعيين' : 'Assigned', value: reportStats.assigned, color: 'text-blue-600' },
                { label: lang === 'ar' ? 'تم التقييم' : 'Graded', value: reportStats.graded, color: 'text-green-600' },
                { label: lang === 'ar' ? 'متوسط الدرجات' : 'Avg Score', value: `${reportStats.avgScore}/${reportStats.maxScore}`, color: 'text-amber-600' },
                { label: lang === 'ar' ? 'نسبة النجاح' : 'Pass Rate', value: `${reportStats.passRate}%`, color: reportStats.passRate >= 60 ? 'text-green-600' : 'text-red-600' },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</div>
                  <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportReportCSV}
                >
                <Download className="h-3.5 w-3.5" /> {lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}
              </Button>
              <Button variant="outline" size="sm" onClick={printReport}
                >
                <Printer className="h-3.5 w-3.5" /> {lang === 'ar' ? 'طباعة' : 'Print'}
              </Button>
              <div className="ml-auto text-xs text-gray-400">
                {lang === 'ar' ? `${reportStats.assigned} تم التعيين · ${reportStats.graded} تم التقييم · ${reportStats.passed} نجح` : `${reportStats.assigned} assigned · ${reportStats.graded} graded · ${reportStats.passed} passed`}
              </div>
            </div>

            {/* Report table */}
            {assignedStudents.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لم يتم تعيين طلاب بعد.' : 'No students assigned yet.'}</p>
            ) : (
              <div className="max-h-[45vh] overflow-y-auto overflow-x-auto table-to-cards border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الكود' : 'Code'}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الطالب' : 'Student'}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الصف' : 'Grade'}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الدرجة' : 'Mark'}</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'القصوى' : 'Max'}</th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'النتيجة' : 'Result'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assignedStudents.map(r => {
                      const isPass = r.mark !== null && r.mark >= reportStats.passThreshold
                      return (
                        <tr key={r.id} className={`hover:bg-gray-50/50 active:bg-gray-100/50 ${r.mark !== null ? (isPass ? 'bg-green-50/30' : 'bg-red-50/30') : ''}`}>
                          <td data-label={lang === 'ar' ? 'الكود' : 'Code'} className="px-3 py-2.5 text-xs text-gray-500 font-mono">{r.studentCode || '—'}</td>
                          <td data-label={lang === 'ar' ? 'الطالب' : 'Student'} className="px-3 py-2.5 text-sm font-medium text-gray-900">{r.firstName} {r.lastName}</td>
                          <td data-label={lang === 'ar' ? 'الصف' : 'Grade'} className="px-3 py-2.5 text-sm text-gray-600">{r.schoolGrade || '—'}</td>
                          <td data-label={lang === 'ar' ? 'الحالة' : 'Status'} className="px-3 py-2.5">
                            <Badge variant={r.submissionStatus === 'completed' ? 'success' : r.submissionStatus === 'assigned' ? 'info' : 'default'} size="sm">
                              {r.submissionStatus === 'completed' ? (lang === 'ar' ? 'مكتمل' : 'completed') : r.submissionStatus === 'assigned' ? (lang === 'ar' ? 'تم التعيين' : 'assigned') : r.submissionStatus || '—'}
                            </Badge>
                          </td>
                                                    <td data-label={lang === 'ar' ? 'الدرجة' : 'Mark'} className="px-3 py-2.5 text-sm text-right font-medium">{r.mark !== null ? r.mark : '—'}</td>
                          <td data-label={lang === 'ar' ? 'القصوى' : 'Max'} className="px-3 py-2.5 text-sm text-right text-gray-500">{r.maxMark}</td>
                          <td data-label={lang === 'ar' ? 'النتيجة' : 'Result'} className="px-3 py-2.5 text-center">
                            {r.mark !== null ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold ${isPass ? 'text-green-600' : 'text-red-600'}`}>
                                {isPass ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                {isPass ? (lang === 'ar' ? 'ناجح' : 'PASS') : (lang === 'ar' ? 'راسب' : 'FAIL')}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={lang === 'ar' ? 'حذف التقييم' : 'Delete Assessment'}
        message={lang === 'ar' ? `هل أنت متأكد من حذف "${selectedAssessment?.title}"؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete "${selectedAssessment?.title}"? This action cannot be undone.`}
        confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
      />
    </div>
  )
}
