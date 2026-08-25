'use client'

import { useState, useMemo, useEffect } from 'react'
import { Play, BookOpen, Languages, CheckCircle2, Circle, Clock, CalendarCheck, BarChart3, Filter, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { EmptyState } from '@/components/ui/empty-state'
import { PresentationViewer } from './presentation-viewer'
import { API, normalizeItemStatus, getSubjectStyle } from './constants'
import { useUpdateItemStatusMutation } from './hooks'
import type { SubjectItem, ItemStatus, Allocation, Lesson } from './types'

const WHEN_COLORS: Record<string, { bg: string; text: string }> = {
  'Vespers/Matins': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  'Liturgy': { bg: 'bg-amber-100', text: 'text-amber-800' },
  'Prasies': { bg: 'bg-orange-100', text: 'text-orange-800' },
  'Seasonal': { bg: 'bg-sky-100', text: 'text-sky-800' },
  'Holy Week & Holy 50 days': { bg: 'bg-rose-100', text: 'text-rose-800' },
  'Glorifications': { bg: 'bg-purple-100', text: 'text-purple-800' },
  'Deacon Responses': { bg: 'bg-gray-100', text: 'text-gray-700' },
}

const STATUS_META: Record<ItemStatus, { icon: typeof Circle; label: string; labelAr: string; color: string; bg: string; border: string }> = {
  pending: { icon: Circle, label: 'Pending', labelAr: 'معلق', color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' },
  allocated: { icon: CalendarCheck, label: 'Allocated', labelAr: 'مخصص', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300' },
  in_progress: { icon: Clock, label: 'In Progress', labelAr: 'قيد التنفيذ', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300' },
  completed: { icon: CheckCircle2, label: 'Completed', labelAr: 'مكتمل', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-300' },
}

const STATUS_ORDER: ItemStatus[] = ['pending', 'allocated', 'in_progress', 'completed']

const STATUS_CARD: Record<string, { label: string; labelAr: string; color: string; bg: string; icon: typeof Circle }> = {
  all: { label: 'Total', labelAr: 'الإجمالي', color: 'text-gray-900', bg: 'bg-white', icon: BookOpen },
  pending: { label: 'Pending', labelAr: 'معلق', color: 'text-gray-600', bg: 'bg-gray-100', icon: Circle },
  allocated: { label: 'Allocated', labelAr: 'مخصص', color: 'text-blue-700', bg: 'bg-blue-100', icon: CalendarCheck },
  in_progress: { label: 'In Progress', labelAr: 'قيد التنفيذ', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
  completed: { label: 'Completed', labelAr: 'مكتمل', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
}

interface TeachingViewProps {
  items: SubjectItem[]
  subjects: Array<{ id: string; name: string; nameAr?: string; nameCoptic?: string; color?: string }>
  levels: Array<{ id: string; number: number; name: string }>
  lessons?: Lesson[]
  allocations?: Allocation[]
  levelNumber: number
  onLevelChange: (n: number) => void
  groupOptions: Array<{ id: string; groupNumber: number; label: string; labelAr: string }>
}

function useMyLevel(levels: Array<{ number: number }>): number | null {
  const [myLevel, setMyLevel] = useState<number | null>(null)

  useEffect(() => {
    fetch(`${API}/dashboard/mine?schoolId=${getSchoolId()}`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: any) => {
        const groups: Array<{ levelNumber?: number }> = d?.groups || []
        const first = groups.find(g => g.levelNumber != null)
        if (first?.levelNumber != null) setMyLevel(first.levelNumber)
      })
      .catch(() => {})
  }, [])

  return myLevel
}

function getSchoolId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const stored = localStorage.getItem('niangelos_active_school')
    if (stored) return stored
    const user = localStorage.getItem('user')
    if (user) {
      const parsed = JSON.parse(user)
      if (parsed.schoolId) return parsed.schoolId
    }
  } catch {}
  return ''
}

export function TeachingView({ items, subjects, levels, lessons = [], allocations = [], levelNumber, onLevelChange, groupOptions }: TeachingViewProps) {
  const lang = useLanguage()
  const [showSubject, setShowSubject] = useState<string>('all')
  const [selectedGroup, setSelectedGroup] = useState<number>(1)
  const [presentItem, setPresentItem] = useState<SubjectItem | null>(null)
  const [hideCompleted, setHideCompleted] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | ItemStatus>('all')
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())
  const myLevel = useMyLevel(levels)
  const { toast } = useToast()
  const updateStatus = useUpdateItemStatusMutation()

  useEffect(() => {
    if (myLevel != null && levelNumber !== myLevel) {
      onLevelChange(myLevel)
    }
  }, [myLevel])

  const allocatedItemIds = useMemo(() => {
    const groupAllocLessonIds = new Set(
      allocations.filter(a => a.groupNumber === selectedGroup).map(a => a.lesson.id)
    )
    const result = new Set<string>()
    for (const item of items) {
      const hasAlloc = lessons.some(l =>
        l.subjectItemId === item.id && groupAllocLessonIds.has(l.id)
      )
      if (hasAlloc) result.add(item.id)
    }
    return result
  }, [allocations, selectedGroup, items, lessons])

  const visibleItems = useMemo(() => {
    let filtered = items.filter(i => i.active !== false)
    // Only show items that have an allocation for the selected group
    filtered = filtered.filter(i => allocatedItemIds.has(i.id))
    if (hideCompleted) filtered = filtered.filter(i => i.status !== 'completed')
    if (statusFilter !== 'all') {
      if (statusFilter === 'allocated') {
        // Already filtered to allocated above
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(i => i.status !== 'in_progress' && i.status !== 'completed')
      } else {
        filtered = filtered.filter(i => i.status === statusFilter)
      }
    }
    return filtered
  }, [items, hideCompleted, statusFilter, allocatedItemIds])

  const grouped = useMemo(() => {
    const map = new Map<string, SubjectItem[]>()
    for (const item of visibleItems) {
      const key = item.subject?.id || item.subjectId || 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [visibleItems])

  const filteredSubjects = showSubject === 'all'
    ? Object.fromEntries(grouped)
    : grouped.has(showSubject)
      ? { [showSubject]: grouped.get(showSubject)! }
      : {}

  const subjectMeta = useMemo(() => {
    const map = new Map(subjects.map(s => [s.id, s]))
    return map
  }, [subjects])

  const stats = useMemo(() => {
    const total = items.length
    const allocated = items.filter(i => allocatedItemIds.has(i.id)).length
    const inProgress = items.filter(i => i.status === 'in_progress').length
    const completed = items.filter(i => i.status === 'completed').length
    const pending = total - allocated - inProgress - completed
    const pct = total ? Math.round((completed / total) * 100) : 0
    return { total, allocated, inProgress, completed, pending, pct }
  }, [items, allocatedItemIds])

  const nextStatus = (s?: string): ItemStatus => {
    if (s === 'pending' || !s) return 'allocated'
    if (s === 'allocated') return 'in_progress'
    if (s === 'in_progress') return 'completed'
    return 'pending'
  }

  const handleToggleStatus = (item: SubjectItem) => {
    const next = nextStatus(item.status)
    updateStatus.mutate({ id: item.id, status: next })
  }

  const toggleSubjectCollapse = (subjectId: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(subjectId)) next.delete(subjectId)
      else next.add(subjectId)
      return next
    })
  }

  if (presentItem) {
    return (
      <PresentationViewer
        data={{ format: 'both', verses: [], speaker: '' }}
        title={presentItem.name}
        titleCoptic={presentItem.nameCoptic}
        titleAr={presentItem.nameAr}
        hazzat={presentItem.hazzat}
        presentationUrl={presentItem.presentationUrl}
        onExit={() => setPresentItem(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── Summary Widgets ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['all', 'pending', 'allocated', 'in_progress', 'completed'] as const).map(key => {
          const meta = STATUS_CARD[key]
          const count = key === 'all' ? stats.total : key === 'pending' ? stats.pending : key === 'allocated' ? stats.allocated : key === 'in_progress' ? stats.inProgress : stats.completed
          const Icon = meta.icon
          const isActive = key === 'all' ? statusFilter === 'all' : statusFilter === key
          return (
            <button key={key} onClick={() => setStatusFilter(key === statusFilter ? 'all' : key)}
              className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-md ${isActive ? 'ring-2 ring-blue-500 border-gold-500' : 'border-gray-200 ' + meta.bg}`}>
              <div className="flex items-center justify-between">
                <Icon className={`h-5 w-5 ${meta.color}`} />
                {key === 'completed' && stats.total > 0 && (
                  <span className={`text-xs font-semibold ${meta.color}`}>{stats.pct}%</span>
                )}
              </div>
              <p className={`text-2xl font-bold mt-2 ${meta.color}`}>{count}</p>
              <p className={`text-xs font-medium mt-0.5 ${meta.color}`}>
                {lang === 'ar' ? meta.labelAr : meta.label}
              </p>
              {key === 'completed' && stats.total > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.pct}%` }} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={levelNumber} onChange={e => onLevelChange(Number(e.target.value))}
          aria-label={lang === 'ar' ? 'المستوى' : 'Level'}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          {[...levels].sort((a, b) => a.number - b.number).map(l => (
            <option key={l.id} value={l.number}>{lang === 'ar' ? `المستوى ${l.number} - ${l.name}` : `${l.name} (Level ${l.number})`}</option>
          ))}
        </select>
        <select value={selectedGroup} onChange={e => setSelectedGroup(Number(e.target.value))}
          aria-label={lang === 'ar' ? 'المجموعة' : 'Group'}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          {groupOptions.map(o => (
            <option key={o.id} value={o.groupNumber}>{lang === 'ar' ? o.labelAr : o.label}</option>
          ))}
        </select>
        <select value={showSubject} onChange={e => setShowSubject(e.target.value)}
          aria-label={lang === 'ar' ? 'المادة' : 'Subject'}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="all">{lang === 'ar' ? 'جميع المواد' : 'All Subjects'}</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{lang === 'ar' ? (s.nameAr || s.name) : s.name}</option>
          ))}
        </select>
        <button onClick={() => setHideCompleted(!hideCompleted)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${hideCompleted ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          {hideCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {hideCompleted
            ? (lang === 'ar' ? 'إظهار المكتمل' : 'Show Completed')
            : (lang === 'ar' ? 'إخفاء المكتمل' : 'Hide Completed')}
        </button>
      </div>

      {/* ─── Items Grid — collapsible by subject ─── */}
      {Object.entries(filteredSubjects).map(([subjectId, subjectItems]) => {
        const meta = subjectMeta.get(subjectId)
        const isCollapsed = !expandedSubjects.has(subjectId)
        const completedCount = subjectItems.filter(i => i.status === 'completed').length
        const progressPct = subjectItems.length > 0 ? Math.round((completedCount / subjectItems.length) * 100) : 0
        return (
          <div key={subjectId} className={`rounded-2xl border overflow-hidden transition-all ${isCollapsed ? 'border-gray-200 bg-white' : 'border-gray-200 bg-white shadow-sm'}`}>
            {/* Subject header — clickable to collapse */}
            <button onClick={() => toggleSubjectCollapse(subjectId)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: meta?.color ? `${meta.color}15` : '#f3f4f6' }}>
                {(() => { const ss = getSubjectStyle(meta?.name || ''); return <ss.icon className="h-5 w-5" style={{ color: meta?.color || '#6b7280' }} />; })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{lang === 'ar' ? (meta?.nameAr || meta?.name || 'Subject') : (meta?.name || 'Subject')}</h3>
                  <span className="text-[11px] text-gray-400">{subjectItems.length} {lang === 'ar' ? 'عناصر' : 'items'}</span>
                </div>
                {/* Mini progress bar */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 tabular-nums">{completedCount}/{subjectItems.length}</span>
                </div>
              </div>
              <div className="shrink-0 text-gray-400">
                {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </button>
            {/* Collapsible body */}
            {!isCollapsed && (
              <div className="border-t border-gray-100 px-5 py-3 space-y-2">
                {subjectItems.map(item => {
                  const sm = STATUS_META[normalizeItemStatus(item.status)]
                  const sessions = selectedGroup === 1 ? item.sessionsGroup1 : selectedGroup === 2 ? item.sessionsGroup2 : selectedGroup === 3 ? item.sessionsGroup3 : item.sessionsGroup4
                  const isCompleted = item.status === 'completed'
                  return (
                    <div key={item.id}
                      className={`rounded-xl border p-3.5 transition-all hover:shadow-sm ${sm.bg} ${sm.border} ${isCompleted ? 'opacity-75' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <select value={normalizeItemStatus(item.status)} onChange={e => {
                              updateStatus.mutate({ id: item.id, status: e.target.value }, {
                                onError: () => toast('error', lang === 'ar' ? 'فشل تحديث الحالة' : 'Failed to update status'),
                                onSuccess: () => toast('success', lang === 'ar' ? 'تم تحديث الحالة' : 'Status updated'),
                              })
                            }}
                              onClick={e => e.stopPropagation()}
                              aria-label={lang === 'ar' ? 'حالة العنصر' : 'Item status'}
                              className={`text-[11px] font-medium rounded-md border px-1.5 py-0.5 ${sm.bg} ${sm.color} ${sm.border} focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer`}>
                              {STATUS_ORDER.map(st => {
                                const m = STATUS_META[st]
                                return <option key={st} value={st}>{lang === 'ar' ? m.labelAr : m.label}</option>
                              })}
                            </select>
                            <p className={`font-medium truncate coptic-text ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>{item.name}</p>
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">{lang === 'ar' ? 'مخصص' : 'Alloc'} G{selectedGroup} ✓</span>
                          </div>
                          {item.whenLabel && (
                            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${(WHEN_COLORS[item.whenLabel] || { bg: 'bg-amber-50', text: 'text-amber-700' }).bg} ${(WHEN_COLORS[item.whenLabel] || { bg: 'bg-amber-50', text: 'text-amber-700' }).text}`}>{item.whenLabel}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {sessions ? <span className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{sessions} {lang === 'ar' ? 'جلسات' : 's'}</span> : null}
                          {(item.presentationData || item.presentationUrl || item.hazzat) && (
                            <button onClick={() => setPresentItem(item)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-950 transition-colors bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-600 focus-visible:ring-offset-2">
                              <Play className="h-3 w-3" />{lang === 'ar' ? 'عرض' : 'Present'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {Object.keys(filteredSubjects).length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
          <BookOpen className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">
            {lang === 'ar' ? 'لا توجد عناصر مخصصة لهذه المجموعة' : 'No allocated items for this group'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {lang === 'ar' ? 'قم بتخصيص دروس في تبويب "توزيع السنة والفصل" أولاً' : 'Allocate lessons in the "Year & Term Allocation" tab first'}
          </p>
        </div>
      )}
    </div>
  )
}
