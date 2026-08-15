import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LevelsTab } from './levels-tab'
import type { Level, Subject, Lesson } from './types'

vi.mock('lucide-react', () => {
  const names = ['Music2', 'Cross', 'Church', 'BookOpen', 'Star', 'Clock', 'Search', 'Music', 'Plus', 'Upload', 'FileText', 'FileSpreadsheet', 'Pencil', 'Trash2', 'Loader2', 'Presentation', 'GraduationCap', 'Calendar', 'X']
  const icons: Record<string, any> = {}
  for (const n of names) icons[n] = (props: any) => <span data-testid={`icon-${n}`} {...props} />
  return icons
})
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }: any) => <span>{children}</span> }))
vi.mock('@/components/ui/modal', () => ({ Modal: ({ open, children }: any) => (open ? <div>{children}</div> : null) }))
vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: ({ open, children }: any) => (open ? <div>{children}</div> : null) }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/curriculum/lesson-modal', () => ({ LessonModal: () => null }))
vi.mock('@/components/curriculum/import-modal', () => ({ ImportModal: () => null }))
vi.mock('@/components/curriculum/presentation-viewer', () => ({ PresentationViewer: () => null }))

const subjects: Subject[] = [{ id: 's1', name: 'Coptic Hymns', nameAr: 'التراتيل' }]
const levels: Level[] = [{ id: 'l1', number: 1, name: 'Level 1' }]
const lessons: Lesson[] = [
  {
    id: 'les1', title: 'Tenħo', titleCoptic: 'Ⲧⲉⲛϩⲱ', titleAr: 'تنحو', status: 'published',
    orderIndex: 1, sessionsCount: 3, estimatedDurationMinutes: 45,
    level: { number: 1, name: 'Level 1' }, subject: { name: 'Coptic Hymns' }, sessions: [],
  },
]

const baseProps = {
  levels, subjects, lessons,
  onSelectLevel: vi.fn(), onAddLesson: vi.fn(), onEditLesson: vi.fn(), onDeleteLesson: vi.fn(),
  onDeleteLevel: vi.fn(), onAddSubject: vi.fn(), onEditSubject: vi.fn(), onDeleteSubject: vi.fn(),
  onImportLessons: vi.fn(), onExportPDF: vi.fn(), onExportExcel: vi.fn(), deletingLevelId: null,
}

describe('LevelsTab', () => {
  it('shows an empty state prompting level selection when none is selected', () => {
    render(<LevelsTab {...baseProps} selectedLevelId="" />)
    expect(screen.getByText('Select a level to view curriculum')).toBeInTheDocument()
  })

  it('renders lessons grouped by subject once a level is selected', () => {
    render(<LevelsTab {...baseProps} selectedLevelId="l1" />)
    // Level tab button + lesson title
    expect(screen.getByText('Tenħo')).toBeInTheDocument()
    expect(screen.getByText('Coptic Hymns')).toBeInTheDocument()
  })
})
