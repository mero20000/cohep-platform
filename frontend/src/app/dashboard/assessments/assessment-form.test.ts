import { describe, it, expect } from 'vitest'
import { assessmentToForm, toCopyForm, type AssessmentDetail } from './assessment-form'

const detail: AssessmentDetail = {
  id: 'a1',
  title: 'Midterm',
  description: 'Chapters 1-4',
  type: 'exam',
  status: 'published',
  totalPoints: 100,
  passingScore: 60,
  dueDate: '2026-12-01T00:00:00.000Z',
  levelId: 'l1',
  groupId: 'g1',
  lessonId: 'les1',
  subjectId: 's1',
  metadata: { term: 2, grade: 'G3', durationMinutes: 45 },
  questions: [
    { id: 'q1', questionText: 'Q one', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 5 },
    { id: 'q2', questionText: 'Q two', type: 'true_false', options: null, correctAnswer: 'true', points: 5 },
  ],
  referenceRecordingUrl: 'https://cdn/rec1.mp3',
  referenceRecordingName: 'Lesson One',
  requireReview: true,
  requireRecording: true,
  allowRetry: true,
  maxAttempts: 4,
}

describe('assessmentToForm', () => {
  it('maps a loaded assessment into form state', () => {
    expect(assessmentToForm(detail)).toEqual({
      title: 'Midterm',
      description: 'Chapters 1-4',
      levelId: 'l1',
      groupId: 'g1',
      grade: 'G3',
      lessonId: 'les1',
      subjectId: 's1',
      totalPoints: '100',
      passingPoints: '60',
      dueDate: '2026-12-01',
      term: '2',
      status: 'published',
      type: 'exam',
      questions: [
        { id: 'q1', text: 'Q one', type: 'multiple_choice', options: 'A\nB', correctAnswer: 'A', points: '5' },
        { id: 'q2', text: 'Q two', type: 'true_false', options: '', correctAnswer: 'true', points: '5' },
      ],
      referenceRecordingUrl: 'https://cdn/rec1.mp3',
      referenceRecordingName: 'Lesson One',
      requireReview: true,
      requireRecording: true,
      allowRetry: true,
      maxAttempts: '4',
      reviewTouched: true,
      durationMinutes: '45',
    })
  })

  it('falls back to the type default for review and 3 attempts when the settings are absent', () => {
    const form = assessmentToForm({ ...detail, type: 'exam', requireReview: undefined, requireRecording: undefined, allowRetry: undefined, maxAttempts: null, metadata: undefined })
    expect(form.requireReview).toBe(true)
    expect(form.requireRecording).toBe(false)
    expect(form.allowRetry).toBe(false)
    expect(form.maxAttempts).toBe('3')
    expect(form.durationMinutes).toBe('')
    expect(form.term).toBe('')
  })
})

describe('toCopyForm', () => {
  const source = assessmentToForm(detail)

  it('titles the copy in English', () => {
    expect(toCopyForm(source, 'en').title).toBe('Copy of Midterm')
  })

  it('titles the copy in Arabic', () => {
    expect(toCopyForm(source, 'ar').title).toBe('نسخة من Midterm')
  })

  it('clears the due date, resets to draft and drops question ids', () => {
    const copy = toCopyForm(source, 'en')
    expect(copy.dueDate).toBe('')
    expect(copy.status).toBe('draft')
    expect(copy.questions).toHaveLength(2)
    copy.questions.forEach((q) => expect(q.id).toBeUndefined())
    expect(copy.questions.map((q) => q.text)).toEqual(['Q one', 'Q two'])
  })

  it('carries every other field, including the four settings, reference recording and duration', () => {
    const copy = toCopyForm(source, 'en')
    expect(copy).toMatchObject({
      description: 'Chapters 1-4',
      type: 'exam',
      levelId: 'l1',
      groupId: 'g1',
      grade: 'G3',
      lessonId: 'les1',
      subjectId: 's1',
      term: '2',
      totalPoints: '100',
      passingPoints: '60',
      requireReview: true,
      requireRecording: true,
      allowRetry: true,
      maxAttempts: '4',
      reviewTouched: true,
      referenceRecordingUrl: 'https://cdn/rec1.mp3',
      referenceRecordingName: 'Lesson One',
      durationMinutes: '45',
    })
  })

  it('does not mutate the source form', () => {
    toCopyForm(source, 'en')
    expect(source.title).toBe('Midterm')
    expect(source.questions[0].id).toBe('q1')
  })
})
