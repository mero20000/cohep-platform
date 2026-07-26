'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Loader2, GraduationCap } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/use-language'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'

interface GradeItem {
  id: string
  name: string
  status: 'active' | 'inactive'
}

interface ConfigResponse {
  id: string
  schoolId: string | null
  key: string
  value: GradeItem[]
}

const emptyForm = { name: '', status: 'active' as 'active' | 'inactive' }

export function GradesTab() {
  const lang = useLanguage()
  const { toast } = useToast()
  const [grades, setGrades] = useState<GradeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<GradeItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchGrades = useCallback(async () => {
    setLoading(true)
    try {
      const data: any = await http.get(`/users/schools/${getSchoolId()}/config?key=grades`)
      let rows: any[] = []
      if (Array.isArray(data)) {
        const match = data.find((c: any) => c.key === 'grades')
        rows = match?.value || []
      } else if (data && Array.isArray(data.value)) {
        rows = data.value
      }
      setGrades(Array.isArray(rows) ? rows : [])
    } catch {
      setGrades([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchGrades() }, [fetchGrades])

  const persist = async (next: GradeItem[]) => {
    setSaving(true)
    try {
      await http.post(`/users/schools/${getSchoolId()}/config`, {
        key: 'grades', value: next, description: 'Grade levels configuration',
      })
      await fetchGrades()
      setShowForm(false)
      toast('success', lang === 'ar' ? 'تم حفظ الصفوف الدراسية' : 'Grades saved')
    } catch {
      setError(lang === 'ar' ? 'فشل حفظ الصفوف الدراسية' : 'Failed to save grades')
    }
    setSaving(false)
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true) }

  const openEdit = (g: GradeItem) => {
    setEditing(g)
    setForm({ name: g.name, status: g.status })
    setError('')
    setShowForm(true)
  }

  const handleSave = () => {
    setError('')
    if (!form.name.trim()) { setError(lang === 'ar' ? 'اسم الصف مطلوب' : 'Grade name is required'); return }
    const name = form.name.trim()
    const duplicate = grades.some(g => g.id !== editing?.id && g.name.toLowerCase() === name.toLowerCase())
    if (duplicate) { setError(lang === 'ar' ? 'يوجد صف بنفس الاسم بالفعل' : 'A grade with this name already exists'); return }
    const next = editing
      ? grades.map(g => g.id === editing.id ? { ...g, name, status: form.status } : g)
      : [...grades, { id: `grade-${Date.now()}`, name, status: form.status }]
    persist(next)
  }

  const toggleStatus = (g: GradeItem) => {
    persist(grades.map(x => x.id === g.id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x))
  }

  const handleDelete = (g: GradeItem) => {
    if (!confirm(lang === 'ar' ? `حذف الصف "${g.name}"؟` : `Delete grade "${g.name}"?`)) return
    persist(grades.filter(x => x.id !== g.id))
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'الصفوف الدراسية' : 'Grades'}</h3>
          <p className="text-sm text-gray-500">{lang === 'ar' ? 'تكوين الصفوف الدراسية وحالتها' : 'Configure grade levels and their availability'}</p>
        </div>
        <Button onClick={openCreate} aria-label={lang === 'ar' ? 'إضافة صف' : 'Add grade'} size="sm">
          <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة صف' : 'Add Grade'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>
      ) : grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <GraduationCap className="h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">{lang === 'ar' ? 'لم يتم تكوين صفوف دراسية' : 'No grades configured'}</p>
          <Button variant="link" onClick={openCreate} className="mt-2 text-sm font-medium text-blue-700 hover:text-gold-500">{lang === 'ar' ? 'إضافة أول صف' : 'Add first grade'}</Button>
        </div>
      ) : (
          <div className="overflow-x-auto table-to-cards">
            <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الصف' : 'Grade'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grades.map(g => (
                <tr key={g.id} className="hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors">
                    <td className="px-6 py-3.5 text-sm font-medium text-gray-900" data-label={lang === 'ar' ? 'الصف' : 'Grade'}>{g.name}</td>
                    <td className="px-6 py-3.5" data-label={lang === 'ar' ? 'الحالة' : 'Status'}>
                      <button onClick={() => toggleStatus(g)}>
                      <Badge variant={g.status === 'active' ? 'success' : 'default'}>{g.status === 'active' ? (lang === 'ar' ? 'نشط' : 'active') : (lang === 'ar' ? 'غير نشط' : 'inactive')}</Badge>
                    </button>
                  </td>
                    <td className="px-6 py-3.5 text-right" data-label={lang === 'ar' ? 'الإجراءات' : 'Actions'}>
                      <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)} aria-label={`${lang === 'ar' ? 'تعديل' : 'Edit'} ${g.name}`} title={lang === 'ar' ? 'تعديل' : 'Edit'}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(g)} aria-label={`${lang === 'ar' ? 'حذف' : 'Delete'} ${g.name}`} title={lang === 'ar' ? 'حذف' : 'Delete'}
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? (lang === 'ar' ? 'تعديل الصف' : 'Edit Grade') : (lang === 'ar' ? 'إضافة صف' : 'Add Grade')} size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
          <FormField label={lang === 'ar' ? 'اسم الصف' : 'Grade Name'} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={lang === 'ar' ? 'مثال: الصف الأول' : 'e.g. Grade 1'} />
          <FormField label={lang === 'ar' ? 'الحالة' : 'Status'} as="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
            <option value="active">{lang === 'ar' ? 'نشط' : 'Active'}</option>
            <option value="inactive">{lang === 'ar' ? 'غير نشط' : 'Inactive'}</option>
          </FormField>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إضافة صف' : 'Add Grade')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
