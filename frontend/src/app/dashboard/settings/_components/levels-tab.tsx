'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Loader2, Check, X } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { FormField } from '@/components/ui/form-field'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'

interface Level {
  id: string
  name: string
  nameAr?: string
  number: number
  status: string
  description?: string
}

const emptyForm = { name: '', nameAr: '', description: '' }

export function LevelsTab() {
  const { toast } = useToast()
  const lang = useLanguage()

  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<Record<string, boolean>>({})

  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [showForm, setShowForm] = useState(false)
  const [editingLevel, setEditingLevel] = useState<Level | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchLevels = () => {
    setLoading(true)
    http.get<Level[]>('/curriculum/levels', { schoolId: getSchoolId() })
      .then(setLevels)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLevels() }, [])

  const toggleStatus = async (level: Level) => {
    const newStatus = level.status === 'active' ? 'inactive' : 'active'
    setToggling(prev => ({ ...prev, [level.id]: true }))
    try {
      await http.patch(`/curriculum/levels/${level.id}`, { status: newStatus })
      setLevels(prev => prev.map(l => l.id === level.id ? { ...l, status: newStatus } : l))
      toast('success', lang === 'ar' ? `تم ${newStatus === 'active' ? 'تفعيل' : 'إلغاء تفعيل'} المستوى "${level.name}"` : `Level "${level.name}" ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    } catch {
      toast('error', lang === 'ar' ? 'فشل تحديث حالة المستوى' : 'Failed to update level status')
    }
    setToggling(prev => ({ ...prev, [level.id]: false }))
  }

  const openCreate = () => {
    setMode('create')
    setEditingLevel(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (level: Level) => {
    setMode('edit')
    setEditingLevel(level)
    setForm({ name: level.name, nameAr: level.nameAr || '', description: level.description || '' })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!form.name.trim()) { setFormError(lang === 'ar' ? 'اسم المستوى مطلوب' : 'Level name is required'); return }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        nameAr: form.nameAr.trim() || undefined,
        description: form.description.trim() || undefined,
      }

      if (mode === 'edit' && editingLevel) {
        await http.patch(`/curriculum/levels/${editingLevel.id}`, body)
        setShowForm(false)
        fetchLevels()
        toast('success', lang === 'ar' ? 'تم تحديث المستوى' : 'Level updated')
      } else {
        await http.post('/curriculum/levels', body, { schoolId: getSchoolId() })
        setShowForm(false)
        setForm(emptyForm)
        fetchLevels()
        toast('success', lang === 'ar' ? `تم إنشاء المستوى "${form.name}"` : `Level "${form.name}" created`)
      }
    } catch {
      setFormError(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
    }
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'المستويات' : 'Levels'}</h2>
          <p className="mt-1 text-sm text-gray-500">{lang === 'ar' ? 'إدارة المستويات وتبديل حالتها' : 'Manage levels and toggle their active status'}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة مستوى' : 'Add Level'}
        </Button>
      </div>

      {loading ? (
        <div className="px-4 py-12">
          <TableSkeleton rows={5} cols={3} />
        </div>
      ) : levels.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">{lang === 'ar' ? 'لا توجد مستويات بعد. انقر على "إضافة مستوى" لإنشاء واحد.' : 'No levels yet. Click "Add Level" to create one.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {levels.map(level => (
            <div key={level.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                  {level.number}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{level.name}</p>
                  {level.nameAr && <p className="text-xs text-gray-500">{level.nameAr}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(level)}
                  aria-label={lang === 'ar' ? `تعديل ${level.name}` : `Edit ${level.name}`}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                  <Pencil className="h-4 w-4" />
                </Button>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  level.status === 'active'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    level.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  {level.status === 'active' ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')}
                </span>
                <Button variant="outline" size="sm" onClick={() => toggleStatus(level)} disabled={toggling[level.id]}
                  aria-label={lang === 'ar' ? `${level.status === 'active' ? 'إلغاء تفعيل' : 'تفعيل'} ${level.name}` : `${level.status === 'active' ? 'Deactivate' : 'Activate'} ${level.name}`}
                  className={`inline-flex items-center gap-1.5 transition-colors ${
                    level.status === 'active'
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}>
                  {toggling[level.id] ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : level.status === 'active' ? (
                    <><X className="h-3 w-3" /> {lang === 'ar' ? 'إلغاء التفعيل' : 'Deactivate'}</>
                  ) : (
                    <><Check className="h-3 w-3" /> {lang === 'ar' ? 'تفعيل' : 'Activate'}</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={mode === 'edit' ? (lang === 'ar' ? 'تعديل المستوى' : 'Edit Level') : (lang === 'ar' ? 'إضافة مستوى جديد' : 'Add New Level')}
        description={mode === 'edit' ? (lang === 'ar' ? `تحديث "${editingLevel?.name}"` : `Update "${editingLevel?.name}"`) : (lang === 'ar' ? 'إنشاء مستوى جديد لمدرستك' : 'Create a new level for your school')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'edit' ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إنشاء المستوى' : 'Create Level')}
            </Button>
          </>
        }>
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">
              {formError}
            </div>
          )}
          <FormField label={lang === 'ar' ? 'اسم المستوى' : 'Level Name'} required value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder={lang === 'ar' ? 'مثال: المستوى 1' : 'e.g. Level 1'} />
          <FormField label={lang === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'} value={form.nameAr}
            onChange={e => setForm({ ...form, nameAr: e.target.value })}
            placeholder={lang === 'ar' ? 'مثال: المستوى 1' : 'e.g. المستوى 1'} />
          <FormField label={lang === 'ar' ? 'الوصف' : 'Description'} as="textarea" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder={lang === 'ar' ? 'وصف اختياري' : 'Optional description'} />
        </div>
      </Modal>
    </div>
  )
}
