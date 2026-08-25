'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, Clock, Search, Music, Plus, Upload, FileText, FileSpreadsheet,
  Pencil, Trash2, Loader2, Presentation, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { getSubjectStyle, STATUS_BADGE } from './constants'
import type { Level, Subject, Lesson, LessonFormData, PresentationData } from './types'
import { LessonModal } from './lesson-modal'
import { ImportModal } from './import-modal'
import { PresentationViewer } from './presentation-viewer'
import { useLanguage } from '@/lib/use-language'

interface LevelsTabProps {
  levels: Level[]
  subjects: Subject[]
  lessons: Lesson[]
  selectedLevelId: string
  onSelectLevel: (id: string) => void
  onAddLesson: (levelId: string, subjectId: string, data: LessonFormData) => Promise<void>
  onEditLesson: (id: string, data: LessonFormData & { levelId?: string }) => Promise<void>
  onDeleteLesson: (id: string) => Promise<void>
  onDeleteLevel: (id: string) => Promise<void>
  onAddSubject: (data: { name: string; nameAr?: string; description?: string }) => Promise<void>
  onEditSubject: (id: string, data: { name?: string; nameAr?: string; description?: string }) => Promise<void>
  onDeleteSubject: (id: string) => Promise<void>
  onImportLessons: (levelId: string, data: Record<string, string>[], subjectId: string) => Promise<void>
  onExportPDF: () => Promise<void>
  onExportExcel: () => Promise<void>
  deletingLevelId: string | null
}

export function LevelsTab({
  levels, subjects, lessons, selectedLevelId, onSelectLevel,
  onAddLesson, onEditLesson, onDeleteLesson, onDeleteLevel, onAddSubject, onEditSubject, onDeleteSubject, onImportLessons,
  onExportPDF, onExportExcel, deletingLevelId,
}: LevelsTabProps) {
  const lang = useLanguage()
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [deleteLevelId, setDeleteLevelId] = useState<string | null>(null)
  const [showSubjectsModal, setShowSubjectsModal] = useState(false)
  const [editSubject, setEditSubject] = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm] = useState({ name: '', nameAr: '', description: '' })
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<Subject | null>(null)
  const [deleteLessonTarget, setDeleteLessonTarget] = useState<Lesson | null>(null)
  const [presentingLesson, setPresentingLesson] = useState<Lesson | null>(null)
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set())


  const sortedLevels = [...levels].sort((a, b) => a.number - b.number)

  const filteredLessons = lessons.filter(l =>
    !search || l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.titleAr?.includes(search) || l.titleCoptic?.includes(search)
  )

  const lessonsBySubject = filteredLessons.reduce((acc, l) => {
    const key = l.subject.name
    if (!acc[key]) acc[key] = []
    acc[key].push(l)
    return acc
  }, {} as Record<string, Lesson[]>)

  const handleSaveAdd = async (levelId: string, subjectId: string, data: LessonFormData) => {
    await onAddLesson(levelId, subjectId, data)
    setShowAddModal(false)
  }

  const handleSaveEdit = async (data: LessonFormData & { levelId?: string }) => {
    if (!editLesson) return
    await onEditLesson(editLesson.id, data)
    setEditLesson(null)
  }

  return (
    <div role="tabpanel" id="panel-levels" aria-labelledby="tab-levels" className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ar' ? 'البحث في التسبائح...' : 'Search hymns...'} aria-label={lang === 'ar' ? 'البحث في التسبائح' : 'Search hymns'}
            className="w-full rounded-lg border border-gray-300 ps-9 pe-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2 ms-auto">
          <button onClick={() => { setEditSubject(null); setSubjectForm({ name: '', nameAr: '', description: '' }); setShowSubjectsModal(true) }}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white">
            <BookOpen className="h-3.5 w-3.5" />{lang === 'ar' ? 'إدارة المواد' : 'Manage Subjects'}
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gold-600">
            <Plus className="h-3.5 w-3.5" />{lang === 'ar' ? 'إضافة تسبيحة' : 'Add Hymn'}
          </button>
          <button onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white">
            <Upload className="h-3.5 w-3.5" />{lang === 'ar' ? 'استيراد' : 'Import'}
          </button>
          <button onClick={onExportPDF}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white">
            <FileText className="h-3.5 w-3.5" />PDF
          </button>
          <button onClick={onExportExcel}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white">
            <FileSpreadsheet className="h-3.5 w-3.5" />Excel
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {sortedLevels.map(l => (
            <div key={l.id} className="relative group">
              <button onClick={() => onSelectLevel(l.id)}
                className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selectedLevelId === l.id
                    ? 'border-gold-500 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                {lang === 'ar' ? 'المستوى' : 'Level'} {l.number}
                {l._count?.lessons ? <span className="ms-1.5 text-xs opacity-60">({l._count.lessons})</span> : null}
              </button>
              {selectedLevelId === l.id && (
                <button onClick={() => setDeleteLevelId(l.id)}
                  aria-label={lang === 'ar' ? `حذف المستوى ${l.number}` : `Delete level ${l.number}`}
                  className="absolute top-1/2 -translate-y-1/2 -end-2 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                  <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                </button>
              )}
            </div>
          ))}
          {sortedLevels.length === 0 && <span className="px-4 py-2.5 text-sm text-gray-500">{lang === 'ar' ? 'لا توجد مستويات' : 'No levels configured'}</span>}
        </nav>
      </div>

      {selectedLevelId ? (
        <div className="space-y-3">
          {subjects.map((subject) => {
            const style = getSubjectStyle(subject.name)
            const Icon = style.icon
            const subjectLessons = lessonsBySubject[subject.name]
            if (!subjectLessons?.length) return null
            const isCollapsed = collapsedSubjects.has(subject.name)
            const completedCount = subjectLessons.filter(l => l.status === 'published').length
            return (
              <div key={subject.id} className={`rounded-2xl border overflow-hidden transition-all ${isCollapsed ? 'border-gray-200 bg-white' : 'border-gray-200 bg-white shadow-sm'}`}>
                {/* Subject header — clickable to collapse */}
                <button onClick={() => {
                  setCollapsedSubjects(prev => {
                    const next = new Set(prev)
                    if (next.has(subject.name)) next.delete(subject.name)
                    else next.add(subject.name)
                    return next
                  })
                }}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isCollapsed ? 'hover:bg-gray-50/50' : style.hover}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.bg}`}>
                    <Icon className={`h-5 w-5 ${style.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-bold ${style.text}`}>{subject.name}</h3>
                      {subject.nameAr && <span className="text-xs text-gray-400" dir="rtl">{subject.nameAr}</span>}
                      <span className="text-[11px] text-gray-400 ms-auto">{subjectLessons.length} {lang === 'ar' ? 'تسبيحة' : 'hymns'}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-gray-400">
                    {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </button>
                {/* Collapsible body */}
                {!isCollapsed && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {subjectLessons.sort((a, b) => a.orderIndex - b.orderIndex).map((lesson, idx) => (
                      <div key={lesson.id} className={`px-5 py-3 flex items-center gap-3 ${style.hover} group`}>
                        <span className="text-xs text-gray-400 font-mono w-5">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <Link href={`/dashboard/curriculum/lesson/${lesson.id}`}
                            className="flex items-center gap-2 flex-wrap hover:opacity-80 transition-opacity">
                            {lesson.titleCoptic && <span className="font-medium text-gray-900 text-sm">{lesson.titleCoptic}</span>}
                            {lesson.titleAr && <span className="text-gray-600 text-sm arabic-text" dir="rtl">{lesson.titleAr}</span>}
                            <span className="text-gray-500 text-xs">{lesson.title}</span>
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-0.5 text-[11px] text-gray-500"><Clock className="h-2.5 w-2.5" />{lesson.estimatedDurationMinutes || '-'}m</span>
                            <span className="text-[11px] text-gray-500">{lesson.sessionsCount} {lang === 'ar' ? (lesson.sessionsCount === 1 ? 'جلسة' : 'جلسات') : lesson.sessionsCount > 1 ? 'sessions' : 'session'}</span>
                            <Badge variant={STATUS_BADGE[lesson.status] || 'default'} size="sm">{lesson.status}</Badge>
                            {lesson.presentationData && (
                              <span className="flex items-center gap-0.5 text-[10px] text-purple-500" title={lang === 'ar' ? 'يوجد عرض' : 'Has presentation'}>
                                <Presentation className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {lesson.presentationData && (
                            <button onClick={() => setPresentingLesson(lesson)}
                              aria-label={lang === 'ar' ? `عرض ${lesson.titleCoptic || lesson.title}` : `Present ${lesson.titleCoptic || lesson.title}`}
                              className="p-2 rounded hover:bg-gray-200 text-gray-400 hover:text-purple-600 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" title={lang === 'ar' ? 'عرض التسبيحة' : 'Present Hymn'}>
                              <Presentation className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => setEditLesson(lesson)} aria-label={lang === 'ar' ? 'تعديل' : 'Edit'}
                            className="p-2 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-700 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" title={lang === 'ar' ? 'تعديل' : 'Edit'}><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteLessonTarget(lesson)} aria-label={lang === 'ar' ? 'حذف' : 'Delete'}
                            className="p-2 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400" title={lang === 'ar' ? 'حذف' : 'Delete'}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {Object.keys(lessonsBySubject).length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
              <Music className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'لا توجد تسبائح لهذا المستوى' : 'No hymns found for this level'}</p>
              <p className="text-xs text-gray-400 mt-1">{lang === 'ar' ? 'أضف تسبائح باستخدام زر "إضافة تسبيحة"' : 'Add hymns using the "Add Hymn" button above'}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-16 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-lg font-medium text-gray-700">{lang === 'ar' ? 'اختر مستوى لعرض المنهج' : 'Select a level to view curriculum'}</p>
          <p className="text-sm text-gray-400 mt-1">{lang === 'ar' ? 'اختر علامة تبويب مستوى أعلاه لرؤية التسبائح المصنفة حسب الموضوع' : 'Choose a level tab above to see subject-grouped hymns'}</p>
        </div>
      )}

      {showAddModal && (
        <LessonModal
          mode="add"
          levels={levels}
          subjects={subjects}
          onSaveAdd={handleSaveAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editLesson && (
        <LessonModal
          mode="edit"
          lesson={editLesson}
          levels={levels}
          subjects={subjects}
          onSaveEdit={handleSaveEdit}
          onClose={() => setEditLesson(null)}
        />
      )}

      {showImportModal && (
        <ImportModal
          levels={levels}
          subjects={subjects}
          onImport={(levelId, data, subjectId) => {
            onImportLessons(levelId, data, subjectId)
            setShowImportModal(false)
          }}
          onClose={() => setShowImportModal(false)}
        />
      )}

      <ConfirmDialog
        open={!!deleteLevelId || !!deletingLevelId}
        onClose={() => { setDeleteLevelId(null) }}
        onConfirm={async () => { if (deleteLevelId) { await onDeleteLevel(deleteLevelId); setDeleteLevelId(null) } }}
        title={lang === 'ar' ? 'حذف المستوى' : 'Delete Level'}
        message={lang === 'ar' ? 'حذف هذا المستوى وجميع دروسه؟ لا يمكن التراجع عن ذلك.' : 'Delete this level and all its lessons? This cannot be undone.'}
        confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
      />

      <Modal open={showSubjectsModal} onClose={() => { setShowSubjectsModal(false); setEditSubject(null) }} title={lang === 'ar' ? 'إدارة المواد' : 'Manage Subjects'} size="md">
        <div className="max-h-[60vh] overflow-y-auto space-y-3">
          {subjects.map(s => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{s.name}</div>
                {s.nameAr && <div className="text-xs text-gray-400">{s.nameAr}</div>}
              </div>
              <button onClick={() => { setEditSubject(s); setSubjectForm({ name: s.name, nameAr: s.nameAr || '', description: s.description || '' }) }}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100">{lang === 'ar' ? 'تعديل' : 'Edit'}</button>
              <button onClick={() => setDeleteSubjectTarget(s)}
                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">{lang === 'ar' ? 'حذف' : 'Delete'}</button>
            </div>
          ))}
          {subjects.length === 0 && <div className="text-sm text-gray-400 text-center py-4">{lang === 'ar' ? 'لا توجد مواد مكونة' : 'No subjects configured'}</div>}
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <div className="text-sm font-medium text-gray-700">{lang === 'ar' ? (editSubject ? 'تعديل المادة' : 'إضافة مادة جديدة') : (editSubject ? 'Edit Subject' : 'Add New Subject')}</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={subjectForm.name} onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))} placeholder={lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}
              className="col-span-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input value={subjectForm.nameAr} onChange={e => setSubjectForm(f => ({ ...f, nameAr: e.target.value }))} placeholder={lang === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}
              className="col-span-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <input value={subjectForm.description} onChange={e => setSubjectForm(f => ({ ...f, description: e.target.value }))} placeholder={lang === 'ar' ? 'الوصف (اختياري)' : 'Description (optional)'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <div className="flex items-center gap-2">
            {editSubject && (
              <button onClick={() => { setEditSubject(null); setSubjectForm({ name: '', nameAr: '', description: '' }) }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            )}
            <button onClick={async () => {
              if (!subjectForm.name.trim()) return
              try {
                if (editSubject) {
                  await onEditSubject(editSubject.id, { name: subjectForm.name, nameAr: subjectForm.nameAr, description: subjectForm.description })
                } else {
                  await onAddSubject({ name: subjectForm.name, nameAr: subjectForm.nameAr, description: subjectForm.description })
                }
                setSubjectForm({ name: '', nameAr: '', description: '' })
                setEditSubject(null)
              } catch {} // error handled by parent
            }}
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600">
              {lang === 'ar' ? (editSubject ? 'حفظ التغييرات' : 'إضافة مادة') : (editSubject ? 'Save Changes' : 'Add Subject')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteLessonTarget}
        onClose={() => setDeleteLessonTarget(null)}
        onConfirm={async () => {
          if (deleteLessonTarget) {
            await onDeleteLesson(deleteLessonTarget.id)
            setDeleteLessonTarget(null)
          }
        }}
        title={lang === 'ar' ? 'حذف التسبيحة' : 'Delete Hymn'}
        message={deleteLessonTarget ? (lang === 'ar' ? `حذف التسبيحة "${deleteLessonTarget.titleCoptic || deleteLessonTarget.title}"؟ لا يمكن التراجع عن ذلك.` : `Delete "${deleteLessonTarget.titleCoptic || deleteLessonTarget.title}"? This cannot be undone.`) : ''}
        confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
      />

      <ConfirmDialog
        open={!!deleteSubjectTarget}
        onClose={() => setDeleteSubjectTarget(null)}
        onConfirm={async () => {
          if (deleteSubjectTarget) {
            await onDeleteSubject(deleteSubjectTarget.id)
            setDeleteSubjectTarget(null)
          }
        }}
        title={lang === 'ar' ? 'حذف المادة' : 'Delete Subject'}
        message={deleteSubjectTarget ? (lang === 'ar' ? `حذف المادة "${deleteSubjectTarget.name}" وجميع دروسها؟ لا يمكن التراجع عن ذلك.` : `Delete "${deleteSubjectTarget.name}" and all its lessons? This cannot be undone.`) : ''}
        confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
      />

      {presentingLesson?.presentationData && (
        <PresentationViewer
          data={presentingLesson.presentationData}
          title={presentingLesson.title}
          titleCoptic={presentingLesson.titleCoptic}
          titleAr={presentingLesson.titleAr}
          onExit={() => setPresentingLesson(null)}
        />
      )}
    </div>
  )
}
