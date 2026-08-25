import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TeachingView } from './teaching-view'
import type { SubjectItem, Level, Subject, Allocation, Lesson } from './types'

vi.mock('lucide-react', () => {
  const names = ['Music2', 'Cross', 'Church', 'BookOpen', 'Star', 'Play', 'Languages', 'CheckCircle2', 'Circle', 'Clock', 'CalendarCheck', 'BarChart3', 'Filter', 'Eye', 'EyeOff', 'ChevronDown', 'ChevronRight']
  const icons: Record<string, any> = {}
  for (const n of names) icons[n] = (props: any) => <span data-testid={`icon-${n}`} {...props} />
  return icons
})
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/curriculum/presentation-viewer', () => ({ PresentationViewer: () => null }))
const mutate = vi.fn()
vi.mock('@/components/curriculum/hooks', () => ({ useUpdateItemStatusMutation: () => ({ mutate }) }))

const subjects: Subject[] = [{ id: 's1', name: 'Coptic Hymns', nameAr: 'التراتيل' }]
const levels: Level[] = [{ id: 'l1', number: 1, name: 'Level 1' }]
const groupOptions = [{ id: 'g1', groupNumber: 1, label: 'Group 1', labelAr: 'المجموعة 1' }]

const lessons: Lesson[] = [
  { id: 'les1', title: 'Tenħo', status: 'published', orderIndex: 1, sessionsCount: 1,
    level: { number: 1, name: 'Level 1' }, subject: { name: 'Coptic Hymns' }, subjectItemId: 'it1', sessions: [] },
  { id: 'les2', title: 'Nabrubol', status: 'published', orderIndex: 2, sessionsCount: 1,
    level: { number: 1, name: 'Level 1' }, subject: { name: 'Coptic Hymns' }, subjectItemId: 'it2', sessions: [] },
]

const allocations: Allocation[] = [
  { id: 'a1', term: 1, weekNumber: 1, orderIndex: 1, status: 'published',
    lesson: lessons[0], level: { number: 1, name: 'Level 1' }, subject: { name: 'Coptic Hymns' }, groupNumber: 1, academicYear: { name: '2026' } },
  { id: 'a2', term: 1, weekNumber: 2, orderIndex: 1, status: 'published',
    lesson: lessons[1], level: { number: 1, name: 'Level 1' }, subject: { name: 'Coptic Hymns' }, groupNumber: 1, academicYear: { name: '2026' } },
]

const items: SubjectItem[] = [
  { id: 'it1', name: 'Tenħo', nameAr: 'تنحو', nameCoptic: 'Ṫⲉⲛϩⲱ',
    subject: { id: 's1', name: 'Coptic Hymns' }, subjectId: 's1',
    levels: [{ levelNumber: 1 }], status: 'pending', active: true,
    sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3,
    whenLabel: 'Vespers/Matins', educationLanguages: ['coptic'], descriptionAr: 'desc' },
  { id: 'it2', name: 'Nabrubol', nameAr: 'نبروبول', nameCoptic: 'Ⲛⲁⲃⲣⲩⲃⲟⲗ',
    subject: { id: 's1', name: 'Coptic Hymns' }, subjectId: 's1',
    levels: [{ levelNumber: 1 }], status: 'completed', active: true,
    sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4,
    whenLabel: 'Vespers/Matins', educationLanguages: ['coptic'] },
]

/** Expand the first subject section */
function expandFirstSubject() {
  // Find all buttons, look for the one containing the ChevronRight icon (collapsed state)
  const chevronBtns = screen.getAllByTestId('icon-ChevronRight')
  const btn = chevronBtns[0]?.closest('button')
  if (btn) fireEvent.click(btn)
}

beforeEach(() => {
  mutate.mockClear()
  ;(global as any).fetch = vi.fn().mockResolvedValue({ json: async () => ({ groups: [] }) })
})

describe('TeachingView', () => {
  it('renders subject header with item count', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={lessons} allocations={allocations} levelNumber={1} onLevelChange={vi.fn()} groupOptions={groupOptions} />)
    expect(screen.getAllByTestId('icon-ChevronRight').length).toBeGreaterThanOrEqual(1)
  })

  it('expands to show items when subject header is clicked', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={lessons} allocations={allocations} levelNumber={1} onLevelChange={vi.fn()} groupOptions={groupOptions} />)
    expect(screen.queryByText('Tenħo')).not.toBeInTheDocument()
    expandFirstSubject()
    expect(screen.getByText('Tenħo')).toBeInTheDocument()
    expect(screen.getByText('Nabrubol')).toBeInTheDocument()
  })

  it('filters to completed items when the Completed summary card is clicked', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={lessons} allocations={allocations} levelNumber={1} onLevelChange={vi.fn()} groupOptions={groupOptions} />)
    expandFirstSubject()
    fireEvent.click(screen.getByRole('button', { name: (n: string) => n.includes('Completed') && !n.includes('Hide') }))
    expect(screen.getByText('Nabrubol')).toBeInTheDocument()
    expect(screen.queryByText('Tenħo')).not.toBeInTheDocument()
  })

  it('updates item status when the per-item status select changes', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={lessons} allocations={allocations} levelNumber={1} onLevelChange={vi.fn()} groupOptions={groupOptions} />)
    expandFirstSubject()
    const select = screen.getAllByLabelText('Item status')[0] as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'in_progress' } })
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'it1', status: 'in_progress' }), expect.anything())
  })

  it('shows allocation badges for allocated items', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={lessons} allocations={allocations} levelNumber={1} onLevelChange={vi.fn()} groupOptions={groupOptions} />)
    expandFirstSubject()
    expect(screen.getAllByText(/Alloc G1/).length).toBe(2)
  })

  it('shows empty state when no items are allocated to the selected group', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={[]} allocations={[]} levelNumber={1} onLevelChange={vi.fn()} groupOptions={groupOptions} />)
    expect(screen.getByText(/No allocated items/)).toBeInTheDocument()
  })
})
