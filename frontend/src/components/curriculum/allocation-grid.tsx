'use client'

import { useState, useCallback } from 'react'
import { Calendar, Trash2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/lib/use-language'
import { TERM_SHORT, getSubjectStyle, formatDateFull, STATUS_BADGE } from './constants'
import type { AcademicWeek, Allocation, Level, Lesson, Group, Subject } from './types'

interface PendingChange {
  weekNumber: number
  levelNum: number
  subjectName: string
  fromLessonId: string | null
  toLessonId: string | null
}

interface AllocationGridProps {
  weeks: AcademicWeek[]
  allocations: Allocation[]
  levels: Level[]
  lessons: Lesson[]
  subjects: Subject[]
  selectedTerm: number
  selectedYear: string
  selectedAllocLevelId: string
  groups: Group[]
  onTermChange: (term: number) => void
  onAllocLevelChange: (id: string) => void
  onSaveAllocation: (weekNumber: number, levelNum: number, subjectName: string, lessonId: string | null) => Promise<void>
  onClearAllocations: (scope: 'all' | 'term' | 'level') => void
}

function MobileAllocationCard({ week, level, allocations, lessons, onSave, saving, subjects }: {
  week: AcademicWeek; level: Level; allocations: Allocation[]; lessons: Lesson[];
  onSave: (wn: number, ln: number, sn: string, lid: string | null) => Promise<void>;
  saving: boolean; subjects: Subject[];
}) {
  const lang = useLanguage()
  const satDate = new Date(week.startDate)
  const sunDate = new Date(satDate)
  sunDate.setDate(satDate.getDate() + 1)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
        <div className="font-medium text-gray-900 text-sm">W{week.weekNumber}</div>
        <div className="text-[10px] text-gray-400">{formatDateFull(week.startDate, lang)} — {formatDateFull(sunDate.toISOString(), lang)}</div>
      </div>
      <div className="divide-y divide-gray-100">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold text-gray-700">L{level.number}</span>
        </div>
        {subjects.map(subject => {
          const s = getSubjectStyle(subject.name)
          const alloc = allocations.find(a => a.weekNumber === week.weekNumber && a.level.number === level.number && a.subject.name === subject.name)
          return (
            <div key={subject.id} className="flex items-center gap-2 px-4 py-2">
              <span className={`flex items-center gap-1 text-xs font-medium min-w-[80px] ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {subject.name}
              </span>
              <select value={alloc?.lesson.id || ''}
                onChange={e => onSave(week.weekNumber, level.number, subject.name, e.target.value || null)}
                disabled={saving}
                className={`flex-1 text-xs rounded border ${alloc ? `${s.border} ${s.bg}` : 'border-gray-200'} px-2 py-1.5 focus:border-gold-500 focus:outline-none ${s.text} disabled:opacity-50`}>
                <option value="">— None —</option>
                {lessons.filter(l => l.level.number === level.number && l.subject.name === subject.name).sort((a, b) => a.orderIndex - b.orderIndex).map(lsn => (
                  <option key={lsn.id} value={lsn.id}>
                    {lsn.titleCoptic || lsn.title} {lsn.estimatedDurationMinutes ? `(${lsn.estimatedDurationMinutes}m)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AllocationGrid({
  weeks, allocations, levels, lessons, subjects, selectedTerm, selectedYear,
  selectedAllocLevelId, groups,
  onTermChange, onAllocLevelChange, onSaveAllocation, onClearAllocations,
}: AllocationGridProps) {
  const lang = useLanguage()
  const sortedLevels = [...levels].sort((a, b) => a.number - b.number)
  const termWeeks = weeks.filter(w => w.term === selectedTerm)
  const [saving, setSaving] = useState<Set<string>>(new Set())

  const lessonsByLevelAndSubject = (levelNum: number, subjectName: string) => {
    return lessons.filter(l => l.level.number === levelNum && l.subject.name === subjectName)
  }

  const getAllocation = (weekNumber: number, levelNum: number, subjectName: string) => {
    return allocations.find(a =>
      a.weekNumber === weekNumber &&
      a.level.number === levelNum &&
      a.subject.name === subjectName &&
      a.term === selectedTerm
    )
  }

  const handleSave = useCallback(async (weekNumber: number, levelNum: number, subjectName: string, lessonId: string | null) => {
    const existing = getAllocation(weekNumber, levelNum, subjectName)
    const key = `${weekNumber}-${levelNum}-${subjectName}`

    if (existing && lessonId === null) {
      const confirmed = window.confirm(
        lang === 'ar'
          ? `هل أنت متأكد من إزالة التوزيع للأسبوع ${weekNumber}، المستوى ${levelNum}، ${subjectName}؟`
          : `Remove allocation for Week ${weekNumber}, Level ${levelNum}, ${subjectName}?`
      )
      if (!confirmed) return
    }

    if (existing && lessonId && existing.lesson.id !== lessonId) {
      const confirmed = window.confirm(
        lang === 'ar'
          ? `تغيير توزيع الأسبوع ${weekNumber}، المستوى ${levelNum} من "${existing.lesson.title}" إلى التسبيحة الجديدة؟`
          : `Change Week ${weekNumber}, Level ${levelNum} allocation from "${existing.lesson.title}"?`
      )
      if (!confirmed) return
    }

    setSaving(prev => new Set(prev).add(key))
    try {
      await onSaveAllocation(weekNumber, levelNum, subjectName, lessonId)
    } finally {
      setSaving(prev => { const next = new Set(prev); next.delete(key); return next })
    }
  }, [allocations, selectedTerm, onSaveAllocation, lang])

  const displayLevels = selectedAllocLevelId
    ? sortedLevels.filter(l => l.id === selectedAllocLevelId)
    : sortedLevels

  if (termWeeks.filter(w => w.isAvailable).length === 0) {
    return (
      <div role="tabpanel" id="panel-allocation" aria-labelledby="tab-allocation" className="space-y-6">
        <Toolbar {...{ lang, selectedTerm, onTermChange, selectedAllocLevelId, onAllocLevelChange, sortedLevels, selectedYear, onClearAllocations }} />
        <div className="text-center py-12 text-gray-400 border rounded-xl">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{lang === 'ar' ? 'لا توجد أسابيع متاحة لهذا الفصل' : 'No available weeks for this term'}</p>
        </div>
      </div>
    )
  }

  return (
    <div role="tabpanel" id="panel-allocation" aria-labelledby="tab-allocation" className="space-y-6">
      <Toolbar {...{ lang, selectedTerm, onTermChange, selectedAllocLevelId, onAllocLevelChange, sortedLevels, selectedYear, onClearAllocations }} />

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto table-to-cards rounded-xl border border-gray-200">
        <table className="w-full" aria-label={lang === 'ar' ? 'جدول توزيع المنهج' : 'Curriculum allocation table'}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500" scope="col">
                {lang === 'ar' ? 'الأسبوع' : 'Week'}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500" scope="col">
                {lang === 'ar' ? 'المستوى' : 'Level'}
              </th>
              {subjects.map(subject => {
                const s = getSubjectStyle(subject.name)
                return <th key={subject.id} colSpan={2} scope="colgroup" className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ${s.text}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden="true" />
                    {subject.name}
                    <span className="sr-only">{lang === 'ar' ? 'تسبيحة' : 'lesson'}</span>
                  </div>
                </th>
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {termWeeks.filter(w => w.isAvailable).map((week) => displayLevels.map((level, li) => {
              const cellKey = `${week.id}-${level.id}`
              return (
                <tr key={cellKey} className="hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors">
                  {li === 0 && (
                    <td rowSpan={displayLevels.length} data-label={lang === 'ar' ? 'الأسبوع' : 'Week'} className="px-3 py-3 text-sm align-top w-[90px]">
                      <div className="font-medium text-gray-900">W{week.weekNumber}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                        {formatDateFull(week.startDate, lang)}
                      </div>
                    </td>
                  )}
                  <td data-label={lang === 'ar' ? 'المستوى' : 'Level'} className="px-3 py-3 text-sm font-medium text-gray-700 w-[50px]">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">L{level.number}</span>
                  </td>
                  {subjects.map(subject => {
                    const alloc = getAllocation(week.weekNumber, level.number, subject.name)
                    const s = getSubjectStyle(subject.name)
                    const availableLessons = lessonsByLevelAndSubject(level.number, subject.name)
                    const cellKey2 = `${week.weekNumber}-${level.number}-${subject.name}`
                    const isSaving = saving.has(cellKey2)
                    return (
                      <td key={subject.id} colSpan={2} data-label={subject.name} className="px-3 py-2 min-w-[140px]">
                        <div className="flex items-center gap-1">
                          <select value={alloc?.lesson.id || ''}
                            onChange={e => handleSave(week.weekNumber, level.number, subject.name, e.target.value || null)}
                            disabled={isSaving}
                            className={`flex-1 text-xs rounded border ${alloc ? `${s.border} ${s.bg}` : 'border-gray-200'} px-2 py-1.5 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${s.text} disabled:opacity-50`}
                            aria-label={`${subject.name} — ${lang === 'ar' ? 'الأسبوع' : 'Week'} ${week.weekNumber}, ${lang === 'ar' ? 'المستوى' : 'Level'} ${level.number}`}>
                            <option value="">—</option>
                            {availableLessons.sort((a, b) => a.orderIndex - b.orderIndex).map(lsn => (
                              <option key={lsn.id} value={lsn.id}>
                                {lsn.titleCoptic || lsn.title} {lsn.estimatedDurationMinutes ? `(${lsn.estimatedDurationMinutes}m)` : ''}
                              </option>
                            ))}
                            {availableLessons.length === 0 && (
                              <option value="" disabled>{lang === 'ar' ? 'لا توجد تسبائح' : 'No lessons'}</option>
                            )}
                          </select>
                          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-gold-500 shrink-0" />}
                        </div>
                        {alloc && (
                          <div className="mt-0.5 flex items-center gap-1.5 px-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                            <span className="text-[9px] text-gray-400 truncate max-w-[90px] leading-tight">
                              {alloc.lesson.titleCoptic || alloc.lesson.title}
                            </span>
                            <Badge variant={STATUS_BADGE[alloc.lesson.status] || 'default'} size="sm">
                              {alloc.lesson.status}
                            </Badge>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            }))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="lg:hidden space-y-4" aria-live="polite">
        {termWeeks.filter(w => w.isAvailable).map(week => displayLevels.map(level => (
          <MobileAllocationCard key={`${week.id}-${level.id}`} week={week} level={level} allocations={allocations} lessons={lessons} onSave={handleSave} saving={saving.size > 0} subjects={subjects} />
        )))}
      </div>
    </div>
  )
}

function Toolbar({ lang, selectedTerm, onTermChange, selectedAllocLevelId, onAllocLevelChange, sortedLevels, selectedYear, onClearAllocations }: {
  lang: string; selectedTerm: number; onTermChange: (t: number) => void;
  selectedAllocLevelId: string; onAllocLevelChange: (id: string) => void;
  sortedLevels: Level[]; selectedYear: string; onClearAllocations: (scope: 'all' | 'term' | 'level') => void;
}) {
  const [showClearConfirm, setShowClearConfirm] = useState<{ scope: 'all' | 'term' | 'level' } | null>(null)

  const handleClear = (scope: 'all' | 'term' | 'level') => {
    setShowClearConfirm({ scope })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'الفصل:' : 'Term:'}</span>
        {[1, 2, 3].map(t => (
          <button key={t} onClick={() => onTermChange(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              selectedTerm === t ? 'bg-blue-500 text-white border-gold-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 active:bg-gray-100'
            }`}>{TERM_SHORT[t]}</button>
        ))}
        <span className="ml-4 text-sm font-medium text-gray-700">{lang === 'ar' ? 'المستوى:' : 'Level:'}</span>
        <select value={selectedAllocLevelId} onChange={e => onAllocLevelChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">{lang === 'ar' ? 'جميع المستويات' : 'All Levels'}</option>
          {sortedLevels.map(l => <option key={l.id} value={l.id}>{lang === 'ar' ? 'المستوى' : 'Level'} {l.number}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => handleClear('term')} disabled={!selectedYear}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40">
            <Trash2 className="h-3 w-3" />{lang === 'ar' ? 'مسح الفصل' : 'Clear Term'}
          </button>
          <button onClick={() => handleClear('all')} disabled={!selectedYear}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40">
            <Trash2 className="h-3 w-3" />{lang === 'ar' ? 'مسح الكل' : 'Clear All'}
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowClearConfirm(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="clear-title">
            <h3 id="clear-title" className="text-lg font-semibold text-center text-gray-900">
              {lang === 'ar' ? 'مسح التوزيعات' : 'Clear Allocations'}
            </h3>
            <p className="mt-2 text-sm text-gray-500 text-center">
              {lang === 'ar' ? `حذف ${showClearConfirm.scope === 'all' ? 'جميع التوزيعات' : showClearConfirm.scope === 'term' ? `توزيعات الفصل ${selectedTerm}` : 'توزيعات المستوى المحدد'}؟ لا يمكن التراجع عن ذلك.` : `Delete ${showClearConfirm.scope === 'all' ? 'all allocations' : showClearConfirm.scope === 'term' ? `allocations for Term ${selectedTerm}` : 'allocations for the selected level'}? This cannot be undone.`}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={() => setShowClearConfirm(null)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100" autoFocus>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={() => { onClearAllocations(showClearConfirm.scope); setShowClearConfirm(null) }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700">
                {lang === 'ar' ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
