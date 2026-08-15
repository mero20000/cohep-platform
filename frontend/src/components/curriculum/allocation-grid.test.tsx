import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AllocationGrid } from './allocation-grid'
import type { AcademicWeek, Allocation, Level, Lesson, Subject, Group } from './types'

const subjects: Subject[] = [{ id: 's1', name: 'Coptic' }]
const levels: Level[] = [{ id: 'l1', number: 1, name: 'Level 1' }]
const weeks: AcademicWeek[] = [
  { id: 'w1', weekNumber: 1, term: 1, startDate: '2025-01-04', endDate: '2025-01-10', isAvailable: true },
]
const lessons: Lesson[] = [
  {
    id: 'les1', title: 'Intro Hymn', titleCoptic: 'IH', sessionsCount: 1, status: 'approved',
    orderIndex: 1, level: { number: 1, name: 'Level 1' }, subject: { name: 'Coptic' }, sessions: [],
  },
]
const allocations: Allocation[] = []

function renderGrid(overrides: Partial<{ lessons: Lesson[] }> = {}) {
  return render(
    <AllocationGrid
      weeks={weeks}
      allocations={allocations}
      levels={levels}
      lessons={overrides.lessons ?? lessons}
      subjects={subjects}
      selectedTerm={1}
      selectedYear="2025"
      selectedAllocLevelId=""
      groups={[] as Group[]}
      onTermChange={vi.fn()}
      onAllocLevelChange={vi.fn()}
      onSaveAllocation={vi.fn()}
      onClearAllocations={vi.fn()}
    />,
  )
}

describe('AllocationGrid dropdown population', () => {
  it('lists existing lessons in the subject dropdown when lessons exist', () => {
    renderGrid()
    // lesson title (titleCoptic preferred) should be an available option in both desktop + mobile views
    expect(screen.getAllByRole('option', { name: /IH/ }).length).toBeGreaterThan(0)
    // "No lessons" placeholder must not appear
    expect(screen.queryAllByText(/No lessons/).length).toBe(0)
  })

  it('shows "No lessons" when no lessons exist for that level+subject', () => {
    renderGrid({ lessons: [] })
    expect(screen.getAllByText(/No lessons/).length).toBeGreaterThan(0)
  })
})
