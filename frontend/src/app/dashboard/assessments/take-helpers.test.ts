import { describe, it, expect } from 'vitest'
import { computeResult, formatCountdown } from './take-helpers'

describe('computeResult', () => {
  const qs = [
    { id: 'q1', text: 'A?', type: 'multiple_choice', options: ['x', 'y'], points: 5, orderIndex: 0 },
    { id: 'q2', text: 'Essay', type: 'essay', options: null, points: 10, orderIndex: 1 },
  ]

  it('marks auto-graded correct, essays pending, and sums earned', () => {
    const grades = [
      { questionId: 'q1', score: 5, maxScore: 5 },
    ]
    const res = computeResult(grades, qs)
    expect(res.earned).toBe(5)
    expect(res.items[0].status).toBe('correct')
    expect(res.items[1].status).toBe('pending')
  })

  it('marks a zero-score graded question as incorrect', () => {
    const grades = [{ questionId: 'q1', score: 0, maxScore: 5 }]
    const res = computeResult(grades, qs)
    expect(res.items[0].status).toBe('incorrect')
  })
})

describe('formatCountdown', () => {
  it('formats as m:ss', () => {
    expect(formatCountdown(90)).toBe('1:30')
    expect(formatCountdown(5)).toBe('0:05')
    expect(formatCountdown(0)).toBe('0:00')
  })
})