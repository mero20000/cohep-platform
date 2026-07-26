'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { SlideEditor } from './slide-editor'
import { API, SCHOOL_ID } from './constants'
import type { Level, Subject, Lesson, LessonFormData, PresentationData, SubjectItem } from './types'

interface LessonModalProps {
  mode: 'add' | 'edit'
  lesson?: Lesson
  levels: Level[]
  subjects: Subject[]
  onSaveAdd?: (levelId: string, subjectId: string, data: LessonFormData) => Promise<void>
  onSaveEdit?: (data: LessonFormData & { levelId?: string }) => Promise<void>
  onClose: () => void
}

export function LessonModal({ mode, lesson, levels, subjects, onSaveAdd, onSaveEdit, onClose }: LessonModalProps) {
  const lang = useLanguage()
  const [form, setForm] = useState<LessonFormData>({
    title: '', titleAr: '', titleCoptic: '',
    description: '', descriptionAr: '', descriptionCoptic: '',
    estimatedDurationMinutes: 30, sessionsCount: 1, status: 'published',
    presentationHtml: '',
    presentationData: undefined,
    subjectItemId: undefined,
  })
  const [levelId, setLevelId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [subjectItems, setSubjectItems] = useState<SubjectItem[]>([])
  const [subjectItemsLoading, setSubjectItemsLoading] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && lesson) {
      setForm({
        title: lesson.title, titleAr: lesson.titleAr || '', titleCoptic: lesson.titleCoptic || '',
        description: lesson.description || '', descriptionAr: lesson.descriptionAr || '',
        descriptionCoptic: lesson.descriptionCoptic || '',
        estimatedDurationMinutes: lesson.estimatedDurationMinutes || 30,
        sessionsCount: lesson.sessionsCount, status: lesson.status,
        presentationHtml: lesson.presentationHtml || '',
        presentationData: (lesson as any).presentationData || undefined,
        subjectItemId: (lesson as any).subjectItemId || undefined,
      })
      const matchedLevel = levels.find(l => l.number === lesson.level.number)
      setLevelId(matchedLevel?.id || '')
      setSubjectId(subjects.find(s => s.name === lesson.subject.name)?.id || '')
    } else {
      const first = subjects[0]
      if (first) setSubjectId(first.id)
    }
  }, [mode, lesson, levels, subjects])

  // Fetch subject items when subject changes
  useEffect(() => {
    if (!subjectId) { setSubjectItems([]); return }
    setSubjectItemsLoading(true)
    fetch(`${API}/curriculum/subjects/${subjectId}/items?schoolId=${SCHOOL_ID}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => setSubjectItems(Array.isArray(data) ? data : []))
      .catch(() => setSubjectItems([]))
      .finally(() => setSubjectItemsLoading(false))
  }, [subjectId])

  const handleSelectSubjectItem = (itemId: string) => {
    const item = subjectItems.find(i => i.id === itemId)
    if (!item) return
    setForm(prev => ({
      ...prev,
      title: prev.title || item.name,
      titleCoptic: prev.titleCoptic || item.nameCoptic || '',
      titleAr: prev.titleAr || item.nameAr || '',
      subjectItemId: itemId,
      presentationData: item.presentationData || prev.presentationData,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (mode === 'add') {
        const sid = subjectId || subjects[0]?.id
        if (!levelId || !form.title.trim() || !sid) return
        await onSaveAdd?.(levelId, sid, form)
      } else {
        await onSaveEdit?.({ ...form, levelId: levelId || undefined })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: keyof LessonFormData, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label={mode === 'add' ? (lang === 'ar' ? 'إضافة تسبيحة جديدة' : 'Add New Hymn') : (lang === 'ar' ? 'تعديل التسبيحة' : 'Edit Hymn')}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-900">{mode === 'add' ? (lang === 'ar' ? 'إضافة تسبيحة جديدة' : 'Add New Hymn') : (lang === 'ar' ? 'تعديل التسبيحة' : 'Edit Hymn')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label={lang === 'ar' ? 'إغلاق' : 'Close dialog'}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {mode === 'add' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المادة' : 'Subject'}</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الحالة' : 'Status'}</label>
                <select value={form.status} onChange={e => handleFieldChange('status', e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="draft">{lang === 'ar' ? 'مسودة' : 'Draft'}</option><option value="published">{lang === 'ar' ? 'منشور' : 'Published'}</option><option value="archived">{lang === 'ar' ? 'مؤرشف' : 'Archived'}</option>
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المستوى' : 'Level'}</label>
            <select value={levelId} onChange={e => setLevelId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              {mode === 'add' && <option value="">{lang === 'ar' ? 'اختر مستوى...' : 'Select level...'}</option>}
              {levels.map(l => <option key={l.id} value={l.id}>{lang === 'ar' ? 'المستوى' : 'Level'} {l.number} — {l.name}</option>)}
            </select>
          </div>
          {subjectId && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {lang === 'ar' ? 'عنصر المادة (اختياري)' : 'Subject Item (optional)'}
                {subjectItemsLoading && <Loader2 className="h-3 w-3 inline ml-1 animate-spin" />}
              </label>
              <div className="flex gap-2">
                <select value={form.subjectItemId || ''} onChange={e => handleSelectSubjectItem(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">{lang === 'ar' ? '— اختر عنصراً —' : '— Select item —'}</option>
                  {subjectItems.map(si => (
                    <option key={si.id} value={si.id}>
                      {[si.nameCoptic, si.nameAr, si.name].filter(Boolean).join(' — ')} {si.presentationData ? '🎵' : ''}
                    </option>
                  ))}
                </select>
                {form.subjectItemId && (
                  <button onClick={() => {
                    const item = subjectItems.find(i => i.id === form.subjectItemId)
                    if (item?.presentationData) {
                      setForm(prev => ({ ...prev, presentationData: item.presentationData }))
                    }
                  }}
                    className="px-2 py-1 rounded-lg border border-gray-300 text-xs text-gray-500 hover:bg-gray-50"
                    title={lang === 'ar' ? 'نسخ المحتوى من العنصر' : 'Copy content from item'}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الاسم القبطي' : 'Coptic Name'}</label>
            <input type="text" value={form.titleCoptic} onChange={e => handleFieldChange('titleCoptic', e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الاسم العربي' : 'Arabic Name'}</label>
            <input type="text" value={form.titleAr} onChange={e => handleFieldChange('titleAr', e.target.value)} dir="rtl"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الاسم الإنجليزي' : 'English Name'}{mode === 'add' ? (lang === 'ar' ? ' *' : ' *') : ''}</label>
            <input type="text" value={form.title} onChange={e => handleFieldChange('title', e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          {mode === 'edit' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الحالة' : 'Status'}</label>
              <select value={form.status} onChange={e => handleFieldChange('status', e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="draft">{lang === 'ar' ? 'مسودة' : 'Draft'}</option><option value="published">{lang === 'ar' ? 'منشور' : 'Published'}</option><option value="archived">{lang === 'ar' ? 'مؤرشف' : 'Archived'}</option>
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المدة (دقيقة)' : 'Duration (min)'}</label>
              <input type="number" value={form.estimatedDurationMinutes} onChange={e => handleFieldChange('estimatedDurationMinutes', Number(e.target.value))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الجلسات' : 'Sessions'}</label>
              <input type="number" value={form.sessionsCount} onChange={e => handleFieldChange('sessionsCount', Number(e.target.value))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <SlideEditor
              value={form.presentationData}
              onChange={(data: PresentationData) => setForm(prev => ({ ...prev, presentationData: data }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'HTML العرض (النسخة الاحتياطية)' : 'Presentation HTML (Legacy)'}</label>
            <textarea value={form.presentationHtml} onChange={e => handleFieldChange('presentationHtml', e.target.value)}
              placeholder={lang === 'ar' ? 'الصق محتوى الشرائح HTML هنا...' : 'Paste your HTML slide content here...'}
              rows={4}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={saving || (mode === 'add' && (!form.title.trim() || !levelId))}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'add' ? (lang === 'ar' ? 'إضافة تسبيحة' : 'Add Hymn') : (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  )
}
