import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CalendarView } from './calendar-view'
import type { SubjectItem, Level, Subject, AcademicWeek } from './types'

vi.mock('lucide-react', () => {
  const names = ['Music2', 'Cross', 'Church', 'BookOpen', 'Star', 'ChevronRight', 'Loader2', 'Trash2', 'GripVertical', 'X', 'CalendarDays', 'Grid3x3', 'Calendar', 'GraduationCap', 'Search', 'Plus', 'Pencil', 'Presentation', 'Clock', 'CheckCircle2', 'Circle', 'Eye', 'EyeOff', 'Languages', 'CalendarCheck', 'BarChart3', 'Filter']
  const icons: Record<string, any> = {}
  for (const n of names) icons[n] = (props: any) => <span data-testid={`icon-${n}`} {...props} />
  return icons
})
vi.mock('@/components/ui/date-picker', () => ({ DatePicker: () => null }))
vi.mock('@/components/ui/modal', () => ({ Modal: ({ open, children }: any) => (open ? <div>{children}</div> : null) }))
vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: ({ open, children }: any) => (open ? <div>{children}</div> : null) }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const subjects: Subject[] = [{ id: 's1', name: 'Coptic Hymns', nameAr: 'التراتيل' }]
const levels: Level[] = [{ id: 'l1', number: 1, name: 'Level 1' }]
const weeks: AcademicWeek[] = [
  { id: 'w1', weekNumber: 1, term: 1, startDate: '2026-01-03', endDate: '2026-01-09', isAvailable: true },
  { id: 'w2', weekNumber: 2, term: 1, startDate: '2026-01-10', endDate: '2026-01-16', isAvailable: true },
]
const teachingItems: SubjectItem[] = [
  {
    id: 'it1', name: 'Tenħo', nameAr: 'تنحو', nameCoptic: 'Ⲧⲉⲛϩⲱ',
    subject: { id: 's1', name: 'Coptic Hymns' }, subjectId: 's1',
    levels: [{ levelNumber: 1 }], status: 'pending', active: true,
    sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3,
  },
]

describe('CalendarView', () => {
  const onCreateLesson = vi.fn().mockResolvedValue({ id: 'newlesson' })
  const onCreateAllocation = vi.fn().mockResolvedValue(true)
  const onRefresh = vi.fn()
  const onMoveAllocation = vi.fn()
  const onDeleteAllocation = vi.fn()
  const onClearAllocations = vi.fn()

  const renderView = () =>
    render(
      <CalendarView
        allocations={[]} lessons={[]} teachingItems={teachingItems}
        levels={levels} subjects={subjects} weeks={weeks} selectedYear="ay1"
        onRefresh={onRefresh} onCreateAllocation={onCreateAllocation} onMoveAllocation={onMoveAllocation}
        onDeleteAllocation={onDeleteAllocation} onClearAllocations={onClearAllocations}
        onCreateLesson={onCreateLesson as any}
        groupOptions={[{ id: 'g1', groupNumber: 1, label: 'Group 1', labelAr: 'المجموعة 1' }]}
      />,
    )

  beforeEach(() => {
    vi.clearAllMocks()
    onCreateLesson.mockResolvedValue({ id: 'newlesson' })
    onCreateAllocation.mockResolvedValue(true)
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any
  })

  it('lists unallocated subject items in the sidebar', () => {
    renderView()
    expect(screen.getByText('Tenħo')).toBeInTheDocument()
    expect(screen.getByText('Unallocated Items')).toBeInTheDocument()
  })

  it('creates a lesson + allocation when a subject item is dragged onto a week cell', async () => {
    const { container } = renderView()
    const itemEl = screen.getByText('Tenħo').closest('[draggable]') as HTMLElement
    const dt = { setData: () => {}, getData: () => '', dropEffect: '', effectAllowed: '' }
    fireEvent.dragStart(itemEl, { dataTransfer: dt })
    const dropCell = container.querySelector('.border-dashed') as HTMLElement
    expect(dropCell).toBeTruthy()
    fireEvent.dragOver(dropCell, { dataTransfer: dt })
    fireEvent.drop(dropCell, { dataTransfer: dt })
    await waitFor(() => expect(onCreateLesson.mock.calls.length).toBeGreaterThan(0))
    expect(onCreateAllocation).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 'newlesson', weekNumber: 1, term: 1, subjectId: 's1' }),
    )
    expect(onRefresh).toHaveBeenCalled()
  })
})
