import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PracticeRecorder } from './practice-recorder'

vi.mock('./student-hooks', () => ({
  useStudentPractice: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('PracticeRecorder reference-audio controls', () => {
  it('renders 1x/0.75x/0.5x speed group and Loop toggle when reference audio exists', () => {
    render(
      <PracticeRecorder
        lessonId="l1"
        lessonTitle="Alleluia"
        referenceAudioUrl="https://example.com/ref.mp3"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
        lang="en"
      />,
    )
    expect(screen.getByRole('group', { name: 'Reference speed' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '0.5×' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '0.75×' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '1×' })).toBeTruthy()
    expect(screen.getByLabelText('Loop')).toBeTruthy()
  })

  it('hides the reference section entirely without audio', () => {
    render(
      <PracticeRecorder
        lessonId="l1"
        lessonTitle="Alleluia"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
        lang="en"
      />,
    )
    expect(screen.queryByRole('group', { name: 'Reference speed' })).toBeNull()
    expect(screen.queryByLabelText('Loop')).toBeNull()
  })
})
