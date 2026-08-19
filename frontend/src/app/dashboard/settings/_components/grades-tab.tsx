'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Loader2, GraduationCap, Search, X } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/use-language'
import { track } from '@/lib/analytics'
import {
  type GradeItem,
  type GroupOption,
  fetchGrades,
  fetchGroups,
  createGrade,
  updateGrade,
  deleteGrade,
} from '@/lib/grades'

const emptyForm = { name: '', nameAr: '', groupId: '' }

export function GradesTab() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [grades, setGrades] = useState<GradeItem[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<GradeItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [sort, setSort] = useState('name-asc')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([fetchGrades(), fetchGroups()])
      .then(([gradesData, groupsData]) => {
        if (!mounted) return
        setGrades(gradesData)
        setGroups(groupsData)
      })
      .catch(() => {
        if (mounted) toast('error', t('Failed to load data', 'فشل تحميل البيانات'))
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const activeGroups = groups.filter(g => g.status !== 'inactive')

  const hasActiveFilters = search.trim() !== '' || filterGroup !== '' || filterStatus !== 'all' || sort !== 'name-asc'

  const clearFilters = () => {
    setSearch('')
    setFilterGroup('')
    setFilterStatus('all')
    setSort('name-asc')
  }

  const filteredGrades = useMemo(() => {
    const q = search.trim().toLowerCase()
    const result = grades.filter(g => {
      if (q && !(g.name.toLowerCase().includes(q) || (g.nameAr || '').toLowerCase().includes(q))) return false
      if (filterGroup && g.groupId !== filterGroup) return false
      if (filterStatus !== 'all' && g.status !== filterStatus) return false
      return true
    })
    const sorted = [...result]
    switch (sort) {
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'students-desc':
        sorted.sort((a, b) => (b.studentCount ?? 0) - (a.studentCount ?? 0))
        break
      case 'students-asc':
        sorted.sort((a, b) => (a.studentCount ?? 0) - (b.studentCount ?? 0))
        break
      case 'status':
        sorted.sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1))
        break
      case 'name-asc':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
    }
    return sorted
  }, [grades, search, filterGroup, filterStatus, sort])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const openEdit = (grade: GradeItem) => {
    setEditing(grade)
    setForm({ name: grade.name, nameAr: grade.nameAr || '', groupId: grade.groupId || '' })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) {
      setError(t('Grade name is required', 'اسم الصف مطلوب'))
      return
    }
    if (!form.groupId) {
      setError(t('Please select a group', 'يرجى اختيار مجموعة'))
      return
    }
    const name = form.name.trim()
    const nameAr = form.nameAr.trim() || undefined
    const groupId = form.groupId

    if (editing && editing.groupId && editing.groupId !== groupId) {
      const ok = window.confirm(t(
        `Changing the group will move all students in "${editing.name}" to the new group. Continue?`,
        `سيؤدي تغيير المجموعة إلى نقل جميع طلاب "${editing.name}" إلى المجموعة الجديدة. متابعة؟`,
      ))
      if (!ok) return
    }

    setSaving(true)
    try {
      if (editing) {
        const updated = await updateGrade(editing.id, { name, nameAr, groupId, status: editing.status })
        const group = groups.find(g => g.id === groupId)
        setGrades(prev => prev.map(g => g.id === editing.id
          ? { ...g, ...updated, name, nameAr, groupId, groupName: updated.groupName || group?.name }
          : g))
        toast('success', t('Grade updated', 'تم تحديث الصف'))
        track('settings.task_completed', 'task', { tab: 'grades', action: 'update' })
      } else {
        const created = await createGrade({ name, nameAr, groupId })
        const group = groups.find(g => g.id === groupId)
        setGrades(prev => [...prev, { ...created, name, nameAr, groupId, groupName: created.groupName || group?.name, status: created.status || 'active' }])
        toast('success', t('Grade added', 'تم إضافة الصف'))
        track('settings.task_completed', 'task', { tab: 'grades', action: 'create' })
      }
      setShowForm(false)
    } catch {
      toast('error', t('Failed to save', 'فشل الحفظ'))
    }
    setSaving(false)
  }

  const toggleStatus = async (grade: GradeItem) => {
    const newStatus: 'active' | 'inactive' = grade.status === 'active' ? 'inactive' : 'active'
    setSaving(true)
    try {
      await updateGrade(grade.id, { status: newStatus })
      setGrades(prev => prev.map(g => g.id === grade.id ? { ...g, status: newStatus } : g))
      toast('success', t('Status updated', 'تم تحديث الحالة'))
      track('settings.task_completed', 'task', { tab: 'grades', action: 'status' })
    } catch {
      toast('error', t('Failed to update status', 'فشل تحديث الحالة'))
    }
    setSaving(false)
  }

  const handleDelete = async (grade: GradeItem) => {
    const message = grade.studentCount && grade.studentCount > 0
      ? t(
        `Delete "${grade.name}"? ${grade.studentCount} student(s) are linked to this grade and will be removed from it.`,
        `حذف "${grade.name}"؟ يوجد ${grade.studentCount} طالب مرتبط بهذا الصف وسيتم إزالة الصف منهم.`,
      )
      : t(`Delete "${grade.name}"? This action cannot be undone.`, `حذف "${grade.name}"؟ لا يمكن التراجع عن هذا الإجراء.`)
    if (!window.confirm(message)) return
    setSaving(true)
    try {
      await deleteGrade(grade.id)
      setGrades(prev => prev.filter(g => g.id !== grade.id))
      toast('success', t('Grade deleted', 'تم حذف الصف'))
      track('settings.task_completed', 'task', { tab: 'grades', action: 'delete' })
    } catch {
      toast('error', t('Failed to delete', 'فشل الحذف'))
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-16">
        <TableSkeleton rows={6} cols={4} />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t('Grades', 'الصفوف الدراسية')}</h3>
          <p className="text-sm text-gray-500">{t('Each grade is linked to a group', 'كل صف مرتبط بمجموعة')}</p>
        </div>
        <Button onClick={openCreate} aria-label={t('Add grade', 'إضافة صف')} size="sm">
          <Plus className="h-4 w-4" /> {t('Add Grade', 'إضافة صف')}
        </Button>
      </div>

      {grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <GraduationCap className="h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">{t('No grades yet', 'لا توجد صفوف بعد')}</p>
          <Button variant="link" onClick={openCreate} className="mt-2 text-sm font-medium text-blue-700 hover:text-gold-500">{t('Add first grade', 'إضافة أول صف')}</Button>
        </div>
      ) : (
        <>
          {/* Filters & sorting */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input type="text" aria-label={t('Search grades', 'بحث عن الصفوف')} placeholder={t('Search grades...', 'بحث عن الصفوف...')} value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 ps-9 pe-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <select aria-label={t('Filter by group', 'تصفية حسب المجموعة')} value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">{t('All Groups', 'جميع المجموعات')}</option>
              {activeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select aria-label={t('Filter by status', 'تصفية حسب الحالة')} value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="all">{t('All Statuses', 'جميع الحالات')}</option>
              <option value="active">{t('Active', 'نشط')}</option>
              <option value="inactive">{t('Inactive', 'غير نشط')}</option>
            </select>
            <select aria-label={t('Sort by', 'ترتيب حسب')} value={sort} onChange={e => setSort(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="name-asc">{t('Name (A–Z)', 'الاسم (أ–ي)')}</option>
              <option value="name-desc">{t('Name (Z–A)', 'الاسم (ي–أ)')}</option>
              <option value="students-desc">{t('Students (High–Low)', 'الطلاب (الأكثر أولاً)')}</option>
              <option value="students-asc">{t('Students (Low–High)', 'الطلاب (الأقل أولاً)')}</option>
              <option value="status">{t('Status (Active first)', 'الحالة (النشط أولاً)')}</option>
            </select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />{t('Clear', 'مسح')}
              </Button>
            )}
          </div>

          {filteredGrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">{t('No grades match your filters', 'لا توجد صفوف تطابق عوامل التصفية')}</p>
              <Button variant="link" onClick={clearFilters} className="mt-2 text-sm font-medium text-blue-700 hover:text-gold-500">{t('Clear filters', 'مسح عوامل التصفية')}</Button>
            </div>
          ) : (
            <div className="overflow-x-auto table-to-cards">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Grade', 'الصف')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Group', 'المجموعة')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Students', 'الطلاب')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Status', 'الحالة')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('Actions', 'الإجراءات')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredGrades.map(grade => (
                    <tr key={grade.id} className="hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors">
                      <td className="px-6 py-3.5" data-label={t('Grade', 'الصف')}>
                        <p className="text-sm font-medium text-gray-900">{grade.name}</p>
                        {grade.nameAr && <p className="text-xs text-gray-500">{grade.nameAr}</p>}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-gray-600" data-label={t('Group', 'المجموعة')}>
                        {grade.groupName || '—'}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-gray-600" data-label={t('Students', 'الطلاب')}>
                        {grade.studentCount ?? 0}
                      </td>
                      <td className="px-6 py-3.5" data-label={t('Status', 'الحالة')}>
                        <button onClick={() => toggleStatus(grade)} disabled={saving}>
                          <Badge variant={grade.status === 'active' ? 'success' : 'default'}>
                            {grade.status === 'active' ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-6 py-3.5 text-right" data-label={t('Actions', 'الإجراءات')}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(grade)} aria-label={`${t('Edit', 'تعديل')} ${grade.name}`} title={t('Edit', 'تعديل')}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(grade)} aria-label={`${t('Delete', 'حذف')} ${grade.name}`} title={t('Delete', 'حذف')}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('Edit Grade', 'تعديل الصف') : t('Add New Grade', 'إضافة صف جديد')} size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
          <FormField label={t('Grade Name', 'اسم الصف')} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('e.g. Grade 4', 'مثال: الصف الرابع')} />
          <FormField label={t('Arabic Name', 'الاسم بالعربية')} value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} placeholder={t('e.g. الصف الرابع', 'مثال: الصف الرابع')} />
          <FormField label={t('Group', 'المجموعة')} required as="select" value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}>
            <option value="">{t('Select a group', 'اختر مجموعة')}</option>
            {activeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </FormField>
          {editing && (
            <FormField label={t('Status', 'الحالة')} as="select" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
              <option value="active">{t('Active', 'نشط')}</option>
              <option value="inactive">{t('Inactive', 'غير نشط')}</option>
            </FormField>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? t('Save Changes', 'حفظ التغييرات') : t('Add Grade', 'إضافة صف')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
