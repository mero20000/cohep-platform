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
import {
  type GradeGroupCombo,
  type GroupLike,
  upsertCombo,
  removeCombo,
  validateCombo,
  findGroupToReuse,
} from '@/lib/grade-groups'

interface LevelOption {
  id: string
  name: string
  number: number
  status?: string
}

interface ConfigResponse {
  id: string
  schoolId: string | null
  key: string
  value: GradeGroupCombo[]
}

const emptyForm = { gradeName: '', groupName: '', status: 'active' as 'active' | 'inactive' }

function loadConfig(data: any): GradeGroupCombo[] {
  if (Array.isArray(data)) {
    const match = data.find((c: any) => c.key === 'gradeGroups')
    return Array.isArray(match?.value) ? match.value : []
  }
  if (data && Array.isArray(data.value)) return data.value
  return []
}

export function GradesTab() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [levels, setLevels] = useState<LevelOption[]>([])
  const [selectedLevel, setSelectedLevel] = useState('')
  const [combos, setCombos] = useState<GradeGroupCombo[]>([])
  const [groups, setGroups] = useState<GroupLike[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<GradeGroupCombo | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [configData, groupsData, levelsData] = await Promise.all([
        http.get<any>(`/users/schools/${getSchoolId()}/config?key=gradeGroups`),
        http.get<{ groups: GroupLike[] }[]>('/students/groups/all', { schoolId: getSchoolId() }),
        http.get<LevelOption[]>('/curriculum/levels', { schoolId: getSchoolId() }),
      ])
      setCombos(loadConfig(configData))
      const all = groupsData.flatMap(l => l.groups)
      setGroups(all)
      const activeLevels = levelsData.filter(l => l.status !== 'inactive').sort((a, b) => a.number - b.number)
      setLevels(activeLevels)
      setSelectedLevel(prev => prev || activeLevels[0]?.id || '')
    } catch {
      toast('error', t('Failed to load data', 'فشل تحميل البيانات'))
    }
    setLoading(false)
  }, [lang])

  useEffect(() => { fetchData() }, [fetchData])

  const levelCombos = selectedLevel ? combos.filter(c => c.levelId === selectedLevel) : []
  const levelName = levels.find(l => l.id === selectedLevel)?.name || ''

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const openEdit = (c: GradeGroupCombo) => {
    setEditing(c)
    setForm({ gradeName: c.gradeName, groupName: c.groupName, status: c.status })
    setError('')
    setShowForm(true)
  }

  const persist = async (next: GradeGroupCombo[], message: string) => {
    setSaving(true)
    try {
      const ok = await http.post<ConfigResponse>(`/users/schools/${getSchoolId()}/config`, {
        key: 'gradeGroups', value: next, description: 'Grade + Group mapping per level',
      })
      if (ok) {
        setCombos(next)
        toast('success', message)
        setShowForm(false)
      }
    } catch {
      toast('error', t('Failed to save', 'فشل الحفظ'))
    }
    setSaving(false)
  }

  const handleSave = async () => {
    setError('')
    if (!form.gradeName.trim() || !form.groupName.trim()) {
      setError(t('Grade and group names are required', 'اسم الصف واسم المجموعة مطلوبان'))
      return
    }
    const gradeName = form.gradeName.trim()
    const groupName = form.groupName.trim()
    const combo: GradeGroupCombo = {
      id: editing?.id || `combo-${Date.now()}`,
      levelId: selectedLevel,
      gradeName,
      groupId: editing?.groupId || '',
      groupName,
      status: form.status,
    }
    const validation = validateCombo(combos, combo)
    if (!validation.ok) { setError(validation.error); return }

    setSaving(true)
    try {
      let groupId = editing?.groupId || ''
      if (editing && editing.groupId) {
        if (editing.groupName !== groupName) {
          await http.patch(`/students/groups/${editing.groupId}`, { name: groupName })
        }
        groupId = editing.groupId
      } else {
        const existing = findGroupToReuse(groups, selectedLevel, groupName)
        if (existing) {
          groupId = existing
        } else {
          const created = await http.post<GroupLike>('/students/groups', { name: groupName, levelId: selectedLevel }, { schoolId: getSchoolId() })
          groupId = created.id
          setGroups(prev => [...prev, created])
        }
      }
      const withGroup: GradeGroupCombo = { ...combo, groupId }
      const next = upsertCombo(combos, withGroup)
      await persist(next, editing ? t('Grade updated', 'تم تحديث الصف') : t('Grade added', 'تم إضافة الصف'))
    } catch {
      toast('error', t('Failed to save', 'فشل الحفظ'))
    }
    setSaving(false)
  }

  const toggleStatus = async (c: GradeGroupCombo) => {
    const newStatus: 'active' | 'inactive' = c.status === 'active' ? 'inactive' : 'active'
    setSaving(true)
    try {
      await http.patch(`/students/groups/${c.groupId}`, { status: newStatus })
      const next = combos.map(x => x.id === c.id ? { ...x, status: newStatus } : x)
      await persist(next, t('Status updated', 'تم تحديث الحالة'))
    } catch {
      toast('error', t('Failed to update status', 'فشل تحديث الحالة'))
    }
    setSaving(false)
  }

  const handleDelete = async (c: GradeGroupCombo) => {
    if (!confirm(t(`Delete grade "${c.gradeName}" and its group?`, `حذف الصف "${c.gradeName}" ومجموعته؟`))) return
    setSaving(true)
    try {
      await http.delete(`/students/groups/${c.groupId}`)
      const next = removeCombo(combos, c.id)
      await persist(next, t('Grade deleted', 'تم حذف الصف'))
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
          <p className="text-sm text-gray-500">{t('Each grade is paired with a group under a level', 'كل صف مرتبط بمجموعة داخل مستوى')}</p>
        </div>
        <Button onClick={openCreate} disabled={!selectedLevel} aria-label={t('Add grade', 'إضافة صف')} size="sm">
          <Plus className="h-4 w-4" /> {t('Add Grade + Group', 'إضافة صف ومجموعة')}
        </Button>
      </div>

      <div className="px-6 py-4 border-b border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Level', 'المستوى')}</label>
        <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)}
          className="mt-1 block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {!selectedLevel ? (
        <div className="flex flex-col items-center justify-center py-12">
          <GraduationCap className="h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">{t('No active levels found', 'لا توجد مستويات نشطة')}</p>
        </div>
      ) : levelCombos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <GraduationCap className="h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">{t(`No grades configured for ${levelName}`, `لا توجد صفوف مكونة لـ ${levelName}`)}</p>
          <Button variant="link" onClick={openCreate} className="mt-2 text-sm font-medium text-blue-700 hover:text-gold-500">{t('Add first grade', 'إضافة أول صف')}</Button>
        </div>
      ) : (
        <div className="overflow-x-auto table-to-cards">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Grade', 'الصف')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Group', 'المجموعة')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Status', 'الحالة')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('Actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {levelCombos.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-medium text-gray-900" data-label={t('Grade', 'الصف')}>
                    {c.gradeName}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-gray-600" data-label={t('Group', 'المجموعة')}>
                    {c.groupName}
                  </td>
                  <td className="px-6 py-3.5" data-label={t('Status', 'الحالة')}>
                    <button onClick={() => toggleStatus(c)} disabled={saving}>
                      <Badge variant={c.status === 'active' ? 'success' : 'default'}>
                        {c.status === 'active' ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-6 py-3.5 text-right" data-label={t('Actions', 'الإجراءات')}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label={`${t('Edit', 'تعديل')} ${c.gradeName}`} title={t('Edit', 'تعديل')}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} aria-label={`${t('Delete', 'حذف')} ${c.gradeName}`} title={t('Delete', 'حذف')}
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('Edit Grade + Group', 'تعديل الصف والمجموعة') : t('Add Grade + Group', 'إضافة صف ومجموعة')} size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('Level', 'المستوى')}</label>
            <div className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">{levelName}</div>
          </div>
          <FormField label={t('Grade Name', 'اسم الصف')} required value={form.gradeName} onChange={e => setForm({ ...form, gradeName: e.target.value })} placeholder={t('e.g. Grade 4', 'مثال: الصف الرابع')} />
          <FormField label={t('Group Name', 'اسم المجموعة')} required value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })} placeholder={t('e.g. Group 1', 'مثال: المجموعة 1')} />
          <FormField label={t('Status', 'الحالة')} as="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
            <option value="active">{t('Active', 'نشط')}</option>
            <option value="inactive">{t('Inactive', 'غير نشط')}</option>
          </FormField>
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
