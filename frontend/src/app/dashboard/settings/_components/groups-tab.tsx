'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Loader2, Check, X } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { FormField } from '@/components/ui/form-field'
import { track } from '@/lib/analytics'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useLanguage } from '@/lib/use-language'
import { fetchGroups } from '@/lib/grades'
import { useFormValidation } from '@/hooks/use-form-validation'
import { minLength, required, type Schema } from '@/lib/validation'

interface Group {
  id: string
  name: string
  nameAr?: string
  description?: string
  orderIndex: number
  status: string
}

type GroupForm = { name: string; nameAr: string; description: string }

const groupSchema: Schema<GroupForm> = {
  name: [required({ en: 'Group name', ar: 'اسم المجموعة' }), minLength(2)],
}

const emptyForm: GroupForm = { name: '', nameAr: '', description: '' }

export function GroupsTab() {
  const { toast } = useToast()
  const lang = useLanguage()

  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<Record<string, boolean>>({})

  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [showForm, setShowForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [form, setForm] = useState<GroupForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const { fieldErrors, handleBlur, validate } = useFormValidation({
    values: form,
    schema: groupSchema,
    lang,
  })

  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState<Group | null>(null)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const loadGroups = () => {
    setLoading(true)
    fetchGroups()
      .then((data) => {
        setGroups(data.map((g, i) => ({
          id: g.id,
          name: g.name,
          nameAr: g.nameAr || undefined,
          description: g.description || undefined,
          orderIndex: i,
          status: g.status,
        })))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadGroups() }, [])

  const toggleStatus = async (group: Group) => {
    const newStatus = group.status === 'active' ? 'inactive' : 'active'
    setToggling(prev => ({ ...prev, [group.id]: true }))
    try {
      await http.patch(`/students/groups/${group.id}`, { status: newStatus })
      setGroups(prev => prev.map(g => g.id === group.id ? { ...g, status: newStatus } : g))
      toast('success', lang === 'ar' ? `تم ${newStatus === 'active' ? 'تفعيل' : 'إلغاء تفعيل'} المجموعة "${group.name}"` : `Group "${group.name}" ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    } catch {
      toast('error', lang === 'ar' ? 'فشل تحديث حالة المجموعة' : 'Failed to update group status')
    }
    setToggling(prev => ({ ...prev, [group.id]: false }))
  }

  const openCreate = () => {
    setMode('create')
    setEditingGroup(null)
    setForm({ ...emptyForm })
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (group: Group) => {
    setMode('edit')
    setEditingGroup(group)
    setForm({ name: group.name, nameAr: group.nameAr || '', description: group.description || '' })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        nameAr: form.nameAr.trim() || undefined,
        description: form.description.trim() || undefined,
      }
      if (mode === 'edit' && editingGroup) {
        await http.patch(`/students/groups/${editingGroup.id}`, payload)
        setShowForm(false)
        loadGroups()
        toast('success', lang === 'ar' ? 'تم تحديث المجموعة' : 'Group updated')
        track('settings.task_completed', 'task', { tab: 'groups', action: 'update' })
      } else {
        await http.post('/students/groups', payload, { schoolId: getSchoolId() })
        setShowForm(false)
        setForm(emptyForm)
        loadGroups()
        toast('success', lang === 'ar' ? 'تم إنشاء المجموعة' : 'Group created')
        track('settings.task_completed', 'task', { tab: 'groups', action: 'create' })
      }
    } catch {
      setFormError(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await http.delete(`/students/groups/${deleting.id}`)
      setShowDelete(false)
      setDeleting(null)
      loadGroups()
      toast('success', lang === 'ar' ? `تم حذف المجموعة "${deleting.name}"` : `Group "${deleting.name}" deleted`)
    } catch {
      toast('error', lang === 'ar' ? 'فشل حذف المجموعة' : 'Failed to delete group')
    }
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      const data = await http.delete<{ deletedCount: number }>('/students/groups', { schoolId: getSchoolId() })
      setShowDeleteAll(false)
      loadGroups()
      toast('success', lang === 'ar' ? `تم حذف ${data.deletedCount} مجموعة` : `${data.deletedCount} group(s) deleted`)
    } catch {
      toast('error', lang === 'ar' ? 'فشل حذف جميع المجموعات' : 'Failed to delete all groups')
    }
    setDeletingAll(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'المجموعات' : 'Groups'}</h2>
          <p className="mt-1 text-sm text-gray-500">{lang === 'ar' ? 'إدارة المجموعات وإضافة مجموعات جديدة أو تبديل الحالة' : 'Manage groups, add new ones, or toggle active status'}</p>
        </div>
        <div className="flex items-center gap-2">
          {groups.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowDeleteAll(true)}
              className="border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> {lang === 'ar' ? 'حذف الكل' : 'Delete All'}
            </Button>
          )}
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة مجموعة' : 'Add Group'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-12">
          <TableSkeleton rows={5} cols={3} />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">{lang === 'ar' ? 'لا توجد مجموعات بعد. انقر على "إضافة مجموعة" لإنشاء واحدة.' : 'No groups yet. Click "Add Group" to create one.'}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-x-auto table-to-cards">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الترتيب' : 'Order'}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الوصف' : 'Description'}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map(group => (
                <tr key={group.id} className="hover:bg-gray-50 active:bg-gray-100 transition-colors">
                  <td className="px-4 py-3" data-label={lang === 'ar' ? 'الترتيب' : 'Order'}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-blue-700">
                      {group.orderIndex}
                    </span>
                  </td>
                  <td className="px-4 py-3" data-label={lang === 'ar' ? 'الاسم' : 'Name'}>
                    <p className="text-sm font-medium text-gray-900">{group.name}</p>
                    {group.nameAr && <p className="text-xs text-gray-500">{group.nameAr}</p>}
                  </td>
                  <td className="px-4 py-3" data-label={lang === 'ar' ? 'الوصف' : 'Description'}>
                    <p className="text-sm text-gray-600 truncate max-w-[200px]">{group.description || '—'}</p>
                  </td>
                  <td className="px-4 py-3" data-label={lang === 'ar' ? 'الحالة' : 'Status'}>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      group.status === 'active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        group.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      {group.status === 'active' ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3" data-label={lang === 'ar' ? 'الإجراءات' : 'Actions'}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setDeleting(group); setShowDelete(true) }}
                        aria-label={lang === 'ar' ? `حذف ${group.name}` : `Delete ${group.name}`}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(group)}
                        aria-label={lang === 'ar' ? `تعديل ${group.name}` : `Edit ${group.name}`}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(group)} disabled={toggling[group.id]}
                        aria-label={lang === 'ar' ? `${group.status === 'active' ? 'إلغاء تفعيل' : 'تفعيل'} ${group.name}` : `${group.status === 'active' ? 'Deactivate' : 'Activate'} ${group.name}`}
                        className={`inline-flex items-center gap-1.5 transition-colors ${
                          group.status === 'active'
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}>
                        {toggling[group.id] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : group.status === 'active' ? (
                          <><X className="h-3 w-3" /> {lang === 'ar' ? 'إلغاء التفعيل' : 'Deactivate'}</>
                        ) : (
                          <><Check className="h-3 w-3" /> {lang === 'ar' ? 'تفعيل' : 'Activate'}</>
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={mode === 'edit' ? (lang === 'ar' ? 'تعديل المجموعة' : 'Edit Group') : (lang === 'ar' ? 'إضافة مجموعة جديدة' : 'Add New Group')}
        description={mode === 'edit' && editingGroup ? (lang === 'ar' ? `تحديث "${editingGroup.name}"` : `Update "${editingGroup.name}"`) : (lang === 'ar' ? 'إنشاء مجموعة جديدة' : 'Create a new group')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'edit' ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إنشاء المجموعة' : 'Create Group')}
            </Button>
          </>
        }>
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">
              {formError}
            </div>
          )}
          <FormField label={lang === 'ar' ? 'اسم المجموعة' : 'Group Name'} required value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            onBlur={() => handleBlur('name')}
            error={fieldErrors.name}
            placeholder={lang === 'ar' ? 'مثال: المجموعة أ' : 'e.g. Group A'} />
          <FormField label={lang === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'} value={form.nameAr}
            onChange={e => setForm({ ...form, nameAr: e.target.value })}
            placeholder={lang === 'ar' ? 'مثال: المجموعة أ' : 'e.g. المجموعة أ'} />
          <FormField label={lang === 'ar' ? 'الوصف' : 'Description'} as="textarea" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder={lang === 'ar' ? 'وصف اختياري' : 'Optional description'} />
        </div>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={lang === 'ar' ? 'حذف المجموعة' : 'Delete Group'}
        message={deleting ? (lang === 'ar' ? `هل أنت متأكد أنك تريد حذف "${deleting.name}"؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete "${deleting.name}"? This action cannot be undone.`) : ''}
      />

      <ConfirmDialog
        open={showDeleteAll}
        onClose={() => setShowDeleteAll(false)}
        onConfirm={handleDeleteAll}
        title={lang === 'ar' ? 'حذف جميع المجموعات' : 'Delete All Groups'}
        message={lang === 'ar' ? `هل أنت متأكد أنك تريد حذف جميع المجموعات (${groups.length})؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete all ${groups.length} group(s)? This action cannot be undone.`}
        confirmLabel={deletingAll ? (lang === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (lang === 'ar' ? 'حذف الكل' : 'Delete All')}
        loading={deletingAll}
      />
    </div>
  )
}
