'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Loader2, GraduationCap } from 'lucide-react'
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
      <div className="rounded-xl border border-gray-200 bg-white flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
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
              {grades.map(grade => (
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
