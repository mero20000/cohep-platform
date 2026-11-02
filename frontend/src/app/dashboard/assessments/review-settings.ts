import type { AssessmentForm } from './assessment-form'

/** Quizzes are auto-graded by default; every other type is reviewed by a teacher. */
export function defaultRequireReview(type: string): boolean {
  return type !== 'quiz'
}

export function hasEssay(questions: Array<{ type: string }>): boolean {
  return questions.some(q => q.type === 'essay')
}

type ReviewFields = Pick<AssessmentForm, 'requireReview' | 'requireRecording' | 'allowRecording' | 'allowRetry' | 'maxAttempts' | 'questions'>

/** Mirrors the backend rules: essays force review on and retry off; maxAttempts only matters with retry. */
export function reviewPayload(form: ReviewFields): {
  requireReview: boolean
  requireRecording: boolean
  allowRecording: boolean
  allowRetry: boolean
  maxAttempts?: number
} {
  const essay = hasEssay(form.questions)
  const allowRetry = essay ? false : form.allowRetry
  const payload: { requireReview: boolean; requireRecording: boolean; allowRecording: boolean; allowRetry: boolean; maxAttempts?: number } = {
    requireReview: essay ? true : form.requireReview,
    requireRecording: form.requireRecording,
    // A required recording is always allowed (the backend enforces the same).
    allowRecording: form.requireRecording ? true : form.allowRecording,
    allowRetry,
  }
  if (allowRetry) {
    const n = parseInt(form.maxAttempts, 10)
    if (!Number.isNaN(n)) payload.maxAttempts = Math.min(10, Math.max(2, n))
  }
  return payload
}

/** Short answers need a human to mark them unless the key matches exactly. */
export function needsShortAnswerWarning(form: Pick<AssessmentForm, 'requireReview' | 'questions'>): boolean {
  return !form.requireReview && !hasEssay(form.questions) && form.questions.some(q => q.type === 'short_answer')
}
