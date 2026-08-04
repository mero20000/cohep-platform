'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Calendar, AlertCircle } from 'lucide-react'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { toDateStr } from '@/components/curriculum/constants'
import { useLanguage } from '@/lib/use-language'
import {
  useLevelsQuery, useSubjectsQuery, useAcademicYearsQuery, useWeeksQuery,
  useGroupsQuery, useLessonsQuery, useAllAllocationsQuery,
  useCreateAllocationMutation, useUpdateAllocationMutation, useDeleteAllocationMutation,
  useBulkDeleteAllocationsMutation, useCreateLessonMutation, useUpdateLessonMutation,
  useDeleteLessonMutation,   useBulkImportLessonsMutation, useDeleteLevelMutation,
  useCreateSubjectMutation, useUpdateSubjectMutation, useDeleteSubjectMutation,
  useAllItemsQuery,
} from '@/components/curriculum/hooks'
import type { LessonFormData } from '@/components/curriculum/types'
import { LevelsTab } from '@/components/curriculum/levels-tab'
import { AllocationGrid } from '@/components/curriculum/allocation-grid'
import { CalendarView } from '@/components/curriculum/calendar-view'
import { TeachingView } from '@/components/curriculum/teaching-view'

function CurriculumContent() {
  const lang = useLanguage()
  const [activeTab, setActiveTab] = useState<'levels' | 'allocation' | 'calendar' | 'teaching'>('teaching')
  const [selectedLevelId, setSelectedLevelId] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedTerm, setSelectedTerm] = useState(1)
  const [selectedAllocLevelId, setSelectedAllocLevelId] = useState('')
  const [clearConfirm, setClearConfirm] = useState<{ scope: 'all' | 'term' | 'level' } | null>(null)

  const { toast } = useToast()
  const qc = useQueryClient()

  const invalidateAllocs = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['curriculum', 'allocations'] }),
      qc.invalidateQueries({ queryKey: ['curriculum', 'items'] }),
    ])
  }

  const createAlloc = useCreateAllocationMutation()
  const updateAlloc = useUpdateAllocationMutation()
  const deleteAlloc = useDeleteAllocationMutation()
  const bulkDeleteAllocs = useBulkDeleteAllocationsMutation()
  const createLesson = useCreateLessonMutation()
  const updateLesson = useUpdateLessonMutation()
  const deleteLesson = useDeleteLessonMutation()
  const bulkImportLessons = useBulkImportLessonsMutation()
  const [deletingLevelId, setDeletingLevelId] = useState<string | null>(null)
  const deleteLevel = useDeleteLevelMutation()
  const [teachingLevel, setTeachingLevel] = useState<number>(1)
  const { data: teachingItems = [] } = useAllItemsQuery(
    activeTab === 'teaching' || activeTab === 'calendar' ? teachingLevel : undefined
  )
  const createSubject = useCreateSubjectMutation()
  const updateSubject = useUpdateSubjectMutation()
  const deleteSubject = useDeleteSubjectMutation()

  const { data: levels = [] } = useLevelsQuery()
  const { data: subjects = [] } = useSubjectsQuery()
  const academicYearsQuery = useAcademicYearsQuery()
  const academicYears = academicYearsQuery.data ?? []
  const { data: weeks = [] } = useWeeksQuery(selectedYear || undefined)
  const { data: groups = [] } = useGroupsQuery()
  const { data: lessons = [] } = useLessonsQuery()
  const { data: allocations = [] } = useAllAllocationsQuery(
    selectedYear,
    activeTab === 'allocation' ? selectedAllocLevelId || undefined : undefined
  )

  useEffect(() => {
    if (!selectedYear && academicYears.length > 0) {
      const current = academicYears.find(y => y.isCurrent) || academicYears[0]
      if (current) setSelectedYear(current.id)
    }
  }, [selectedYear, academicYears])


  const saveAllocation = async (weekNumber: number, levelNum: number, subjectName: string, lessonId: string | null) => {
    const existing = allocations.find(a =>
      a.weekNumber === weekNumber && a.level.number === levelNum &&
      a.subject.name === subjectName && a.term === selectedTerm
    )
    const level = levels.find(l => l.number === levelNum)
    const subject = subjects.find(s => s.name === subjectName)
    if (!level || !subject || !selectedYear) {
      toast('error', lang === 'ar' ? 'بيانات غير كاملة للحفظ' : 'Incomplete data to save')
      return
    }

    try {
      if (existing && lessonId === null) {
        await deleteAlloc.mutateAsync(existing.id)
        toast('success', lang === 'ar' ? 'تم إزالة التوزيع' : 'Allocation removed')
        return
      }

      if (existing && lessonId) {
        const week = weeks.find(w => w.weekNumber === weekNumber && w.term === selectedTerm)
        await updateAlloc.mutateAsync({
          id: existing.id,
          data: {
            lessonId,
            scheduledDate: week?.startDate ? toDateStr(new Date(week.startDate)) : undefined,
          },
        })
        toast('success', lang === 'ar' ? 'تم تحديث التوزيع' : 'Allocation updated')
        return
      }

      if (!existing && lessonId) {
        const week = weeks.find(w => w.weekNumber === weekNumber && w.term === selectedTerm)
        await createAlloc.mutateAsync({
          academicYearId: selectedYear, levelId: level.id, subjectId: subject.id,
          lessonId, term: selectedTerm, weekNumber,
          scheduledDate: week?.startDate ? toDateStr(new Date(week.startDate)) : undefined,
          orderIndex: 1, status: 'published',
        })
        toast('success', lang === 'ar' ? 'تم إنشاء التوزيع' : 'Allocation created')
      }
    } catch (e: any) {
      toast('error', e?.message || (lang === 'ar' ? 'فشل حفظ التوزيع' : 'Failed to save allocation'))
    }
  }

  const handleClearAllocations = async (scope: 'all' | 'term' | 'level') => {
    if (!selectedYear) return
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear })
      if (scope === 'term') params.set('term', String(selectedTerm))
      if (scope === 'level' && selectedAllocLevelId) params.set('levelId', selectedAllocLevelId)
      await bulkDeleteAllocs.mutateAsync(params)
      toast('success', lang === 'ar' ? 'تم مسح التوزيعات' : 'Allocations cleared')
    } catch (e: any) {
      toast('error', e?.message || (lang === 'ar' ? 'فشل مسح التوزيعات' : 'Failed to clear allocations'))
    }
  }

  const handleAddLesson = async (levelId: string, subjectId: string, data: LessonFormData) => {
    try {
      const levelLessons = lessons.filter(l => l.level.number === levels.find(lv => lv.id === levelId)?.number)
      const maxOrder = levelLessons.reduce((max, l) => Math.max(max, l.orderIndex), 0)
      await createLesson.mutateAsync({ ...data, levelId, subjectId, orderIndex: maxOrder + 1 })
      toast('success', lang === 'ar' ? 'تمت إضافة التسبيحة' : 'Hymn added')
    } catch (e: any) { toast('error', e?.message || (lang === 'ar' ? 'فشل إضافة التسبيحة' : 'Failed to add hymn')) }
  }

  const handleEditLesson = async (id: string, data: LessonFormData & { levelId?: string }) => {
    try {
      await updateLesson.mutateAsync({ id, data: data as unknown as Record<string, unknown> })
      toast('success', lang === 'ar' ? 'تم تحديث التسبيحة' : 'Hymn updated')
    } catch (e: any) { toast('error', e?.message || (lang === 'ar' ? 'فشل تحديث التسبيحة' : 'Failed to update hymn')) }
  }

  const handleDeleteLesson = async (id: string) => {
    try {
      await deleteLesson.mutateAsync(id)
      toast('success', lang === 'ar' ? 'تم حذف التسبيحة' : 'Hymn deleted')
    } catch (e: any) { toast('error', e?.message || (lang === 'ar' ? 'فشل حذف التسبيحة' : 'Failed to delete hymn')) }
  }

  const handleImportLessons = async (levelId: string, importData: Record<string, string>[], subjectId: string) => {
    if (!subjectId) {
      toast('error', lang === 'ar' ? 'يرجى اختيار المادة' : 'Please select a subject')
      return
    }
    try {
      await bulkImportLessons.mutateAsync({
        lessons: importData.map((row, i) => ({
          levelId, subjectId,
          title: row.title || row.name || `${lang === 'ar' ? 'تسبيحة مستوردة' : 'Imported Hymn'} ${i + 1}`,
          titleAr: row.titlear || row.title_ar || row.arabic || '',
          titleCoptic: row.titlecoptic || row.title_coptic || row.coptic || '',
          description: row.description || '',
          descriptionAr: row.descriptionar || row.description_ar || '',
          descriptionCoptic: row.descriptioncoptic || row.description_coptic || '',
          estimatedDurationMinutes: parseInt(row.duration || row.minutes) || 30,
          sessionsCount: parseInt(row.sessions || row.session_count) || 1,
          orderIndex: i + 1, status: 'published',
        })),
      })
      toast('success', `${importData.length} ${lang === 'ar' ? 'تسبيحة تم استيرادها' : 'hymns imported'}`)
    } catch (e: any) { toast('error', e?.message || (lang === 'ar' ? 'فشل استيراد التسبائح' : 'Failed to import hymns')) }
  }

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(lang === 'ar' ? 'COHEP - منهج التسبحة القبطية' : 'COHEP - Coptic Hymns Curriculum', 14, 22)
    doc.setFontSize(10)
    doc.text(`${lang === 'ar' ? 'تم التصدير:' : 'Exported:'} ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 14, 30)
    autoTable(doc, {
      startY: 35,
      head: [[lang === 'ar' ? '#' : '#', lang === 'ar' ? 'المستوى' : 'Level', lang === 'ar' ? 'قبطي' : 'Coptic', lang === 'ar' ? 'عربي' : 'Arabic', lang === 'ar' ? 'إنجليزي' : 'English', lang === 'ar' ? 'المدة' : 'Duration', lang === 'ar' ? 'الجلسات' : 'Sessions', lang === 'ar' ? 'الحالة' : 'Status']],
      body: lessons.map((l, i) => [i + 1, `L${l.level.number}`, l.titleCoptic || '-', l.titleAr || '-', l.title, `${l.estimatedDurationMinutes || '-'}m`, `${l.sessionsCount}`, l.status]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [212, 175, 55] },
    })
    doc.save('niangelos-coptic-hymns.pdf')
  }

  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const wsData: (string | number | undefined)[][] = [[lang === 'ar' ? '#' : '#', lang === 'ar' ? 'المستوى' : 'Level', lang === 'ar' ? 'الاسم القبطي' : 'Coptic Name', lang === 'ar' ? 'الاسم العربي' : 'Arabic Name', lang === 'ar' ? 'الاسم الإنجليزي' : 'English Name', lang === 'ar' ? 'الوصف' : 'Description', lang === 'ar' ? 'المدة (دقيقة)' : 'Duration (min)', lang === 'ar' ? 'الجلسات' : 'Sessions', lang === 'ar' ? 'الحالة' : 'Status']]
    lessons.forEach((l, i) => wsData.push([i + 1, `${lang === 'ar' ? 'المستوى' : 'Level'} ${l.level.number}`, l.titleCoptic || '', l.titleAr || '', l.title, l.description || '', l.estimatedDurationMinutes || '', l.sessionsCount, l.status]))
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 5 }, { wch: 8 }, { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Coptic Hymns')
    XLSX.writeFile(wb, 'niangelos-coptic-hymns.xlsx')
  }

  const handleCreateAllocation = async (data: {
    academicYearId: string; levelId: string; subjectId: string; lessonId: string;
    groupNumber?: number; term: number; weekNumber: number; orderIndex: number; scheduledDate: string; status: string;
  }): Promise<boolean> => {
    try {
      await createAlloc.mutateAsync(data as unknown as Record<string, unknown>)
      return true
    } catch { return false }
  }

  const handleMoveAllocation = async (id: string, data: {
    weekNumber: number; orderIndex: number; scheduledDate: string;
  }) => {
    await updateAlloc.mutateAsync({ id, data: data as unknown as Record<string, unknown> })
  }

  const handleDeleteAllocation = async (id: string) => {
    await deleteAlloc.mutateAsync(id)
  }

  const sortedLevels = [...levels].sort((a, b) => a.number - b.number)

  const mainTabs = [
    { id: 'teaching' as const, label: lang === 'ar' ? 'التدريس' : 'Teaching', icon: BookOpen },
    { id: 'calendar' as const, label: lang === 'ar' ? 'عرض التقويم' : 'Calendar View', icon: Calendar },
    { id: 'levels' as const, label: lang === 'ar' ? 'المستويات' : 'Levels', icon: BookOpen },
    { id: 'allocation' as const, label: lang === 'ar' ? 'توزيع السنة والفصل' : 'Year & Term Allocation', icon: Calendar },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'المنهج الدراسي' : 'Curriculum'}</h1>
          <p className="text-sm text-gray-500 mt-1">{lang === 'ar' ? 'إدارة منهج التسبيح القبطي والتوزيع والجدولة' : 'Manage Coptic Hymns curriculum, allocation, and scheduling'}</p>
        </div>
        <span className="text-xs text-gray-400">{lessons.length} {lang === 'ar' ? 'تسبيحة' : 'lessons'} &bull; {allocations.length} {lang === 'ar' ? 'توزيع' : 'allocations'}</span>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" role="tablist" aria-label={lang === 'ar' ? 'أقسام المنهج' : 'Curriculum sections'}>
          {mainTabs.map((tab, i) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              onKeyDown={e => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  const dir = e.key === 'ArrowRight' ? 1 : -1
                  const next = mainTabs[(i + dir + mainTabs.length) % mainTabs.length]
                  setActiveTab(next.id)
                  document.getElementById(`tab-${next.id}`)?.focus()
                } else if (e.key === 'Home') {
                  e.preventDefault()
                  setActiveTab(mainTabs[0].id)
                  document.getElementById(`tab-${mainTabs[0].id}`)?.focus()
                } else if (e.key === 'End') {
                  e.preventDefault()
                  const last = mainTabs[mainTabs.length - 1]
                  setActiveTab(last.id)
                  document.getElementById(`tab-${last.id}`)?.focus()
                }
              }}
              role="tab" aria-selected={activeTab === tab.id} aria-controls={`panel-${tab.id}`} id={`tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 ${
                activeTab === tab.id ? 'border-gold-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <tab.icon className="h-4 w-4" />{tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
          aria-label={lang === 'ar' ? 'السنة الدراسية' : 'Academic year'}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          {academicYears.map(y => <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? (lang === 'ar' ? '(الحالي)' : '(Current)') : ''}</option>)}
        </select>
        {academicYearsQuery.isError && (
          <span role="alert" className="text-xs text-red-600">
            {lang === 'ar' ? 'تعذر تحميل السنوات الدراسية' : 'Couldn’t load academic years'}
          </span>
        )}
        {academicYearsQuery.isSuccess && academicYears.length === 0 && (
          <span className="text-xs text-gray-500">
            {lang === 'ar' ? 'لا توجد سنوات دراسية بعد' : 'No academic years yet'}
          </span>
        )}
      </div>

      {activeTab === 'levels' && (
        <LevelsTab
          levels={levels}
          subjects={subjects}
          lessons={lessons}
          selectedLevelId={selectedLevelId}
          onSelectLevel={setSelectedLevelId}
          onAddLesson={handleAddLesson}
          onEditLesson={handleEditLesson}
          onDeleteLesson={handleDeleteLesson}
          onDeleteLevel={(id) => { setDeletingLevelId(id); return Promise.resolve() }}
          onAddSubject={(data) => { createSubject.mutateAsync(data); return Promise.resolve() }}
          onEditSubject={(id, data) => { updateSubject.mutateAsync({ id, data }); return Promise.resolve() }}
          onDeleteSubject={(id) => { deleteSubject.mutateAsync(id); return Promise.resolve() }}
          onImportLessons={handleImportLessons}
          onExportPDF={exportPDF}
          onExportExcel={exportExcel}
          deletingLevelId={deletingLevelId}
        />
      )}

      {activeTab === 'allocation' && (
        <AllocationGrid
          weeks={weeks}
          allocations={allocations}
          levels={levels}
          lessons={lessons}
          subjects={subjects}
          selectedTerm={selectedTerm}
          selectedYear={selectedYear}
          selectedAllocLevelId={selectedAllocLevelId}
          groups={groups}
          onTermChange={setSelectedTerm}
          onAllocLevelChange={setSelectedAllocLevelId}
          onSaveAllocation={saveAllocation}
          onClearAllocations={(scope) => setClearConfirm({ scope })}
        />
      )}

      {activeTab === 'calendar' && (
        <CalendarView
          allocations={allocations}
          lessons={lessons}
          teachingItems={teachingItems}
          levels={levels}
          subjects={subjects}
          weeks={weeks}
          selectedYear={selectedYear}
          onRefresh={invalidateAllocs}
          onCreateAllocation={handleCreateAllocation}
          onMoveAllocation={handleMoveAllocation}
          onDeleteAllocation={handleDeleteAllocation}
          onClearAllocations={(scope) => setClearConfirm({ scope })}
        />
      )}

      {activeTab === 'teaching' && (
        <TeachingView
          items={teachingItems}
          subjects={subjects}
          levels={levels}
          lessons={lessons}
          allocations={allocations}
          levelNumber={teachingLevel}
          onLevelChange={setTeachingLevel}
        />
      )}

      <ConfirmDialog
        open={!!clearConfirm}
        onClose={() => setClearConfirm(null)}
        onConfirm={() => { if (clearConfirm) { handleClearAllocations(clearConfirm.scope); setClearConfirm(null) } }}
        title={lang === 'ar' ? 'مسح التوزيعات' : 'Clear Allocations'}
        message={clearConfirm ? (lang === 'ar' ? `حذف ${clearConfirm.scope === 'all' ? 'جميع التوزيعات' : clearConfirm.scope === 'term' ? `توزيعات الفصل ${selectedTerm}` : 'توزيعات المستوى المحدد'}؟ لا يمكن التراجع عن ذلك.` : `Delete ${clearConfirm.scope === 'all' ? 'all allocations' : clearConfirm.scope === 'term' ? `allocations for Term ${selectedTerm}` : 'allocations for the selected level'}? This cannot be undone.`) : ''}
        confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
      />

      <ConfirmDialog
        open={!!deletingLevelId}
        onClose={() => setDeletingLevelId(null)}
        onConfirm={async () => {
          if (deletingLevelId) {
            await deleteLevel.mutateAsync(deletingLevelId)
            setDeletingLevelId(null)
          }
        }}
        title={lang === 'ar' ? 'حذف المستوى' : 'Delete Level'}
        message={lang === 'ar' ? 'حذف هذا المستوى وجميع دروسه؟ لا يمكن التراجع عن ذلك.' : 'Delete this level and all its lessons? This cannot be undone.'}
        confirmLabel={deleteLevel.isPending ? (lang === 'ar' ? 'جارٍ الحذف...' : 'Deleting...') : (lang === 'ar' ? 'حذف' : 'Delete')}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
      />
    </div>
  )
}

export default function CurriculumPage() {
  return (
    <ErrorBoundary>
      <CurriculumContent />
    </ErrorBoundary>
  )
}
