'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, AlertTriangle, CalendarPlus } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormField } from '@/components/ui/form-field'
import { DatePicker } from '@/components/ui/date-picker'
import { useLanguage } from '@/lib/use-language'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'

const TERM_COLORS: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  3: 'bg-amber-50 text-amber-700 border-amber-200',
}
const TERM_LABELS: Record<number, string> = {
  1: 'Term 1 (Sep — Dec)',
  2: 'Term 2 (Jan — Mar)',
  3: 'Term 3 (Apr — Jun)',
}

interface AcademicYear {
  id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; activeDays?: number[]
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LABELS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
interface AcademicWeek {
  id: string; weekNumber: number; term: number; startDate: string; endDate: string;
  isAvailable: boolean; label?: string; reason?: string; status?: string
}

const WEEK_STATUS_OPTIONS = [
  { value: 'available', label: 'Available for Allocation', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'feast_off', label: 'Feast (Off)', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'revision', label: 'Revision', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'event', label: 'Event/Convention', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200' },
]

interface CalendarEvent {
  id: string; date: string; label: string; type: string; description?: string
}

const EVENT_TYPE_OPTIONS = [
  { value: 'event', label: 'Event', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'session', label: 'Extra Session', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'holiday', label: 'Holiday', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'trip', label: 'Trip', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'exam', label: 'Exam', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700 border-gray-200' },
]

export function CalendarTab() {
  const lang = useLanguage()
  const [years, setYears] = useState<AcademicYear[]>([])
  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [weeks, setWeeks] = useState<AcademicWeek[]>([])
  const [loadingWeeks, setLoadingWeeks] = useState(false)

  const [showYearForm, setShowYearForm] = useState(false)
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null)
  const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false })
  const [savingYear, setSavingYear] = useState(false)

  const [showYearDelete, setShowYearDelete] = useState(false)
  const [deletingYear, setDeletingYear] = useState<AcademicYear | null>(null)

  const [editingWeek, setEditingWeek] = useState<AcademicWeek | null>(null)
  const [weekForm, setWeekForm] = useState({ isAvailable: true, label: '', reason: '', status: 'available' })
  const [savingWeek, setSavingWeek] = useState(false)

  const [expandedTerm, setExpandedTerm] = useState<number | null>(1)
  const [calendarSaved, setCalendarSaved] = useState(false)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [eventForm, setEventForm] = useState({ date: '', label: '', type: 'event', description: '' })
  const [savingEvent, setSavingEvent] = useState(false)
  const [showDeleteEvent, setShowDeleteEvent] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null)

  const fetchYears = async () => {
    try {
      const data = await http.get<AcademicYear[]>(`/curriculum/academic-years`, { schoolId: getSchoolId() })
      setYears(Array.isArray(data) ? data : [])
      if (data.length > 0 && !selectedYearId) {
        const current = data.find((y: AcademicYear) => y.isCurrent) || data[0]
        setSelectedYearId(current.id)
      }
    } catch (e) { console.error(e) }
  }

  const fetchWeeks = async (yearId: string) => {
    setLoadingWeeks(true)
    try {
      const data = await http.get<AcademicWeek[]>(`/curriculum/weeks`, { schoolId: getSchoolId(), academicYearId: yearId })
      setWeeks(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoadingWeeks(false)
  }

  useEffect(() => { fetchYears() }, [])
  useEffect(() => { if (selectedYearId) { fetchWeeks(selectedYearId); fetchEvents(selectedYearId) } }, [selectedYearId])

  const openCreateYear = () => {
    setEditingYear(null)
    const now = new Date()
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
    setYearForm({ name: `${startYear}-${startYear + 1}`, startDate: `${startYear}-09-01`, endDate: `${startYear + 1}-06-30`, isCurrent: false })
    setShowYearForm(true)
  }

  const openEditYear = (y: AcademicYear) => {
    setEditingYear(y)
    setYearForm({ name: y.name, startDate: y.startDate?.split('T')[0] || '', endDate: y.endDate?.split('T')[0] || '', isCurrent: y.isCurrent })
    setShowYearForm(true)
  }

  const handleSaveYear = async () => {
    if (!yearForm.name.trim() || !yearForm.startDate || !yearForm.endDate) return
    setSavingYear(true)
    try {
      const params = { schoolId: getSchoolId() }
      if (editingYear) {
        await http.put(`/curriculum/academic-years/${editingYear.id}`, yearForm, params)
      } else {
        await http.post('/curriculum/academic-years', yearForm, params)
      }
      setShowYearForm(false)
      await fetchYears()
    } catch (e) { console.error(e) }
    setSavingYear(false)
  }

  const handleDeleteYear = async () => {
    if (!deletingYear) return
    try {
      await http.delete(`/curriculum/academic-years/${deletingYear.id}`)
      setShowYearDelete(false)
      if (selectedYearId === deletingYear.id) setSelectedYearId('')
      await fetchYears()
    } catch (e) { console.error(e) }
  }

  const handleToggleWeek = async (week: AcademicWeek, newStatus?: string) => {
    const status = newStatus || week.status || (week.isAvailable ? 'available' : 'feast_off')
    const isAvailable = status === 'available' || status === 'revision'
    try {
      await http.put(`/curriculum/weeks/${week.id}`, { isAvailable, status })
      setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, isAvailable, status } : w))
    } catch (e) { console.error(e) }
  }

  const openEditWeek = (week: AcademicWeek) => {
    setEditingWeek(week)
    setWeekForm({
      isAvailable: week.isAvailable,
      label: week.label || '',
      reason: week.reason || '',
      status: week.status || (week.isAvailable ? 'available' : 'feast_off'),
    })
  }

  const handleSaveWeek = async () => {
    if (!editingWeek) return
    setSavingWeek(true)
    try {
      await http.put(`/curriculum/weeks/${editingWeek.id}`, weekForm)
      setWeeks(prev => prev.map(w => w.id === editingWeek.id ? { ...w, ...weekForm } : w))
      setEditingWeek(null)
    } catch (e) { console.error(e) }
    setSavingWeek(false)
  }

  const handleBulkWeekUpdate = async (isAvailable: boolean) => {
    if (!selectedYearId || weeks.length === 0) return
    try {
      await http.post('/curriculum/weeks/bulk-update', { weeks: weeks.map(w => ({ id: w.id, isAvailable })) })
      setWeeks(prev => prev.map(w => ({ ...w, isAvailable })))
      setCalendarSaved(true)
      setTimeout(() => setCalendarSaved(false), 2000)
    } catch (e) { console.error(e) }
  }

  const fetchEvents = async (yearId: string) => {
    setLoadingEvents(true)
    try {
      const data = await http.get<CalendarEvent[]>(`/curriculum/calendar-events`, { schoolId: getSchoolId(), academicYearId: yearId })
      setEvents(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoadingEvents(false)
  }

  const openCreateEvent = () => {
    setEditingEvent(null)
    setEventForm({ date: '', label: '', type: 'event', description: '' })
    setShowEventForm(true)
  }

  const openEditEvent = (ev: CalendarEvent) => {
    setEditingEvent(ev)
    setEventForm({ date: ev.date?.split('T')[0] || '', label: ev.label, type: ev.type, description: ev.description || '' })
    setShowEventForm(true)
  }

  const handleSaveEvent = async () => {
    if (!eventForm.date || !eventForm.label.trim() || !selectedYearId) return
    setSavingEvent(true)
    try {
      const params = { schoolId: getSchoolId() }
      const body = { ...eventForm, academicYearId: selectedYearId }
      if (editingEvent) {
        await http.put(`/curriculum/calendar-events/${editingEvent.id}`, body, params)
      } else {
        await http.post('/curriculum/calendar-events', body, params)
      }
      setShowEventForm(false)
      fetchEvents(selectedYearId)
    } catch (e) { console.error(e) }
    setSavingEvent(false)
  }

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return
    try {
      await http.delete(`/curriculum/calendar-events/${deletingEvent.id}`)
      setShowDeleteEvent(false); setDeletingEvent(null)
      if (selectedYearId) fetchEvents(selectedYearId)
    } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-6">
      {/* Academic Years Card */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'السنوات الدراسية' : 'Academic Years'}</h2>
            <p className="text-sm text-gray-500">{lang === 'ar' ? 'إدارة السنوات الدراسية وتحديد السنة الحالية' : 'Manage academic years and set the current year'}</p>
          </div>
          <Button onClick={openCreateYear} aria-label={lang === 'ar' ? 'إضافة سنة دراسية' : 'Add academic year'} size="sm">
            <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة سنة' : 'Add Year'}
          </Button>
        </div>
        <div className="divide-y divide-gray-100">
          {years.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لا توجد سنوات دراسية. أنشئ سنة للبدء.' : 'No academic years. Create one to get started.'}</div>
          ) : years.map((year: AcademicYear) => (
            <div key={year.id}
              className={`px-6 py-3.5 flex items-center justify-between cursor-pointer transition-colors ${selectedYearId === year.id ? 'bg-blue-50/50' : 'hover:bg-gray-50 active:bg-gray-100'}`}
              onClick={() => setSelectedYearId(year.id)}>
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${year.isCurrent ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div>
                  <span className="text-sm font-medium text-gray-900">{year.name}</span>
                  {year.isCurrent && <span className="ml-2 text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{lang === 'ar' ? 'الحالي' : 'Current'}</span>}
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(year.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {' — '}
                    {new Date(year.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" onClick={() => openEditYear(year)} aria-label={`Edit ${year.name}`} title="Edit"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setDeletingYear(year); setShowYearDelete(true) }} aria-label={`Delete ${year.name}`} title="Delete"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Days */}
      {selectedYearId && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'الأيام النشطة' : 'Active Days'}</h2>
              <p className="text-sm text-gray-500">{lang === 'ar' ? 'اختر أيام الأسبوع التي بها فصول' : 'Select which days of the week have classes'}</p>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {(lang === 'ar' ? DAY_LABELS_AR : DAY_LABELS).map((label, i) => {
                const year = years.find(y => y.id === selectedYearId)
                const active = year?.activeDays?.includes(i) ?? [6, 0].includes(i)
                return (
                  <button key={i} onClick={async () => {
                    const year = years.find(y => y.id === selectedYearId)
                    if (!year) return
                    const current = year.activeDays ?? [6, 0]
                    const next = current.includes(i) ? current.filter(d => d !== i) : [...current, i].sort()
                    try {
                      await http.put(`/curriculum/academic-years/${selectedYearId}`, { activeDays: next })
                      setYears(prev => prev.map(y => y.id === selectedYearId ? { ...y, activeDays: next } : y))
                    } catch (e) { console.error(e) }
                  }}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      active ? 'bg-gold-500 text-gray-950 border-gold-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={async () => {
                if (!selectedYearId) return
                try {
                  await http.post(`/curriculum/academic-years/${selectedYearId}/generate-weekends`)
                  const data = await http.get<any[]>('/curriculum/academic-years', { schoolId: getSchoolId() })
                  setYears(Array.isArray(data) ? data : [])
                  if (selectedYearId) fetchWeeks(selectedYearId)
                } catch (e) { console.error(e) }
              }}
                className="text-xs border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700">
                {lang === 'ar' ? 'تعيين السبت والأحد نشطين وجميع الأسابيع متاحة' : 'Set Sat/Sun Active & Mark All Available'}
              </Button>
              <p className="text-xs text-gray-400">
                {lang === 'ar' ? 'يختار السبت والأحد تلقائياً ويجعل جميع الأسابيع متاحة' : 'Auto-selects Saturday and Sunday, and marks all weeks as available'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Weeks Grid */}
      {selectedYearId && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'توفر الأسابيع' : 'Week Availability'}</h2>
              <p className="text-sm text-gray-500">{lang === 'ar' ? 'تفعيل/إلغاء الأسابيع المتاحة للفصول' : 'Toggle which weeks are available for classes'}</p>
            </div>
            <div className="flex items-center gap-2">
              {calendarSaved && <span className="text-xs font-medium text-green-600" aria-live="polite">{lang === 'ar' ? 'تم الحفظ!' : 'Saved!'}</span>}
              <Button variant="outline" size="sm" onClick={() => handleBulkWeekUpdate(true)} aria-label={lang === 'ar' ? 'تعيين الكل متاح' : 'Set all weeks available'}
                className="text-xs hover:bg-green-50 text-green-700">
                {lang === 'ar' ? 'الكل متاح' : 'All Available'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkWeekUpdate(false)} aria-label={lang === 'ar' ? 'تعيين الكل غير متاح' : 'Set all weeks unavailable'}
                className="text-xs hover:bg-red-50 text-red-700">
                {lang === 'ar' ? 'الكل غير متاح' : 'All Unavailable'}
              </Button>
            </div>
          </div>

          {loadingWeeks ? (
            <div className="px-4 py-12"><TableSkeleton rows={5} cols={4} /></div>
          ) : weeks.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لا توجد أسابيع لهذه السنة.' : 'No weeks for this year.'}</div>
          ) : (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(term => {
                const termWeeks = weeks.filter((w: AcademicWeek) => w.term === term).sort((a: AcademicWeek, b: AcademicWeek) => a.weekNumber - b.weekNumber)
                if (termWeeks.length === 0) return null
                const isExpanded = expandedTerm === term
                return (
                  <div key={term} className="rounded-lg border border-gray-200 overflow-hidden">
                    <button onClick={() => setExpandedTerm(isExpanded ? null : term)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${TERM_COLORS[term]}`}>
                          T{term}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{TERM_LABELS[term]}</span>
                        <span className="text-xs text-gray-400">
                          ({termWeeks.filter((w: AcademicWeek) => w.isAvailable).length}/{termWeeks.length} available)
                        </span>
                      </div>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </button>
                    {isExpanded && (
                      <div className="divide-y divide-gray-100">
                        {termWeeks.map((week: AcademicWeek) => {
                          const currentStatus = week.status || (week.isAvailable ? 'available' : 'feast_off')
                          const statusOption = WEEK_STATUS_OPTIONS.find(s => s.value === currentStatus) || WEEK_STATUS_OPTIONS[0]
                          return (
                          <div key={week.id}
                            className={`px-4 py-3 flex items-center gap-4 transition-colors ${week.isAvailable ? 'bg-white hover:bg-gray-50 active:bg-gray-100' : 'bg-red-50/30 hover:bg-red-50/50'}`}>
                            <button onClick={() => handleToggleWeek(week)}
                              aria-label={`Toggle week ${week.weekNumber} availability`}
                              className={`flex-shrink-0 w-9 h-5 rounded-full transition-colors relative ${week.isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}>
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${week.isAvailable ? 'translate-x-4' : ''}`} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">Week {week.weekNumber}</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(week.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                                  {' — '}
                                  {new Date(week.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                {week.label && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{week.label}</span>
                                )}
                              </div>
                              {week.reason && (
                                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> {week.reason}
                                </div>
                              )}
                            </div>
                            <select
                              value={currentStatus}
                              onChange={e => handleToggleWeek(week, e.target.value)}
                              className={`text-xs font-medium px-2 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${statusOption.color}`}
                            >
                              {WEEK_STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <Button variant="ghost" size="icon" onClick={() => openEditWeek(week)} aria-label={`Edit week ${week.weekNumber}`} title="Edit week details"
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex-shrink-0">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Year Create/Edit Modal */}
      <Modal open={showYearForm} onClose={() => setShowYearForm(false)} title={editingYear ? 'Edit Academic Year' : 'Add Academic Year'}>
        <div className="space-y-4">
          <FormField label="Year Name" required value={yearForm.name} onChange={e => setYearForm({ ...yearForm, name: e.target.value })} placeholder="e.g. 2026-2027" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date *</label>
              <DatePicker value={yearForm.startDate} onChange={v => setYearForm({ ...yearForm, startDate: v })} className="mt-1.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date *</label>
              <DatePicker value={yearForm.endDate} onChange={v => setYearForm({ ...yearForm, endDate: v })} className="mt-1.5" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={yearForm.isCurrent} onChange={e => setYearForm({ ...yearForm, isCurrent: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
            <span className="text-sm text-gray-700">Set as current active year</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setShowYearForm(false)}>Cancel</Button>
          <Button onClick={handleSaveYear} disabled={savingYear || !yearForm.name.trim() || !yearForm.startDate || !yearForm.endDate}>
            {savingYear && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingYear ? 'Save Changes' : 'Create Year'}
          </Button>
        </div>
      </Modal>

      {/* Year Delete Confirmation */}
      <ConfirmDialog
        open={showYearDelete}
        onClose={() => setShowYearDelete(false)}
        onConfirm={handleDeleteYear}
        title="Delete Academic Year"
        message={deletingYear ? `Are you sure you want to delete ${deletingYear.name}? This will also remove all associated weeks and allocations. This action cannot be undone.` : ''}
      />

      {/* Week Edit Modal */}
      <Modal open={!!editingWeek} onClose={() => setEditingWeek(null)} title={editingWeek ? `Week ${editingWeek.weekNumber} Details` : undefined}>
        {editingWeek && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              {new Date(editingWeek.startDate).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' — '}
              {new Date(editingWeek.endDate).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="grid grid-cols-2 gap-2">
                {WEEK_STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => {
                      const isAvailable = opt.value === 'available' || opt.value === 'revision'
                      setWeekForm({ ...weekForm, status: opt.value, isAvailable })
                    }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                      weekForm.status === opt.value
                        ? `${opt.color} border-current shadow-sm`
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <FormField label="Label (optional)" value={weekForm.label} onChange={e => setWeekForm({ ...weekForm, label: e.target.value })} placeholder="e.g. Holy Fifty Days, Nativity Fast" />
            <FormField label="Reason (optional)" value={weekForm.reason} onChange={e => setWeekForm({ ...weekForm, reason: e.target.value })} placeholder="e.g. Church feast - no classes" />
          </div>
        )}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setEditingWeek(null)}>Cancel</Button>
          <Button onClick={handleSaveWeek} disabled={savingWeek}>
            {savingWeek && <Loader2 className="h-4 w-4 animate-spin" />}Save
          </Button>
        </div>
      </Modal>

      {/* Additional Days / Events */}
      {selectedYearId && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'أيام/مناسبات إضافية' : 'Additional Days / Events'}</h2>
              <p className="text-sm text-gray-500">{lang === 'ar' ? 'إضافة أيام إضافية للمناسبات الخاصة خارج الجدول الأسبوعي' : 'Add extra days for events, sessions, or special occasions outside the weekly schedule'}</p>
            </div>
            <Button onClick={openCreateEvent} size="sm">
              <CalendarPlus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة يوم' : 'Add Day'}
            </Button>
          </div>
          {loadingEvents ? (
            <div className="px-4 py-12"><TableSkeleton rows={5} cols={4} /></div>
          ) : events.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لم تتم إضافة أيام إضافية بعد.' : 'No additional days added yet.'}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(ev => {
                const typeOption = EVENT_TYPE_OPTIONS.find(t => t.value === ev.type) || EVENT_TYPE_OPTIONS[5]
                return (
                  <div key={ev.id} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50 active:bg-gray-100">
                    <div className="flex-shrink-0 w-16 text-center">
                      <div className="text-lg font-bold text-gray-900">{new Date(ev.date).getDate()}</div>
                      <div className="text-[10px] text-gray-400 uppercase">{new Date(ev.date).toLocaleDateString('en-GB', { month: 'short' })}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{ev.label}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${typeOption.color}`}>
                          {typeOption.label}
                        </span>
                      </div>
                      {ev.description && <p className="text-xs text-gray-400 mt-0.5">{ev.description}</p>}
                    </div>
                      <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditEvent(ev)} className="rounded p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingEvent(ev); setShowDeleteEvent(true) }} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Event Create/Edit Modal */}
      <Modal open={showEventForm} onClose={() => setShowEventForm(false)} title={editingEvent ? 'Edit Event' : 'Add Event / Special Day'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date *</label>
            <DatePicker value={eventForm.date} onChange={v => setEventForm({ ...eventForm, date: v })} className="mt-1.5" />
          </div>
          <FormField label="Label" required value={eventForm.label} onChange={e => setEventForm({ ...eventForm, label: e.target.value })} placeholder="e.g. Church Convention, Extra Session" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {EVENT_TYPE_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setEventForm({ ...eventForm, type: opt.value })}
                  className={`px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all text-center ${
                    eventForm.type === opt.value
                      ? `${opt.color} border-current shadow-sm`
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FormField label="Description (optional)" value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Additional notes" />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setShowEventForm(false)}>Cancel</Button>
          <Button onClick={handleSaveEvent} disabled={savingEvent || !eventForm.date || !eventForm.label.trim()}>
            {savingEvent && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingEvent ? 'Save Changes' : 'Add Event'}
          </Button>
        </div>
      </Modal>

      {/* Event Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteEvent}
        onClose={() => setShowDeleteEvent(false)}
        onConfirm={handleDeleteEvent}
        title="Delete Event"
        message={deletingEvent ? `Are you sure you want to delete "${deletingEvent.label}"? This action cannot be undone.` : ''}
      />
    </div>
  )
}
