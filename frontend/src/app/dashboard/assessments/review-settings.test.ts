import { describe, it, expect } from 'vitest'
import { defaultRequireReview, hasEssay, reviewPayload, needsShortAnswerWarning } from './review-settings'

const base = {
  requireReview: false,
  requireRecording: false,
  allowRecording: true,
  allowRetry: false,
  maxAttempts: '3',
  questions: [] as Array<{ type: string }>,
}

describe('defaultRequireReview', () => {
  it('is off for quizzes and on for every other type', () => {
    expect(defaultRequireReview('quiz')).toBe(false)
    expect(defaultRequireReview('exam')).toBe(true)
    expect(defaultRequireReview('oral')).toBe(true)
  })
})

describe('hasEssay', () => {
  it('detects an essay question', () => {
    expect(hasEssay([{ type: 'multiple_choice' }, { type: 'essay' }])).toBe(true)
    expect(hasEssay([{ type: 'short_answer' }])).toBe(false)
    expect(hasEssay([])).toBe(false)
  })
})

describe('reviewPayload', () => {
  it('forces review on and retry off when an essay question exists, with no maxAttempts', () => {
    const out = reviewPayload({ ...base, allowRetry: true, maxAttempts: '4', questions: [{ type: 'essay' }] })
    expect(out).toEqual({ requireReview: true, requireRecording: false, allowRecording: true, allowRetry: false })
    expect(out).not.toHaveProperty('maxAttempts')
  })

  it('sends maxAttempts as a number when retry is on', () => {
    const out = reviewPayload({ ...base, allowRetry: true, maxAttempts: '4', requireRecording: true })
    expect(out).toEqual({ requireReview: false, requireRecording: true, allowRecording: true, allowRetry: true, maxAttempts: 4 })
  })

  it('sends allowRecording false when recording is off and not required', () => {
    expect(reviewPayload({ ...base, allowRecording: false }).allowRecording).toBe(false)
  })

  it('sends allowRecording true whenever recording is required, whatever the form says', () => {
    expect(reviewPayload({ ...base, requireRecording: true, allowRecording: false }).allowRecording).toBe(true)
  })

  it('omits maxAttempts when retry is off', () => {
    expect(reviewPayload({ ...base, maxAttempts: '4' })).not.toHaveProperty('maxAttempts')
  })

  it('omits maxAttempts when the input is not a number', () => {
    expect(reviewPayload({ ...base, allowRetry: true, maxAttempts: '' })).not.toHaveProperty('maxAttempts')
  })
})

describe('needsShortAnswerWarning', () => {
  it('is true only when review is off and a short-answer question exists', () => {
    const short = [{ type: 'short_answer' }]
    expect(needsShortAnswerWarning({ requireReview: false, questions: short })).toBe(true)
    expect(needsShortAnswerWarning({ requireReview: true, questions: short })).toBe(false)
    expect(needsShortAnswerWarning({ requireReview: false, questions: [{ type: 'multiple_choice' }] })).toBe(false)
  })
})
