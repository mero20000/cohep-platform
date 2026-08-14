'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Loader2, X, Search, Presentation, Download, Upload, Check, Power, PowerOff, Play } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormField } from '@/components/ui/form-field'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { SlideEditor } from '@/components/curriculum/slide-editor'
import { PresentationViewer } from '@/components/curriculum/presentation-viewer'
import type { PresentationData } from '@/components/curriculum/types'
import { csToUnicode, isLikelyCsEncoded } from '@/lib/coptic-converter'
import { DetailDrawer, DetailSection, DetailRow } from '@/components/ui/detail-drawer'
import { track } from '@/lib/analytics'
import { assetUrl } from '@/lib/asset-url'

interface Subject {
  id: string; name: string; nameAr?: string; description?: string; color?: string; status: string; orderIndex: number
}
interface SubjectItem {
  id: string; subjectId: string; whenLabel?: string; name: string;
  nameAr?: string; nameCoptic?: string; level?: number;
  descriptionAr?: string; sessionsGroup1: number; sessionsGroup2: number;
  sessionsGroup3: number; sessionsGroup4: number; optional: boolean; orderIndex: number;
  presentationUrl?: string; presentationData?: PresentationData; hazzat?: string; educationLanguages?: string[];
  _count?: { lessons: number };
  levels?: Array<{ levelNumber: number }>;
  active?: boolean;
  recordingUrl?: string;
  recordingMeta?: { originalName?: string; sizeBytes?: number; contentType?: string }
}

interface Level {
  id: string; name: string; number: number; status: string
}

const emptySubjectForm = { name: '', nameAr: '', description: '', color: '#D4AF37' }
const emptyItemForm = {
  whenLabel: '', name: '', nameAr: '', nameCoptic: '', levels: [1] as number[], descriptionAr: '',
  sessionsGroup1: 0, sessionsGroup2: 0, sessionsGroup3: 0, sessionsGroup4: 0, optional: false,
  hazzat: '', presentationUrl: '',
  educationLanguages: [] as string[],
  active: true,
}

const COLOR_OPTIONS = ['#D4AF37', '#2563EB', '#059669', '#DC2626', '#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#4F46E5', '#16A34A']

const WHEN_COLORS: Record<string, { bg: string; text: string }> = {
  'Vespers/Matins': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  'Liturgy': { bg: 'bg-amber-100', text: 'text-amber-800' },
  'Prasies': { bg: 'bg-orange-100', text: 'text-orange-800' },
  'Seasonal': { bg: 'bg-sky-100', text: 'text-sky-800' },
  'Holy Week & Holy 50 days': { bg: 'bg-rose-100', text: 'text-rose-800' },
  'Glorifications': { bg: 'bg-purple-100', text: 'text-purple-800' },
  'Deacon Responses': { bg: 'bg-gray-100', text: 'text-gray-700' },
}

export function SubjectsTab() {
  const { toast } = useToast()
  const lang = useLanguage()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [levels, setLevels] = useState<Level[]>([])

  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [showForm, setShowForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [form, setForm] = useState(emptySubjectForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [items, setItems] = useState<SubjectItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [playingItemId, setPlayingItemId] = useState<string | null>(null)

  const [editingItem, setEditingItem] = useState<SubjectItem | null>(null)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [itemPresentation, setItemPresentation] = useState<PresentationData | undefined>(undefined)
  const [itemSaving, setItemSaving] = useState(false)

  const [deleteItemTarget, setDeleteItemTarget] = useState<SubjectItem | null>(null)
  const [showDeleteItem, setShowDeleteItem] = useState(false)

  const [drawerItem, setDrawerItem] = useState<SubjectItem | null>(null)
  const [showPresentation, setShowPresentation] = useState(false)
  const presentingRef = useRef<SubjectItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [filterWhen, setFilterWhen] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const fetchSubjects = () => {
    setLoading(true)
    const p = { schoolId: getSchoolId() }
    http.get<Subject[]>('/curriculum/subjects', p)
      .then(setSubjects).catch(console.error).finally(() => setLoading(false))
  }

  const fetchLevels = () => {
    http.get<Level[]>('/curriculum/levels', { schoolId: getSchoolId() })
      .then(data => setLevels(Array.isArray(data) ? data : [])).catch(console.error)
  }

  useEffect(() => { fetchSubjects(); fetchLevels() }, [])

  const fetchItems = useCallback(async (subjectId: string) => {
    setLoadingItems(true)
    try {
      const data = await http.get<SubjectItem[]>(`/curriculum/subjects/${subjectId}/items`, { schoolId: getSchoolId() })
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
    setLoadingItems(false)
  }, [])

  const toggleSubject = (subject: Subject) => {
    if (selectedSubject?.id === subject.id) {
      setSelectedSubject(null); setItems([]); setEditingItem(null); setShowItemForm(false)
    } else {
      setSelectedSubject(subject); setEditingItem(null); setShowItemForm(false)
      setItemForm(emptyItemForm); fetchItems(subject.id)
    }
  }

  const openAddItem = () => {
    setEditingItem(null)
    setItemForm(emptyItemForm)
    setItemPresentation(undefined)
    setShowItemForm(true)
  }

  const startEditItem = (item: SubjectItem) => {
    setEditingItem(item)
    setItemForm({
      whenLabel: item.whenLabel || '', name: item.name, nameAr: item.nameAr || '',
      nameCoptic: item.nameCoptic || '', levels: item.levels?.map(l => l.levelNumber) || [item.level || 1], descriptionAr: item.descriptionAr || '',
      sessionsGroup1: item.sessionsGroup1, sessionsGroup2: item.sessionsGroup2,
      sessionsGroup3: item.sessionsGroup3, sessionsGroup4: item.sessionsGroup4, optional: item.optional || false,
      hazzat: item.hazzat || '', presentationUrl: item.presentationUrl || '', educationLanguages: item.educationLanguages || [],
      active: item.active ?? true,
    })
    setItemPresentation(item.presentationData || undefined)
    setShowItemForm(true)
  }

  const cancelItemForm = () => { setEditingItem(null); setItemForm(emptyItemForm); setItemPresentation(undefined); setShowItemForm(false) }

  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !selectedSubject) return
    setItemSaving(true)
    try {
      const isEdit = !!editingItem
      const body: Record<string, unknown> = {
        whenLabel: itemForm.whenLabel, name: itemForm.name, nameAr: itemForm.nameAr,
        nameCoptic: itemForm.nameCoptic, levels: itemForm.levels, descriptionAr: itemForm.descriptionAr,
        sessionsGroup1: Number(itemForm.sessionsGroup1), sessionsGroup2: Number(itemForm.sessionsGroup2),
        sessionsGroup3: Number(itemForm.sessionsGroup3), sessionsGroup4: Number(itemForm.sessionsGroup4),
        optional: itemForm.optional, hazzat: itemForm.hazzat || null,
        presentationUrl: itemForm.presentationUrl || null, educationLanguages: itemForm.educationLanguages,
        active: itemForm.active,
      }
      if (itemPresentation) {
        body.presentationData = itemPresentation
      }
      const p = { schoolId: getSchoolId() }
      if (isEdit) {
        await http.put(`/curriculum/subjects/items/${editingItem!.id}`, body, p)
      } else {
        await http.post(`/curriculum/subjects/${selectedSubject.id}/items`, body, p)
      }
      toast('success', isEdit ? (lang === 'ar' ? 'تم تحديث العنصر' : 'Item updated') : (lang === 'ar' ? 'تم إنشاء العنصر' : 'Item created'))
      track('settings.task_completed', 'task', { tab: 'subjects', action: 'save_item' })
      setEditingItem(null); setItemForm(emptyItemForm); setItemPresentation(undefined); setShowItemForm(false)
      fetchItems(selectedSubject.id)
    } catch { toast('error', lang === 'ar' ? 'فشل حفظ العنصر' : 'Failed to save item') }
    setItemSaving(false)
  }

  const handleDeleteItem = async () => {
    if (!deleteItemTarget || !selectedSubject) return
    try {
      await http.delete(`/curriculum/subjects/items/${deleteItemTarget.id}`, { schoolId: getSchoolId() })
      toast('success', lang === 'ar' ? 'تم حذف العنصر' : 'Item deleted'); setShowDeleteItem(false); setDeleteItemTarget(null)
      fetchItems(selectedSubject.id)
    } catch (e) { console.error('Delete item error:', e); toast('error', lang === 'ar' ? 'فشل حذف العنصر' : 'Failed to delete item') }
  }

  const openCreate = () => { setMode('create'); setEditingSubject(null); setForm(emptySubjectForm); setFormError(''); setShowForm(true) }
  const openEdit = (subject: Subject) => { setMode('edit'); setEditingSubject(subject); setForm({ name: subject.name, nameAr: subject.nameAr || '', description: subject.description || '', color: subject.color || '#D4AF37' }); setFormError(''); setShowForm(true) }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError(lang === 'ar' ? 'اسم المادة مطلوب' : 'Subject name is required'); return }
    setSaving(true); setFormError('')
    try {
      const p = { schoolId: getSchoolId() }
      if (mode === 'create') {
        await http.post('/curriculum/subjects', form, p)
      } else {
        await http.put(`/curriculum/subjects/${editingSubject!.id}`, form, p)
      }
      toast('success', mode === 'create' ? (lang === 'ar' ? 'تم إنشاء المادة' : 'Subject created') : (lang === 'ar' ? 'تم تحديث المادة' : 'Subject updated'))
      setShowForm(false); fetchSubjects()
    } catch { toast('error', lang === 'ar' ? 'فشل حفظ المادة' : 'Failed to save subject') }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await http.delete(`/curriculum/subjects/${deleteTarget.id}`, { schoolId: getSchoolId() })
      toast('success', lang === 'ar' ? `تم حذف المادة "${deleteTarget.name}"` : `Subject "${deleteTarget.name}" deleted`); setShowDelete(false); setDeleteTarget(null)
      if (selectedSubject?.id === deleteTarget.id) { setSelectedSubject(null); setItems([]) }
      fetchSubjects()
    } catch { toast('error', lang === 'ar' ? 'فشل حذف المادة' : 'Failed to delete subject') }
  }

  const filteredItems = items.filter(item => {
    if (filterWhen && item.whenLabel !== filterWhen) return false
    if (filterLevel && !item.levels?.some((l: { levelNumber: number }) => l.levelNumber === Number(filterLevel))) return false
    if (filterSearch && !item.name.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(i => selectedItems.has(i.id))
  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleSelectAll = () => {
    if (allFilteredSelected) setSelectedItems(new Set())
    else setSelectedItems(new Set(filteredItems.map(i => i.id)))
  }
  const handleBatchDelete = async () => {
    const count = selectedItems.size
    if (!count) return
    if (!confirm(lang === 'ar' ? `حذف ${count} عنصر؟` : `Delete ${count} item(s)?`)) return
    setSaving(true)
    try {
      for (const id of selectedItems) {
        await http.delete(`/curriculum/subjects/items/${id}`, { schoolId: getSchoolId() })
      }
      toast('success', lang === 'ar' ? `تم حذف ${count} عناصر` : `${count} item(s) deleted`)
      setSelectedItems(new Set())
      if (selectedSubject) fetchItems(selectedSubject.id)
    } catch (e) { console.error('Batch delete error:', e); toast('error', lang === 'ar' ? 'فشل حذف العناصر' : 'Failed to delete items') }
    setSaving(false)
  }
  const handleExport = () => {
    const exportData = selectedItems.size > 0
      ? items.filter(i => selectedItems.has(i.id))
      : items
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${selectedSubject?.name || 'items'}.json`; a.click()
    URL.revokeObjectURL(url)
  }
  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const headers = ['whenLabel', 'name', 'nameAr', 'nameCoptic', 'levels', 'sessionsGroup1', 'sessionsGroup2', 'sessionsGroup3', 'sessionsGroup4', 'optional', 'hazzat', 'educationLanguages']
    const exampleRows = [
      ['Liturgy', 'Tenosht', 'تنوش', 'Ⲭⲉⲛⲟⲥⲧ', '1,2', 2, 3, 1, 0, 'false', '', 'coptic,arabic'],
      ['Vespers/Matins', 'Psalm 150', 'مزمور 150', ' nuest', '1,2,3', 1, 1, 0, 0, 'false', '', 'coptic'],
      ['Glorifications', 'Glorification 1', 'التجلي الأول', '', '1', 1, 0, 0, 0, 'true', '', 'arabic,english'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Items')
    XLSX.writeFile(wb, 'subject-items-template.xlsx')
  }
  const importInputRef = useRef<HTMLInputElement>(null)
  const pptxInputRef = useRef<HTMLInputElement>(null)
  const handlePptxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result: any = await http.upload('/upload/presentation', formData)
      setItemForm({ ...itemForm, presentationUrl: result.url })
      toast('success', lang === 'ar' ? 'تم رفع الملف' : 'File uploaded')
    } catch { toast('error', lang === 'ar' ? 'فشل رفع الملف' : 'Failed to upload file') }
    e.target.value = ''
  }
  const onUploadRecording = async (file: File) => {
    if (!editingItem) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res: any = await http.upload(`/curriculum/subjects/items/${editingItem.id}/recording`, fd)
      setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, recordingUrl: res.recordingUrl, recordingMeta: res.recordingMeta } : it))
      setEditingItem({ ...editingItem, recordingUrl: res.recordingUrl, recordingMeta: res.recordingMeta })
      toast('success', lang === 'ar' ? 'تم رفع التسجيل' : 'Recording uploaded')
    } catch {
      toast('error', lang === 'ar' ? 'فشل رفع التسجيل' : 'Failed to upload recording')
    }
  }

  const onRemoveRecording = async () => {
    if (!editingItem) return
    try {
      await http.delete(`/curriculum/subjects/items/${editingItem.id}/recording`, { schoolId: getSchoolId() })
      setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, recordingUrl: undefined, recordingMeta: undefined } : it))
      setEditingItem({ ...editingItem, recordingUrl: undefined, recordingMeta: undefined })
      toast('success', lang === 'ar' ? 'تم الحذف' : 'Removed')
    } catch {
      toast('error', lang === 'ar' ? 'فشل الحذف' : 'Failed to remove')
    }
  }
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      let items: any[]
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
        items = raw.map(row => {
          const get = (...keys: string[]) => {
            for (const k of keys) {
              const match = Object.keys(row).find(col => col.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase())
              if (match && row[match] !== '' && row[match] !== undefined) return String(row[match])
            }
            return ''
          }
          const levelsStr = get('levels', 'level', 'مستوى')
          const levels = levelsStr ? levelsStr.split(/[,\s]+/).map(Number).filter(n => n >= 1 && n <= 5) : [1]
          const sessionsG1 = get('sessionsGroup1', 'sessions_group1', 'group1', 'g1', 'حصص1', 'المجموعة 1')
          const sessionsG2 = get('sessionsGroup2', 'sessions_group2', 'group2', 'g2', 'حصص2', 'المجموعة 2')
          const sessionsG3 = get('sessionsGroup3', 'sessions_group3', 'group3', 'g3', 'حصص3', 'المجموعة 3')
          const sessionsG4 = get('sessionsGroup4', 'sessions_group4', 'group4', 'g4', 'حصص4', 'المجموعة 4')
          const langStr = get('educationLanguages', 'education_languages', 'lang', 'لغة')
          const educationLanguages = langStr ? langStr.split(/[,\s]+/).filter(Boolean) : []
          const optionalStr = get('optional', 'اختياري')
          return {
            whenLabel: get('whenLabel', 'when_label', 'when', 'الوقت'),
            name: get('name', 'hymn', 'hymnName', 'الاسم', 'التسبيحة'),
            nameAr: get('nameAr', 'name_ar', 'الاسم بالعربية'),
            nameCoptic: get('nameCoptic', 'name_coptic', 'copticName', 'coptic_name', 'coptic', 'قبطي', 'الاسم القبطي', 'copticNameArabic'),
            levels: levels.length > 0 ? levels : [1],
            descriptionAr: get('descriptionAr', 'description_ar', 'الوصف'),
            sessionsGroup1: Number(sessionsG1) || 0,
            sessionsGroup2: Number(sessionsG2) || 0,
            sessionsGroup3: Number(sessionsG3) || 0,
            sessionsGroup4: Number(sessionsG4) || 0,
            optional: ['true', '1', 'yes', 'نعم'].includes(optionalStr.toLowerCase()),
            hazzat: get('hazzat', 'الحزّات') || null,
            presentationUrl: get('presentationUrl', 'presentation_url', 'العرض') || null,
            educationLanguages,
          }
        })
      } else {
        const text = await file.text()
        const data = JSON.parse(text)
        items = Array.isArray(data) ? data : [data]
      }
      let imported = 0
      for (const item of items) {
        if (!item.name?.trim()) continue
        await http.post(`/curriculum/subjects/${selectedSubject!.id}/items`, {
          whenLabel: item.whenLabel || '', name: item.name, nameAr: item.nameAr || '',
          nameCoptic: item.nameCoptic || '', levels: item.levels || [1], descriptionAr: item.descriptionAr || '',
          sessionsGroup1: Number(item.sessionsGroup1) || 0, sessionsGroup2: Number(item.sessionsGroup2) || 0,
          sessionsGroup3: Number(item.sessionsGroup3) || 0, sessionsGroup4: Number(item.sessionsGroup4) || 0,
          optional: item.optional || false, hazzat: item.hazzat || null,
          presentationUrl: item.presentationUrl || null, educationLanguages: item.educationLanguages || [],
        }, { schoolId: getSchoolId() })
        imported++
      }
      toast('success', lang === 'ar' ? `تم استيراد ${imported} عناصر` : `${imported} item(s) imported`)
      if (selectedSubject) fetchItems(selectedSubject.id)
    } catch { toast('error', lang === 'ar' ? 'فشل استيراد الملف' : 'Failed to import file') }
    setImporting(false)
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Subjects Grid */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'المواد الدراسية' : 'Curriculum Subjects'}</h3>
            <p className="text-sm text-gray-500">{lang === 'ar' ? 'إدارة المواد المستخدمة في توزيع المنهج والتقييمات' : 'Manage subjects used in curriculum allocation and assessments'}</p>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة مادة' : 'Add Subject'}
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>
        ) : subjects.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لا توجد مواد بعد.' : 'No subjects yet.'}</div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map(subject => (
                <div key={subject.id} onClick={() => toggleSubject(subject)}
                  className={`rounded-xl border-2 bg-white cursor-pointer transition-all overflow-hidden ${
                    selectedSubject?.id === subject.id ? 'border-gold-500 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}>
                  <div className="h-2" style={{ backgroundColor: subject.color || '#D4AF37' }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg font-bold text-white"
                          style={{ backgroundColor: subject.color || '#D4AF37' }}>
                          {subject.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{subject.name}</p>
                          {subject.nameAr && <p className="text-xs text-gray-500 mt-0.5">{subject.nameAr}</p>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        subject.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{subject.status}</span>
                    </div>
                    {subject.description && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{subject.description}</p>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-[11px] text-gray-400">{selectedSubject?.id === subject.id ? (lang === 'ar' ? 'انقر للطي' : 'Click to collapse') : (lang === 'ar' ? 'انقر للتوسيع' : 'Click to expand')}</span>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(subject)} className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(subject); setShowDelete(true) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Items Section */}
      {selectedSubject && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: selectedSubject.color || '#D4AF37' }}>
                {selectedSubject.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{selectedSubject.name} — {lang === 'ar' ? 'العناصر' : 'Items'}</h3>
                <p className="text-xs text-gray-500">{filteredItems.length} {lang === 'ar' ? 'من' : 'of'} {items.length} {lang === 'ar' ? 'عنصر' : 'items'}</p>
              </div>
            </div>
            <Button onClick={openAddItem} size="sm">
              <Plus className="h-3.5 w-3.5" /> {lang === 'ar' ? 'إضافة عنصر' : 'Add Item'}
            </Button>
          </div>

          {/* Filters */}
          <div className="border-b border-gray-100 px-6 py-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder={lang === 'ar' ? 'البحث عن اسم التسبيحة...' : 'Search hymn name...'} value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-gold-500 focus:outline-none" />
            </div>
            <select value={filterWhen} onChange={e => setFilterWhen(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-gold-500 focus:outline-none">
              <option value="">{lang === 'ar' ? 'جميع الأوقات' : 'All When'}</option>
              {Object.keys(WHEN_COLORS).map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-gold-500 focus:outline-none">
              <option value="">{lang === 'ar' ? 'جميع المستويات' : 'All Levels'}</option>
              {[...new Set(items.flatMap(i => i.levels?.map(l => l.levelNumber) || [i.level || 1]))].sort((a: number, b: number) => a - b).map((l: number) => (
                <option key={l} value={l}>{lang === 'ar' ? `المستوى ${l}` : `Level ${l}`}</option>
              ))}
            </select>
            {(filterWhen || filterLevel || filterSearch) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterWhen(''); setFilterLevel(''); setFilterSearch('') }}
                className="text-xs text-red-500 hover:text-red-600 font-medium">{lang === 'ar' ? 'مسح' : 'Clear'}</Button>
            )}
          </div>

          {/* Batch Actions Toolbar */}
          <div className="flex items-center gap-2 py-2 px-1">
            {selectedItems.size > 0 && (
              <span className="text-xs text-gray-500 mr-2">{selectedItems.size} {lang === 'ar' ? 'محدد' : 'selected'}</span>
            )}
            <Button variant="destructive" size="sm" onClick={handleBatchDelete} disabled={selectedItems.size === 0}
              className="gap-1">
              <Trash2 className="h-3 w-3" /> {lang === 'ar' ? 'حذف المحدد' : 'Delete Selected'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}
              className="gap-1">
              <Download className="h-3 w-3" /> {lang === 'ar' ? 'تصدير' : 'Export'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} disabled={importing || !selectedSubject}
              className="gap-1">
              <Upload className="h-3 w-3" /> {importing ? (lang === 'ar' ? 'جار...' : 'Importing...') : (lang === 'ar' ? 'استيراد' : 'Import')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}
              className="gap-1 text-xs text-blue-600 hover:text-blue-700">
              {lang === 'ar' ? 'قالب' : 'Template'}
            </Button>
            <input ref={importInputRef} type="file" onChange={handleImport} className="hidden" />
          </div>

          {/* Items Table */}
          {loadingItems ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">{items.length === 0 ? (lang === 'ar' ? 'لا توجد عناصر بعد.' : 'No items yet.') : (lang === 'ar' ? 'لا توجد عناصر تطابق الفلاتر.' : 'No items match filters.')}</div>
          ) : (
            <div className="overflow-x-auto table-to-cards">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-2 text-center w-8">
                      <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 w-10">{lang === 'ar' ? 'م' : 'Sn.'}</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 w-28">{lang === 'ar' ? 'الوقت' : 'When'}</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">{lang === 'ar' ? 'التسابيح' : 'Hymns'}</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 w-14">{lang === 'ar' ? 'الحالة' : 'Active'}</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 w-12">{lang === 'ar' ? 'المستوى' : 'Level'}</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 w-20">{lang === 'ar' ? 'الحصص' : 'Sessions'}</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 w-28">{lang === 'ar' ? 'لغة التعليم' : 'Teaching Lang'}</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 w-16">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map((item, idx) => {
                    const whenColor = WHEN_COLORS[item.whenLabel || ''] || { bg: 'bg-gray-100', text: 'text-gray-700' }
                    return (<>
                      <tr key={item.id} onClick={e => { if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON') setDrawerItem(item) }}
                        className="hover:bg-gray-50 active:bg-gray-100 cursor-pointer">
                        <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelectItem(item.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
                        </td>
                        <td className="px-2 py-1.5 text-center text-gray-400" data-label="Sn.">{idx + 1}</td>
                        <td className="px-2 py-1.5" data-label="When">
                          {item.whenLabel && (
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${whenColor.bg} ${whenColor.text}`}>
                              {item.whenLabel}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-gray-900 coptic-text" data-label="Hymns">
                          {item.name}
                          {(item.presentationData || item.presentationUrl) && (
                            <Presentation className="h-3 w-3 inline ml-1.5 text-purple-500" />
                          )}
                          {item.recordingUrl && (
                            <button
                              onClick={e => { e.stopPropagation(); setPlayingItemId(prev => (prev === item.id ? null : item.id)) }}
                              className="inline-flex items-center justify-center h-4 w-4 ml-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 align-middle"
                              aria-label={lang === 'ar' ? 'تشغيل التسجيل المرجعي' : 'Play reference recording'}>
                              <Play className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center" data-label="Active" onClick={e => e.stopPropagation()}>
                          <button onClick={async () => {
                            try {
                              await http.put(`/curriculum/subjects/items/${item.id}`, { active: !(item.active !== false) }, { schoolId: getSchoolId() })
                              setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !(i.active !== false) } : i))
                              toast('success', lang === 'ar' ? `تم ${item.active !== false ? 'إلغاء تفعيل' : 'تفعيل'} العنصر` : `Item ${item.active !== false ? 'deactivated' : 'activated'}`)
                            } catch { toast('error', lang === 'ar' ? 'فشل تغيير الحالة' : 'Failed to toggle status') }
                          }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              item.active !== false
                                ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                                : 'border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100'
                            }`}
                            aria-label={item.active !== false ? (lang === 'ar' ? 'إلغاء التفعيل' : 'Deactivate') : (lang === 'ar' ? 'تفعيل' : 'Activate')}>
                            {item.active !== false ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                          </button>
                        </td>
                        <td className="px-2 py-1.5 text-center" data-label="Level">
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-medium">{(item.levels?.map(l => l.levelNumber).join(', ')) || item.level || 1}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center" data-label="Sessions">
                          <span className="text-[11px] font-medium text-gray-700">
                            {[item.sessionsGroup1, item.sessionsGroup2, item.sessionsGroup3, item.sessionsGroup4].filter((s, i) => s > 0).map((s, i, arr) => `G${i + 1}:${s}`).join(' ') || '—'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center" data-label="Teaching Lang">
                          {item.educationLanguages?.length ? (
                            <span className="flex gap-1 justify-center flex-wrap">
                              {item.educationLanguages.map(l => (
                                <span key={l} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  l === 'coptic' ? 'bg-amber-100 text-amber-700' :
                                  l === 'arabic' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>{l === 'coptic' ? 'CO' : l === 'arabic' ? 'AR' : 'EN'}</span>
                              ))}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right" data-label="Actions" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" aria-label="Edit Item" onClick={() => startEditItem(item)} className="rounded p-1 text-gray-400 hover:bg-amber-50 hover:text-amber-600 mr-1">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteItemTarget(item); setShowDeleteItem(true) }} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                      {playingItemId === item.id && (
                        <tr key={`${item.id}-audio`} onClick={e => e.stopPropagation()}>
                          <td colSpan={9} className="px-2 py-2 bg-gray-50">
                            <audio controls autoPlay src={assetUrl(item.recordingUrl)} className="w-full h-9" />
                          </td>
                        </tr>
                      )}
                    </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Item Add/Edit Modal */}
      <Modal open={showItemForm} onClose={cancelItemForm} title={editingItem ? (lang === 'ar' ? 'تعديل العنصر' : 'Edit Item') : (lang === 'ar' ? 'إضافة عنصر جديد' : 'Add New Item')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الوقت' : 'When'}</label>
              <select value={itemForm.whenLabel} onChange={e => setItemForm({ ...itemForm, whenLabel: e.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none">
                <option value="">{lang === 'ar' ? 'اختر...' : 'Select...'}</option>
                <option value="Vespers/Matins">Vespers/Matins</option>
                <option value="Liturgy">Liturgy</option>
                <option value="Prasies">Prasies</option>
                <option value="Seasonal">Seasonal</option>
                <option value="Holy Week & Holy 50 days">Holy Week</option>
                <option value="Glorifications">Glorifications</option>
                <option value="Deacon Responses">Deacon Responses</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'اسم التسبيحة' : 'Hymn Name'} <span className="text-red-500">*</span></label>
              <input type="text" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                onPaste={e => {
                  const pasted = e.clipboardData.getData('text')
                  if (isLikelyCsEncoded(pasted)) {
                    e.preventDefault()
                    const el = e.currentTarget
                    const start = el.selectionStart ?? 0
                    const end = el.selectionEnd ?? 0
                    const before = itemForm.name.slice(0, start)
                    const after = itemForm.name.slice(end)
                    setItemForm({ ...itemForm, name: before + csToUnicode(pasted) + after })
                  }
                }}
                placeholder="e.g. Ϣⲉⲣⲉ ⲛⲉ ⲧⲉⲙⲛⲟ"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none coptic-text" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'ar' ? 'المستويات' : 'Levels'}</label>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map(l => {
                  const checked = itemForm.levels.includes(l)
                  return (
                    <label key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${checked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="checkbox" checked={checked} onChange={() => setItemForm({ ...itemForm, levels: checked ? itemForm.levels.filter(x => x !== l) : [...itemForm.levels, l].sort() })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      {lang === 'ar' ? `المستوى ${l}` : `Level ${l}`}
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={itemForm.optional} onChange={e => setItemForm({ ...itemForm, optional: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
              <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'اختياري' : 'Optional'}</label>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" checked={itemForm.active} onChange={e => setItemForm({ ...itemForm, active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'نشط' : 'Active'}</label>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'ar' ? 'لغة التعليم' : 'Education Language'}</label>
              <div className="flex flex-wrap gap-4">
                {(['coptic', 'arabic', 'english'] as const).map(langKey => (
                  <label key={langKey} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={itemForm.educationLanguages?.includes(langKey) ?? false}
                      onChange={e => {
                        const current = itemForm.educationLanguages || []
                        setItemForm({
                          ...itemForm,
                          educationLanguages: e.target.checked
                            ? [...current, langKey]
                            : current.filter(l => l !== langKey),
                        })
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700 capitalize">{langKey === 'coptic' ? (lang === 'ar' ? 'قبطي' : 'Coptic') : langKey === 'arabic' ? (lang === 'ar' ? 'عربي' : 'Arabic') : 'English'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الحصص - المجموعة 1' : 'Sessions - Group 1'}</label>
              <input type="number" min={0} step={0.5} value={itemForm.sessionsGroup1 || ''} onChange={e => setItemForm({ ...itemForm, sessionsGroup1: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الحصص - المجموعة 2' : 'Sessions - Group 2'}</label>
              <input type="number" min={0} step={0.5} value={itemForm.sessionsGroup2 || ''} onChange={e => setItemForm({ ...itemForm, sessionsGroup2: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الحصص - المجموعة 3' : 'Sessions - Group 3'}</label>
              <input type="number" min={0} step={0.5} value={itemForm.sessionsGroup3 || ''} onChange={e => setItemForm({ ...itemForm, sessionsGroup3: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الحصص - المجموعة 4' : 'Sessions - Group 4'}</label>
              <input type="number" min={0} step={0.5} value={itemForm.sessionsGroup4 || ''} onChange={e => setItemForm({ ...itemForm, sessionsGroup4: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</label>
              <input type="text" value={itemForm.nameAr} onChange={e => setItemForm({ ...itemForm, nameAr: e.target.value })}
                placeholder={lang === 'ar' ? 'الاسم بالعربية' : 'Arabic name'}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الاسم القبطي' : 'Coptic Name'}</label>
              <input type="text" value={itemForm.nameCoptic} onChange={e => setItemForm({ ...itemForm, nameCoptic: e.target.value })}
                onPaste={e => {
                  const pasted = e.clipboardData.getData('text')
                  if (isLikelyCsEncoded(pasted)) {
                    e.preventDefault()
                    const el = e.currentTarget
                    const start = el.selectionStart ?? 0
                    const end = el.selectionEnd ?? 0
                    const before = itemForm.nameCoptic.slice(0, start)
                    const after = itemForm.nameCoptic.slice(end)
                    setItemForm({ ...itemForm, nameCoptic: before + csToUnicode(pasted) + after })
                  }
                }}
                placeholder={lang === 'ar' ? 'الخط القبطي' : 'Coptic script'}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none coptic-text" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الوصف (بالعربية)' : 'Description (Arabic)'}</label>
              <input type="text" value={itemForm.descriptionAr} onChange={e => setItemForm({ ...itemForm, descriptionAr: e.target.value })}
                placeholder={lang === 'ar' ? 'الوصف بالعربية' : 'Arabic description'}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
                <label className="block text-sm font-semibold text-amber-800 mb-1">
                  {lang === 'ar' ? 'الحزّات (النوتات الموسيقية)' : 'Hazzat (Musical Notation)'}
                </label>
                <textarea value={itemForm.hazzat} onChange={e => setItemForm({ ...itemForm, hazzat: e.target.value })}
                  onPaste={e => {
                    const pasted = e.clipboardData.getData('text')
                    if (isLikelyCsEncoded(pasted)) {
                      e.preventDefault()
                      const el = e.currentTarget
                      const start = el.selectionStart ?? 0
                      const end = el.selectionEnd ?? 0
                      const before = itemForm.hazzat.slice(0, start)
                      const after = itemForm.hazzat.slice(end)
                      setItemForm({ ...itemForm, hazzat: before + csToUnicode(pasted) + after })
                    }
                  }}
                  rows={4} placeholder={lang === 'ar' ? 'الصق النص (قبطي + حزات)' : 'Paste text (Coptic + Hazzat)'}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none font-mono" />
                <p className="text-xs text-amber-600 mt-1">{lang === 'ar' ? 'CS→Unicode يتحول تلقائياً. معاينة الخط في الدرج' : 'CS→Unicode auto-converted on paste. Preview Hazzat font in drawer'}</p>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {lang === 'ar' ? 'ملف العرض التقديمي (PPTX)' : 'Presentation File (PPTX)'}
              </label>
              <div className="flex items-center gap-2">
                <input type="text" value={itemForm.presentationUrl || ''} onChange={e => setItemForm({ ...itemForm, presentationUrl: e.target.value })}
                  placeholder={lang === 'ar' ? 'رابط الملف أو ارفعه' : 'File URL or upload'}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
                <Button type="button" variant="outline" size="icon" onClick={() => pptxInputRef.current?.click()}
                  className="rounded-lg text-gray-600">
                  <Upload className="h-4 w-4" />
                </Button>
                <input ref={pptxInputRef} type="file" accept=".pptx" onChange={handlePptxUpload} className="hidden" />
              </div>
              <p className="text-xs text-gray-400 mt-1">{lang === 'ar' ? 'اختر ملف PowerPoint للرفع' : 'Upload a PowerPoint file'}</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'تسجيل المرجع' : 'Reference recording'}</label>
              {editingItem?.recordingUrl ? (
                <div className="flex items-center gap-3">
                  <audio controls src={assetUrl(editingItem.recordingUrl)} className="h-9 flex-1" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600">{lang === 'ar' ? 'استبدال' : 'Replace'}</button>
                  <button type="button" onClick={onRemoveRecording} className="text-xs text-red-600">{lang === 'ar' ? 'حذف' : 'Remove'}</button>
                </div>
              ) : (
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUploadRecording(f); e.target.value = '' }} />
              )}
              {!editingItem?.recordingUrl && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600">{lang === 'ar' ? 'رفع تسجيل' : 'Upload recording'}</button>
              )}
            </div>
            <div className="col-span-2 border border-gray-200 rounded-lg p-4">
              <SlideEditor
                value={itemPresentation}
                onChange={(data: PresentationData) => setItemPresentation(data)}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={cancelItemForm}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSaveItem} disabled={itemSaving || !itemForm.name.trim()}>
            {itemSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingItem ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إضافة عنصر' : 'Add Item')}
          </Button>
        </div>
      </Modal>

      {/* Subject Create/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={mode === 'create' ? (lang === 'ar' ? 'إضافة مادة' : 'Add Subject') : (lang === 'ar' ? 'تعديل المادة' : 'Edit Subject')}>
        <div className="space-y-4">
          <FormField label={lang === 'ar' ? 'اسم المادة' : 'Subject Name'} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={lang === 'ar' ? 'مثال: التسبحة القبطية' : 'e.g. Coptic Hymns'} error={formError} />
          <FormField label={lang === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'} value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} placeholder={lang === 'ar' ? 'مثال: التسبحة القبطية' : 'e.g. التسبحة القبطية'} />
          <FormField label={lang === 'ar' ? 'الوصف' : 'Description'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={lang === 'ar' ? 'وصف مختصر' : 'Brief description'} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'ar' ? 'اللون' : 'Color'}</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-lg border-2 transition-transform ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'create' ? (lang === 'ar' ? 'إنشاء المادة' : 'Create Subject') : (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
          </Button>
        </div>
      </Modal>

      {/* Presentation Viewer */}
      {showPresentation && presentingRef.current && (presentingRef.current.presentationData || presentingRef.current.presentationUrl) && (
        <PresentationViewer
          data={presentingRef.current.presentationData || { format: 'both', speaker: '', verses: [] }}
          title={presentingRef.current.name}
          titleCoptic={presentingRef.current.nameCoptic}
          titleAr={presentingRef.current.nameAr}
          hazzat={presentingRef.current.hazzat || undefined}
          presentationUrl={presentingRef.current.presentationUrl || undefined}
          onExit={() => { setShowPresentation(false); presentingRef.current = null }}
        />
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        title={drawerItem?.name}
        subtitle={drawerItem?.nameCoptic ? `${drawerItem.nameCoptic}${drawerItem.nameAr ? ` — ${drawerItem.nameAr}` : ''}` : drawerItem?.nameAr}
        footer={
          <>
            {(drawerItem?.presentationData || drawerItem?.presentationUrl) && (
              <Button variant="outline" onClick={() => { presentingRef.current = drawerItem; setShowPresentation(true); setDrawerItem(null) }}>
                <Presentation className="h-4 w-4" /> {lang === 'ar' ? 'عرض' : 'Present'}
              </Button>
            )}
            <Button onClick={() => { if (drawerItem) startEditItem(drawerItem); setDrawerItem(null) }}>
              <Pencil className="h-4 w-4" /> {lang === 'ar' ? 'تعديل' : 'Edit'}
            </Button>
          </>
        }>
        {drawerItem && (
          <>
            <DetailSection label={lang === 'ar' ? 'معلومات أساسية' : 'Basic Info'}>
              <DetailRow label={lang === 'ar' ? 'الوقت' : 'When'} value={drawerItem.whenLabel || '—'} />
              <DetailRow label={lang === 'ar' ? 'المستوى' : 'Level'} value={<span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">{(drawerItem.levels?.map(l => l.levelNumber).join(', ')) || drawerItem.level || 1}</span>} />
              <DetailRow label={lang === 'ar' ? 'الاسم القبطي' : 'Coptic Name'} value={<span className="coptic-text">{drawerItem.nameCoptic || '—'}</span>} />
              <DetailRow label={lang === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'} value={<span dir="rtl">{drawerItem.nameAr || '—'}</span>} />
              <DetailRow label={lang === 'ar' ? 'اختياري' : 'Optional'} value={drawerItem.optional ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No')} />
              <DetailRow label={lang === 'ar' ? 'لغة التعليم' : 'Education Lang'} value={
                drawerItem.educationLanguages?.length
                  ? <span className="flex gap-1.5 flex-wrap">{drawerItem.educationLanguages.map(l => (
                      <span key={l} className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                        l === 'coptic' ? 'bg-amber-100 text-amber-800' :
                        l === 'arabic' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>{l === 'coptic' ? (lang === 'ar' ? 'قبطي' : 'Coptic') : l === 'arabic' ? (lang === 'ar' ? 'عربي' : 'Arabic') : 'English'}</span>
                    ))}</span>
                  : '—'
              } />
            </DetailSection>

            <DetailSection label={lang === 'ar' ? 'توزيع الحصص' : 'Session Allocations'}>
              <DetailRow label={lang === 'ar' ? 'المجموعة 1' : 'Group 1'} value={drawerItem.sessionsGroup1?.toString() || '0'} />
              <DetailRow label={lang === 'ar' ? 'المجموعة 2' : 'Group 2'} value={drawerItem.sessionsGroup2?.toString() || '0'} />
              <DetailRow label={lang === 'ar' ? 'المجموعة 3' : 'Group 3'} value={drawerItem.sessionsGroup3?.toString() || '0'} />
              <DetailRow label={lang === 'ar' ? 'المجموعة 4' : 'Group 4'} value={drawerItem.sessionsGroup4?.toString() || '0'} />
            </DetailSection>

            {drawerItem.descriptionAr && (
              <DetailSection label={lang === 'ar' ? 'الوصف' : 'Description'}>
                <p className="text-sm text-gray-700 leading-relaxed" dir="rtl">{drawerItem.descriptionAr}</p>
              </DetailSection>
            )}

            {(drawerItem.presentationData || drawerItem.presentationUrl) && (
              <DetailSection label={lang === 'ar' ? 'محتوى العرض' : 'Presentation Content'}>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      {drawerItem.presentationData ? `${drawerItem.presentationData.format} — ${drawerItem.presentationData.speaker} — ${drawerItem.presentationData.verses.length} ${lang === 'ar' ? 'مقطع' : 'verses'}` : (lang === 'ar' ? 'ملف PowerPoint' : 'PowerPoint file')}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => { presentingRef.current = drawerItem; setShowPresentation(true); setDrawerItem(null) }}
                      className="gap-1">
                      <Presentation className="h-3 w-3" /> {lang === 'ar' ? 'عرض' : 'Present'}
                    </Button>
                  </div>
                  {drawerItem.presentationData && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {drawerItem.presentationData.verses.slice(0, 10).map((v, i) => (
                        <div key={i} className="text-xs text-gray-600 border-b border-gray-100 pb-1 last:border-0">
                          <span className="text-gray-400 mr-1">{i + 1}.</span>
                          {v.cop && <span className="coptic-text mr-2">{v.cop}</span>}
                          {v.en && <span className="text-gray-500">{v.en}</span>}
                        </div>
                      ))}
                      {drawerItem.presentationData.verses.length > 10 && (
                        <p className="text-xs text-gray-400 pt-1">...{lang === 'ar' ? 'و' : 'and'} {drawerItem.presentationData.verses.length - 10} {lang === 'ar' ? 'أخرى' : 'more'}</p>
                      )}
                    </div>
                  )}
                  {drawerItem.presentationUrl && !drawerItem.presentationData && (
                    <p className="text-xs text-amber-600 mt-1">{lang === 'ar' ? 'ملف PowerPoint مضمن — انقر "عرض" للتشغيل' : 'PowerPoint file attached — click "Present" to view'}</p>
                  )}
                </div>
              </DetailSection>
            )}

            {drawerItem.recordingUrl && (
              <DetailSection label={lang === 'ar' ? 'تسجيل المرجع' : 'Reference Recording'}>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <audio controls src={assetUrl(drawerItem.recordingUrl)} className="w-full h-9" />
                  {drawerItem.recordingMeta?.originalName && (
                    <p className="text-xs text-gray-400 mt-1">{drawerItem.recordingMeta.originalName}</p>
                  )}
                </div>
              </DetailSection>
            )}

            {drawerItem.hazzat && (
              <DetailSection label={lang === 'ar' ? 'الحزّات' : 'Hazzat'}>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="hazzat-text text-base whitespace-pre-wrap break-words">{drawerItem.hazzat}</p>
                </div>
              </DetailSection>
            )}
          </>
        )}
      </DetailDrawer>

      <ConfirmDialog open={showDelete} onClose={() => setShowDelete(false)} onConfirm={handleDelete}
        title={lang === 'ar' ? 'حذف المادة' : 'Delete Subject'} message={deleteTarget ? (lang === 'ar' ? `هل أنت متأكد أنك تريد حذف "${deleteTarget.name}"؟ سيؤدي ذلك أيضًا إلى إزالة جميع العناصر المرتبطة.` : `Are you sure you want to delete "${deleteTarget.name}"? This will also remove all associated items.`) : ''} />

      <ConfirmDialog open={showDeleteItem} onClose={() => setShowDeleteItem(false)} onConfirm={handleDeleteItem}
        title={lang === 'ar' ? 'حذف العنصر' : 'Delete Item'} message={deleteItemTarget ? (lang === 'ar' ? `هل أنت متأكد أنك تريد حذف "${deleteItemTarget.name}"؟` : `Are you sure you want to delete "${deleteItemTarget.name}"?`) : ''} />
    </div>
  )
}
