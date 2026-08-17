'use client'

import { useState, useMemo } from 'react'
import {
  ChevronRight, Loader2, Trash2, GripVertical, X, CalendarDays, Grid3x3,
} from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { API, TERM_SHORT, getSubjectStyle } from './constants'
import type { Allocation, Lesson, Level, Subject, AcademicWeek, SubjectItem } from './types'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import arLocale from '@fullcalendar/core/locales/ar'
import type { EventInput, EventDropArg, EventClickArg } from '@fullcalendar/core'

interface CalendarViewProps {
  allocations: Allocation[]
  lessons: Lesson[]
  teachingItems: SubjectItem[]
  levels: Level[]
  subjects: Subject[]
  weeks: AcademicWeek[]
  selectedYear: string
  onRefresh: () => Promise<void>
  onCreateAllocation: (data: {
    academicYearId: string; levelId: string; subjectId: string; lessonId: string;
    groupNumber?: number; term: number; weekNumber: number; orderIndex: number; scheduledDate: string; status: string;
  }) => Promise<boolean>
  onMoveAllocation: (id: string, data: {
    weekNumber: number; orderIndex: number; scheduledDate: string;
  }) => Promise<void>
  onDeleteAllocation: (id: string) => Promise<void>
  onClearAllocations: (scope: 'all' | 'term' | 'level') => void
  onCreateLesson: (data: Record<string, unknown>) => Promise<unknown>
}

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CalendarView({
  allocations, lessons, teachingItems, levels, subjects, weeks, selectedYear,
  onRefresh, onCreateAllocation, onMoveAllocation, onDeleteAllocation, onClearAllocations, onCreateLesson,
}: CalendarViewProps) {
  const lang = useLanguage()
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<'grid' | 'month'>('grid')
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [calendarSidebarLevel, setCalendarSidebarLevel] = useState('')
  const [draggedLesson, setDraggedLesson] = useState<Lesson | null>(null)
  const [draggedSubjectItem, setDraggedSubjectItem] = useState<SubjectItem | null>(null)
  const [draggedAllocation, setDraggedAllocation] = useState<Allocation | null>(null)
  const [creatingAllocation, setCreatingAllocation] = useState(false)
  const [moveModal, setMoveModal] = useState<{ allocation: Allocation; date: string } | null>(null)
  const [moveDate, setMoveDate] = useState('')
  const [deleteAllocTarget, setDeleteAllocTarget] = useState<Allocation | null>(null)
  const [selectedTerm, setSelectedTerm] = useState(1)
  const [selectedLevelId, setSelectedLevelId] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedGroup, setSelectedGroup] = useState<number>(1)

  const sortedLevels = [...levels].sort((a, b) => a.number - b.number)

  const unallocatedItems = useMemo(() => {
    const groupAllocLessonIds = new Set(
      allocations.filter(a => a.groupNumber === selectedGroup).map(a => a.lesson.id)
    )
    const allocatedItemIdsForGroup = new Set(
      lessons.filter(l => groupAllocLessonIds.has(l.id) && l.subjectItemId).map(l => l.subjectItemId!)
    )
    return teachingItems.filter(item => {
      if (calendarSidebarLevel) {
        const levelNum = Number(calendarSidebarLevel)
        if (!item.levels?.some(l => l.levelNumber === levelNum)) return false
      }
      if (selectedSubject !== 'all') {
        if (item.subject?.id !== selectedSubject && item.subjectId !== selectedSubject) return false
      }
      if (allocatedItemIdsForGroup.has(item.id)) return false
      return true
    })
  }, [teachingItems, lessons, allocations, calendarSidebarLevel, selectedSubject, selectedGroup])

  const lessonSessionsForGroup = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of teachingItems) {
      const sessions = selectedGroup === 1 ? item.sessionsGroup1
        : selectedGroup === 2 ? item.sessionsGroup2
        : selectedGroup === 3 ? item.sessionsGroup3
        : item.sessionsGroup4
      const relatedLesson = lessons.find(l => l.subjectItemId === item.id)
      if (relatedLesson && sessions) map.set(relatedLesson.id, sessions)
    }
    return map
  }, [teachingItems, lessons, selectedGroup])

  const termWeeks = useMemo(() =>
    weeks.filter(w => w.term === selectedTerm).sort((a, b) => a.weekNumber - b.weekNumber),
    [weeks, selectedTerm],
  )

  const subjectColumns = useMemo(() => selectedSubject === 'all' ? subjects : subjects.filter(s => s.id === selectedSubject), [subjects, selectedSubject])

  const getLevelNumber = () => {
    if (selectedLevelId) {
      const lvl = levels.find(l => l.id === selectedLevelId)
      return lvl?.number
    }
    return undefined
  }

  const levelNumber = getLevelNumber()

  const weekAllocations = useMemo(() => {
    const map = new Map<string, Map<string, Allocation[]>>()
    for (const week of termWeeks) {
      const weekKey = `W${week.weekNumber}`
      const subjectMap = new Map<string, Allocation[]>()
      for (const subj of subjectColumns) {
        subjectMap.set(subj.name, [])
      }
      for (const a of allocations) {
        const aGroup = a.groupNumber ?? 1
        if (aGroup !== selectedGroup) continue
        if (a.weekNumber === week.weekNumber && a.term === selectedTerm) {
          if (!levelNumber || a.level.number === levelNumber) {
            if (selectedSubject !== 'all') {
              const selSubj = subjects.find(s => s.id === selectedSubject)
              if (selSubj && a.subject.name !== selSubj.name) continue
            }
            const arr = subjectMap.get(a.subject.name)
            if (arr) arr.push(a)
          }
        }
      }
      map.set(weekKey, subjectMap)
    }
    return map
  }, [termWeeks, allocations, selectedTerm, subjectColumns, levelNumber, selectedSubject, selectedGroup])

  const handleDeleteAlloc = async (a: Allocation) => {
    try {
      await onDeleteAllocation(a.id)
      const lesson = lessons.find(l => l.id === a.lesson.id)
      if (lesson?.subjectItemId) {
        const sameLessonAllocs = allocations.filter(x =>
          x.lesson.id === a.lesson.id && x.id !== a.id
        )
        if (sameLessonAllocs.length === 0) {
          await fetch(`${API}/curriculum/items/${lesson.subjectItemId}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ status: 'pending' }),
          })
        }
      }
      await onRefresh()
    } catch { /* ignore */ }
  }

  const handleCalendarDrop = async (weekNumber: number, subjectName: string) => {
    if (!selectedYear) return
    const week = weeks.find(w => w.weekNumber === weekNumber && w.term === selectedTerm)
    if (!week || !week.isAvailable) return

    if (draggedAllocation) {
      const dateStr = week.startDate
      const existingAllocs = weekAllocations.get(`W${weekNumber}`)?.get(subjectName) || []
      const nextOrder = existingAllocs.length + 1
      await onMoveAllocation(draggedAllocation.id, {
        weekNumber, orderIndex: nextOrder, scheduledDate: dateStr,
      })
      setDraggedAllocation(null)
      return
    }

    const matchingSubject = subjects.find(s => s.name === subjectName)
    if (!matchingSubject) return

    const createAllocsForWeeks = async (
      lessonId: string,
      levelId: string,
      totalWeeks: number,
      subjectItemId?: string,
    ) => {
      let created = false
      for (let i = 0; i < totalWeeks; i++) {
        const wn = weekNumber + i
        const w = weeks.find(wk => wk.weekNumber === wn && wk.term === selectedTerm)
        if (!w || !w.isAvailable) continue
        const existingAlloc = allocations.find(a =>
          a.lesson.id === lessonId && a.weekNumber === wn &&
          a.term === selectedTerm && a.groupNumber === selectedGroup
        )
        if (existingAlloc) continue
        const dateStr = w.startDate
        const existingRowAllocs = weekAllocations.get(`W${wn}`)?.get(subjectName) || []
        const nextOrder = existingRowAllocs.length + 1
        await onCreateAllocation({
          academicYearId: selectedYear, levelId,
          subjectId: matchingSubject.id, lessonId,
          groupNumber: selectedGroup,
          term: selectedTerm, weekNumber: wn,
          orderIndex: nextOrder, scheduledDate: dateStr, status: 'published',
        })
        created = true
      }
      await onRefresh()
      if (subjectItemId && created) {
        try {
          await fetch(`${API}/curriculum/items/${subjectItemId}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ status: 'allocated' }),
          })
        } catch {
          /* item status flag is best-effort; refresh already happened */
        }
      }
    }

    if (draggedSubjectItem) {
      setCreatingAllocation(true)
      try {
        const item = draggedSubjectItem
        const itemLevel = item.levels?.[0]
        const level = itemLevel ? levels.find(l => l.number === itemLevel.levelNumber) : null
        const levelId = level?.id || ''
        const sessions = selectedGroup === 1 ? item.sessionsGroup1 : selectedGroup === 2 ? item.sessionsGroup2 : selectedGroup === 3 ? item.sessionsGroup3 : item.sessionsGroup4

        let lessonId: string
        const existingLesson = lessons.find(l => l.subjectItemId === item.id)
        if (existingLesson) {
          lessonId = existingLesson.id
        } else {
          const existingSubjLessons = lessons.filter(l => l.subject.name === subjectName)
          const maxOrder = existingSubjLessons.reduce((m, l) => Math.max(m, l.orderIndex), 0)
          const created = await onCreateLesson({
            title: item.name, titleAr: item.nameAr || '', titleCoptic: item.nameCoptic || '',
            levelId, subjectId: matchingSubject.id, subjectItemId: item.id,
            sessionsCount: sessions || 1, orderIndex: maxOrder + 1, status: 'published',
          }) as { id?: string; _id?: string }
          lessonId = created?.id || created?._id || ''
          if (!lessonId) throw new Error('Lesson creation did not return an id')
        }

        await createAllocsForWeeks(lessonId, levelId, sessions || 1, item.id)
      } catch (e: any) {
        toast('error', e?.message || (lang === 'ar' ? 'تعذر إنشاء التوزيع' : 'Could not create allocation'))
      } finally {
        setCreatingAllocation(false)
        setDraggedSubjectItem(null)
      }
      return
    }

    if (!draggedLesson) return
    if (matchingSubject?.name !== subjectName) return
    setCreatingAllocation(true)
    try {
      const levelId = levels.find(l => l.number === draggedLesson.level.number)?.id || ''
      const subjectItem = draggedLesson.subjectItemId
        ? teachingItems.find(t => t.id === draggedLesson.subjectItemId)
        : null
      const sessions = subjectItem
        ? selectedGroup === 1 ? subjectItem.sessionsGroup1
          : selectedGroup === 2 ? subjectItem.sessionsGroup2
          : selectedGroup === 3 ? subjectItem.sessionsGroup3
          : subjectItem.sessionsGroup4
        : draggedLesson.sessionsCount
      const totalWeeks = sessions || 1
      await createAllocsForWeeks(draggedLesson.id, levelId, totalWeeks, draggedLesson.subjectItemId)
    } catch { /* ignore */ }
    setCreatingAllocation(false)
    setDraggedLesson(null)
  }

  const getWeekNumberFromDate = (date: Date): number => {
    const dateStr = date.toISOString().split('T')[0]
    const match = weeks.find(w => dateStr >= w.startDate && dateStr <= w.endDate)
    return match?.weekNumber || 0
  }

  const handleMoveAllocation = async (allocId: string, dateStr: string) => {
    const dayAllocations = allocations.filter(a => a.scheduledDate?.startsWith(dateStr))
    const nextOrder = dayAllocations.length + 1
    const date = new Date(dateStr)
    await onMoveAllocation(allocId, {
      weekNumber: getWeekNumberFromDate(date), orderIndex: nextOrder, scheduledDate: dateStr,
    })
    setMoveModal(null)
  }

  const calendarEvents = useMemo<EventInput[]>(() => {
    return allocations
      .filter(a => (a.groupNumber ?? 1) === selectedGroup)
      .filter(a => !levelNumber || a.level.number === levelNumber)
      .filter(a => a.scheduledDate)
      .map(a => {
        const style = getSubjectStyle(a.subject.name)
        return {
          id: a.id,
          title: `L${a.level.number} · ${a.lesson.title}`,
          start: (a.scheduledDate as string).slice(0, 10),
          classNames: ['cohep-event', style.bg, style.text, style.border, style.dot ? '' : ''].filter(Boolean),
          extendedProps: { allocation: a },
        }
      })
  }, [allocations, selectedGroup, levelNumber])

  const handleCalendarEventDrop = async (info: EventDropArg) => {
    if (!info.event.start) { info.revert(); return }
    const dateStr = toISODate(info.event.start)
    try {
      const dayAllocations = allocations.filter(a => a.scheduledDate?.startsWith(dateStr))
      await onMoveAllocation(info.event.id, {
        weekNumber: getWeekNumberFromDate(new Date(dateStr)),
        orderIndex: dayAllocations.length + 1,
        scheduledDate: dateStr,
      })
      await onRefresh()
    } catch {
      info.revert()
    }
  }

  const handleCalendarEventClick = (info: EventClickArg) => {
    const a = (info.event.extendedProps?.allocation as Allocation) || undefined
    if (!a) return
    setMoveModal({ allocation: a, date: a.scheduledDate || '' })
    setMoveDate(a.scheduledDate || '')
  }

  const renderFullCalendar = () => {
    return (
      <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden min-h-[60vh] lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <select value={selectedLevelId} onChange={e => setSelectedLevelId(e.target.value)}
              aria-label={lang === 'ar' ? 'المستوى' : 'Level'}
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">{lang === 'ar' ? 'جميع المستويات' : 'All Levels'}</option>
              {sortedLevels.map(l => <option key={l.id} value={l.id}>{l.name} (L{l.number})</option>)}
            </select>
            <select value={selectedGroup} onChange={e => setSelectedGroup(Number(e.target.value))}
              aria-label={lang === 'ar' ? 'المجموعة' : 'Group'}
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              {[1, 2, 3, 4].map(g => (
                <option key={g} value={g}>{lang === 'ar' ? `المجموعة ${g}` : `Group ${g}`}</option>
              ))}
            </select>
            <span className="mx-1 text-xs text-gray-300">|</span>
            {[1, 2, 3].map(t => (
              <button key={t} onClick={() => jumpToTerm(t)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${selectedTerm === t ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-500 hover:bg-gray-100'}`}>
                {TERM_SHORT[t]}
              </button>
            ))}
          </div>
          <button onClick={() => setViewMode('grid')}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50">
            <Grid3x3 className="h-3 w-3" />{lang === 'ar' ? 'أسبوعي' : 'Weekly'}
          </button>
        </div>

        <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="cohep-calendar p-3 flex-1 overflow-auto">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={calendarMonth}
            editable
            selectable={false}
            dayMaxEvents={3}
            events={calendarEvents}
            eventDrop={handleCalendarEventDrop}
            eventClick={handleCalendarEventClick}
            locale={lang === 'ar' ? 'ar' : 'en-gb'}
            locales={[arLocale]}
            height="100%"
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit' }}
          />
        </div>
      </div>
    )
  }

  const jumpToTerm = (t: number) => {
    setSelectedTerm(t)
    const weeksInTerm = weeks.filter(w => w.term === t && w.isAvailable)
    if (weeksInTerm.length > 0) {
      const midWeek = weeksInTerm[Math.floor(weeksInTerm.length / 2)]
      setCalendarMonth(new Date(midWeek.startDate))
    }
  }

  const renderGrid = () => {
    return (
      <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden min-h-[60vh] lg:min-h-0">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <select value={selectedLevelId} onChange={e => setSelectedLevelId(e.target.value)}
              aria-label={lang === 'ar' ? 'المستوى' : 'Level'}
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">{lang === 'ar' ? 'جميع المستويات' : 'All Levels'}</option>
              {sortedLevels.map(l => <option key={l.id} value={l.id}>{l.name} (L{l.number})</option>)}
            </select>
            {!selectedLevelId && (
              <span className="text-[11px] text-gray-500 italic">{lang === 'ar' ? 'عرض جميع المستويات' : 'Showing all levels'}</span>
            )}
            <select value={selectedGroup} onChange={e => setSelectedGroup(Number(e.target.value))}
              aria-label={lang === 'ar' ? 'المجموعة' : 'Group'}
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              {[1, 2, 3, 4].map(g => (
                <option key={g} value={g}>{lang === 'ar' ? `المجموعة ${g}` : `Group ${g}`}</option>
              ))}
            </select>
            <span className="mx-1 text-xs text-gray-300">|</span>
            {[1, 2, 3].map(t => (
              <button key={t} onClick={() => jumpToTerm(t)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selectedTerm === t ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-500 hover:bg-gray-100'}`}>
                {TERM_SHORT[t]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onClearAllocations('all')} disabled={!selectedYear}
              className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
              <Trash2 className="h-3 w-3" />{lang === 'ar' ? 'مسح' : 'Clear'}
            </button>
            <button onClick={() => setViewMode('month')}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <CalendarDays className="h-3 w-3" />{lang === 'ar' ? 'شهري' : 'Month'}
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 z-10">
                <th className="bg-gray-50 border-b border-e border-gray-200 px-3 py-2.5 text-start text-xs font-semibold text-gray-600 min-w-[100px] sm:min-w-[150px]">
                  {lang === 'ar' ? 'الأسبوع' : 'Week'}
                </th>
                {subjectColumns.map(subj => {
                  const s = getSubjectStyle(subj.name)
                  return (
                    <th key={subj.id}
                      className={`bg-gray-50 border-b border-e border-gray-200 px-2 py-2.5 text-center text-xs font-semibold ${s.text} min-w-[100px] sm:min-w-[140px]`}>
                      <span className={`inline-flex items-center gap-1`}>
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        {subj.name}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {termWeeks.map(week => {
                const isInactive = !week.isAvailable
                const satDate = new Date(week.startDate)
                const sunDate = new Date(satDate)
                sunDate.setDate(satDate.getDate() + 1)
                const weekKey = `W${week.weekNumber}`
                const subjectAllocs = weekAllocations.get(weekKey)

                return (
                  <tr key={week.id}
                    className={`${isInactive ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50/50'} border-b border-gray-100 transition-colors`}>
                    <td className={`px-3 py-3 border-e border-gray-100 align-top ${isInactive ? 'text-gray-400' : 'text-gray-700'}`}>
                      <div className="text-sm font-semibold">W{week.weekNumber}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {lang === 'ar' ? 'سبت' : 'Sat'}: {formatDate(satDate)}
                        {' | '}
                        {lang === 'ar' ? 'أحد' : 'Sun'}: {formatDate(sunDate)}
                      </div>
                      {isInactive && (
                        <span className="inline-block mt-1 text-[11px] text-gray-500 italic">
                          {lang === 'ar' ? 'غير نشط' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    {subjectColumns.map(subj => {
                      const allocs = subjectAllocs?.get(subj.name) || []
                      return (
                        <td key={`${week.id}-${subj.id}`}
                           className={`px-2 py-1.5 border-e border-gray-100 align-top ${isInactive ? '' : ''}`}
                          onDragOver={e => { if (!isInactive) { e.preventDefault() } }}
                          onDrop={e => { e.preventDefault(); if (!isInactive) handleCalendarDrop(week.weekNumber, subj.name) }}
                          style={isInactive ? { background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.02) 4px, rgba(0,0,0,0.02) 8px)' } : {}}
                        >
                          {allocs.length > 0 ? allocs.sort((a, b) => a.orderIndex - b.orderIndex).map(a => {
                            const style = getSubjectStyle(a.subject.name)
                            const spanWeeks = lessonSessionsForGroup.get(a.lesson.id) || a.lesson.sessionsCount || 1
                            return (
                              <div key={a.id} draggable
                                onDragStart={() => setDraggedAllocation(a)}
                                onDragEnd={() => setDraggedAllocation(null)}
                                className={`group text-[11px] px-2 py-1.5 rounded-lg mb-1 cursor-grab active:cursor-grabbing border transition-all ${
                                  style.bg} ${style.text} ${style.border} ${
                                  draggedAllocation?.id === a.id ? 'opacity-50 ring-2 ring-gold-400' : ''
                                } ${spanWeeks > 1 ? 'shadow-sm' : ''}`}
                                style={spanWeeks > 1 ? { borderLeftWidth: '3px' } : {}}
                                title={`${a.lesson.title} - L${a.level.number}`}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot} flex-shrink-0`} />
                                  <span className="font-medium">L{a.level.number}</span>
                                  <span className="truncate flex-1 min-w-0">{a.lesson.title}</span>
                                  {spanWeeks > 1 && (
                                    <span className="text-[11px] opacity-60 flex-shrink-0">{spanWeeks}{lang === 'ar' ? 'ج' : 'w'}</span>
                                  )}
                                  <button onClick={e => { e.stopPropagation(); setMoveModal({ allocation: a, date: a.scheduledDate || '' }); setMoveDate(a.scheduledDate || '') }}
                                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/10 rounded transition-opacity ms-auto"
                                    style={{ minWidth: '20px', minHeight: '20px' }}
                                    aria-label={lang === 'ar' ? 'نقل' : 'Move'}>
                                    <ChevronRight className="h-3 w-3 rotate-90" />
                                  </button>
                                  <button onClick={e => { e.stopPropagation(); setDeleteAllocTarget(a) }}
                                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/10 rounded transition-opacity"
                                    style={{ minWidth: '20px', minHeight: '20px' }}
                                    aria-label={lang === 'ar' ? 'إلغاء' : 'Unallocate'}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )
                          }) : (
                            <div className={`min-h-[32px] rounded border-2 border-dashed transition-colors ${
                              isInactive ? 'border-gray-100' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                            }`}
                              onDragOver={e => { if (!isInactive) { e.preventDefault() } }}
                              onDrop={e => { e.preventDefault(); if (!isInactive) handleCalendarDrop(week.weekNumber, subj.name) }}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  

  return (
    <div role="tabpanel" id="panel-calendar" aria-labelledby="tab-calendar" className="flex flex-col gap-4 lg:h-[calc(100vh-260px)] lg:flex-row">
      {/* Sidebar — Unallocated Hymns */}
      <div className="w-full max-h-[18rem] flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden lg:w-72 lg:max-h-none">
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <h3 className="font-semibold text-gray-900 text-sm">{lang === 'ar' ? 'العناصر غير الموزعة' : 'Unallocated Items'}</h3>
          <select value={calendarSidebarLevel} onChange={e => setCalendarSidebarLevel(e.target.value)}
            aria-label={lang === 'ar' ? 'المستوى' : 'Level'}
            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:ring-1 focus:ring-blue-500 focus:outline-none">
            <option value="">{lang === 'ar' ? 'جميع المستويات' : 'All Levels'}</option>
            {levels.map(l => <option key={l.id} value={l.number.toString()}>{lang === 'ar' ? 'المستوى' : 'Level'} {l.number} - {l.name}</option>)}
          </select>
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
            aria-label={lang === 'ar' ? 'المادة' : 'Subject'}
            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:ring-1 focus:ring-blue-500 focus:outline-none">
            <option value="all">{lang === 'ar' ? 'جميع المواد' : 'All Subjects'}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{lang === 'ar' ? (s.nameAr || s.name) : s.name}</option>
            ))}
          </select>
          <select value={selectedGroup} onChange={e => setSelectedGroup(Number(e.target.value))}
            aria-label={lang === 'ar' ? 'المجموعة' : 'Group'}
            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:ring-1 focus:ring-blue-500 focus:outline-none">
            {[1, 2, 3, 4].map(g => (
              <option key={g} value={g}>{lang === 'ar' ? `المجموعة ${g}` : `Group ${g}`}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {creatingAllocation && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-blue-700 bg-blue-50 rounded-lg mb-2">
              <Loader2 className="h-3 w-3 animate-spin" /> {lang === 'ar' ? 'جارٍ إنشاء التوزيع...' : 'Creating allocation…'}
            </div>
          )}
          {unallocatedItems.length === 0 ? (
            <div className="text-center text-xs text-gray-500 py-8">{lang === 'ar' ? 'جميع العناصر موزعة' : 'All items are allocated'}</div>
          ) : (
            unallocatedItems.map(item => {
              const relatedLesson = lessons.find(l => l.subjectItemId === item.id)
              const subjName = item.subject?.name || ''
              const style = subjName ? getSubjectStyle(subjName) : { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400', label: 'Item' }
              return (
                <div key={item.id} draggable
                  onDragStart={() => {
                    if (relatedLesson) setDraggedLesson(relatedLesson)
                    else setDraggedSubjectItem(item)
                  }}
                  onDragEnd={() => { setDraggedLesson(null); setDraggedSubjectItem(null) }}
                  className={`group flex items-start gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing text-xs transition-all ${
                    !relatedLesson ? 'opacity-60' :
                    draggedLesson?.id === relatedLesson.id
                      ? 'bg-blue-50 border-blue-300 shadow-md opacity-70'
                      : 'bg-gray-50 border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
                  }`}
                  title={`${item.name} - ${lang === 'ar' ? 'اسحب إلى التقويم' : 'drag to calendar'}`}>
                  <GripVertical className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${relatedLesson ? 'text-gray-300 group-hover:text-gold-400' : 'text-gray-200'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-medium text-[11px] ${style.bg} ${style.text} border ${style.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ms-0.5`} />
                        {subjName || 'Item'}
                      </span>
                      {item.levels?.map(l => (
                        <span key={l.levelNumber} className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700 text-[11px]">L{l.levelNumber}</span>
                      ))}
                      <span className="truncate font-medium text-gray-800 text-[11px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                      {item.whenLabel && <span>{item.whenLabel}</span>}
                      {(() => {
                        const sessions = selectedGroup === 1 ? item.sessionsGroup1 : selectedGroup === 2 ? item.sessionsGroup2 : selectedGroup === 3 ? item.sessionsGroup3 : item.sessionsGroup4
                        return sessions ? <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{sessions} {lang === 'ar' ? 'ج' : 'sessions'}</span> : null
                      })()}
                      {!relatedLesson && <span className="text-amber-600">{lang === 'ar' ? 'بدون درس' : 'no lesson'}</span>}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500">
          {unallocatedItems.length} {lang === 'ar' ? 'عنصر متاح' : 'item(s) available'}
        </div>
      </div>

      {termWeeks.length === 0 ? (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center gap-3 px-6 py-16 text-center min-h-[60vh] lg:min-h-0">
          <div className="rounded-full bg-gray-100 p-3">
            <CalendarDays className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {lang === 'ar' ? `لا توجد أسابيع للفصل ${selectedTerm} في هذه السنة الدراسية` : `No weeks for Term ${selectedTerm} in this academic year`}
          </p>
          <p className="text-xs text-gray-500 max-w-sm">
            {lang === 'ar' ? 'أنشئ أسابيع العطلة من الإعدادات ← التقويم ثم عد هنا للتوزيع.' : 'Generate the weekend weeks from Settings → Calendar, then return here to allocate.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? renderGrid() : renderFullCalendar()}

      <Modal open={!!moveModal} onClose={() => setMoveModal(null)}
        title={lang === 'ar' ? 'نقل التوزيع' : 'Move Allocation'} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {lang === 'ar' ? 'اختر تاريخاً جديداً للتوزيع.' : 'Choose a new date for this allocation.'}
          </p>
          <div>
            <label htmlFor="move-date" className="block text-xs font-medium text-gray-500 mb-1">
              {lang === 'ar' ? 'التاريخ' : 'Date'}
            </label>
            <DatePicker id="move-date" value={moveDate} onChange={setMoveDate} />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button onClick={() => setMoveModal(null)}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100">
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={() => moveModal && handleMoveAllocation(moveModal.allocation.id, moveDate)}
            disabled={!moveDate}
            className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
            {lang === 'ar' ? 'نقل' : 'Move'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteAllocTarget}
        onClose={() => setDeleteAllocTarget(null)}
        onConfirm={() => { if (deleteAllocTarget) { handleDeleteAlloc(deleteAllocTarget); setDeleteAllocTarget(null) } }}
        title={lang === 'ar' ? 'إلغاء التوزيع' : 'Remove Allocation'}
        message={deleteAllocTarget ? (lang === 'ar' ? `إزالة التوزيع "${deleteAllocTarget.lesson.title}"؟ لا يمكن التراجع عن ذلك.` : `Remove allocation for "${deleteAllocTarget.lesson.title}"? This cannot be undone.`) : ''}
        confirmLabel={lang === 'ar' ? 'إزالة' : 'Remove'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
      />
    </div>
  )
}
