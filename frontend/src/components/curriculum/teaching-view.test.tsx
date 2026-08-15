import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TeachingView } from './teaching-view'
import type { SubjectItem, Level, Subject, Allocation, Lesson } from './types'

vi.mock('lucide-react', () => {
  const names = ['Music2', 'Cross', 'Church', 'BookOpen', 'Star', 'Play', 'Languages', 'CheckCircle2', 'Circle', 'Clock', 'CalendarCheck', 'BarChart3', 'Filter', 'Eye', 'EyeOff']
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

const items: SubjectItem[] = [
  {
    id: 'it1', name: 'Tenħo', nameAr: 'تنحو', nameCoptic: 'Ⲧⲉⲛϩⲱ',
    subject: { id: 's1', name: 'Coptic Hymns' }, subjectId: 's1',
    levels: [{ levelNumber: 1 }], status: 'pending', active: true,
    sessionsGroup1: 3, sessionsGroup2: 3, sessionsGroup3: 3, sessionsGroup4: 3,
    whenLabel: 'Vespers/Matins', educationLanguages: ['coptic'], descriptionAr: 'desc',
  },
  {
    id: 'it2', name: 'Nabrubol', nameAr: 'نبروبول', nameCoptic: 'Ⲛⲁⲃⲣⲩⲃⲟⲗ',
    subject: { id: 's1', name: 'Coptic Hymns' }, subjectId: 's1',
    levels: [{ levelNumber: 1 }], status: 'completed', active: true,
    sessionsGroup1: 4, sessionsGroup2: 4, sessionsGroup3: 4, sessionsGroup4: 4,
    whenLabel: 'Vespers/Matins', educationLanguages: ['coptic'],
  },
]

beforeEach(() => {
  mutate.mockClear()
  // Silence the useMyLevel network call.
  ;(global as any).fetch = vi.fn().mockResolvedValue({ json: async () => ({ groups: [] }) })
})

describe('TeachingView', () => {
  it('renders subject items grouped by subject with a status summary', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={[]} allocations={[]} levelNumber={1} onLevelChange={vi.fn()} />)
    expect(screen.getByText('Tenħo')).toBeInTheDocument()
    expect(screen.getByText('Nabrubol')).toBeInTheDocument()
    // Summary cards: total = 2
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('filters to completed items when the Completed summary card is clicked', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={[]} allocations={[]} levelNumber={1} onLevelChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: (n: string) => n.includes('Completed') && !n.includes('Hide') }))
    expect(screen.getByText('Nabrubol')).toBeInTheDocument()
    expect(screen.queryByText('Tenħo')).not.toBeInTheDocument()
  })

  it('updates item status when the per-item status select changes', () => {
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={[]} allocations={[]} levelNumber={1} onLevelChange={vi.fn()} />)
    const select = screen.getAllByLabelText('Item status')[0] as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'in_progress' } })
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'it1', status: 'in_progress' }), expect.anything())
  })

  it('shows an allocation badge for items that have an allocated lesson', () => {
    const lesson: Lesson = {
      id: 'les1', title: 'Tenħo', status: 'published', orderIndex: 1, sessionsCount: 1,
      level: { number: 1, name: 'Level 1' }, subject: { name: 'Coptic Hymns' }, subjectItemId: 'it1', sessions: [],
    }
    const alloc: Allocation = {
      id: 'a1', term: 1, weekNumber: 1, orderIndex: 1, status: 'published',
      lesson, level: { number: 1, name: 'Level 1' }, subject: { name: 'Coptic Hymns' }, groupNumber: 1,
      academicYear: { name: '2026' },
    }
    render(<TeachingView items={items} subjects={subjects} levels={levels} lessons={[lesson]} allocations={[alloc]} levelNumber={1} onLevelChange={vi.fn()} />)
    expect(screen.getByText(/Alloc G1/)).toBeInTheDocument()
  })
})
