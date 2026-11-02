import { defaultRequireReview } from './review-settings'

export interface QuestionDraft {
  id?: string
  text: string
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  options: string
  correctAnswer: string
  points: string
}

export const emptyForm = {
  title: '',
  description: '',
  levelId: '',
  groupId: '',
  grade: '',
  // Who the assessment is for within the level/group/grade: everyone unless narrowed.
  gender: 'all' as 'all' | 'male' | 'female',
  lessonId: '',
  subjectId: '',
  totalPoints: '',
  passingPoints: '',
  // XP for a full score; partial scores earn a proportional share.
  xpReward: '100',
  dueDate: '',
  term: '',
  status: 'draft',
  type: 'quiz',
  questions: [] as QuestionDraft[],
  referenceRecordingUrl: '',
  referenceRecordingName: '',
  requireReview: false,
  requireRecording: false,
  allowRetry: false,
  maxAttempts: '3',
  // UI-only: set once the teacher toggles Require review, so a later Type change stops overriding it. Never sent.
  reviewTouched: false,
  // Hidden: carried from the loaded assessment so edit/copy keep the quiz timer.
  durationMinutes: '',
}

export type AssessmentForm = typeof emptyForm

/** Structural subset of the page's Assessment: the fields the form is built from. */
export interface AssessmentDetail {
  title: string
  description?: string
  type: string
  status: string
  totalPoints: number | string
  passingScore: number | string
  xpReward?: number | null
  dueDate?: string
  levelId: string
  groupId?: string
  grade?: string
  lessonId?: string
  subjectId: string
  metadata?: { term?: number; grade?: string; gender?: string; durationMinutes?: number }
  questions?: Array<{
    id: string
    questionText: string
    type: string
    options?: any
    correctAnswer: string
    points: number
  }>
  referenceRecordingUrl?: string
  referenceRecordingName?: string
  requireReview?: boolean
  requireRecording?: boolean
  allowRetry?: boolean
  maxAttempts?: number | null
}

/** Maps a loaded assessment (with its questions) into the form's string-based state. */
export function assessmentToForm(detail: AssessmentDetail): AssessmentForm {
  const meta = detail.metadata || {}
  return {
    title: detail.title,
    description: detail.description || '',
    levelId: detail.levelId,
    groupId: detail.groupId || '',
    grade: meta.grade || detail.grade || '',
    gender: meta.gender === 'male' || meta.gender === 'female' ? meta.gender : 'all',
    lessonId: detail.lessonId || '',
    subjectId: detail.subjectId,
    totalPoints: String(detail.totalPoints),
    passingPoints: String(detail.passingScore),
    xpReward: String(detail.xpReward ?? 100),
    dueDate: detail.dueDate ? detail.dueDate.split('T')[0] : '',
    term: meta.term ? String(meta.term) : '',
    status: detail.status,
    type: detail.type || 'quiz',
    questions: (detail.questions || []).map(q => ({
      id: q.id,
      text: q.questionText,
      type: q.type as QuestionDraft['type'],
      options: Array.isArray(q.options) ? q.options.join('\n') : (q.options || ''),
      correctAnswer: q.correctAnswer,
      points: String(q.points),
    })),
    referenceRecordingUrl: detail.referenceRecordingUrl || '',
    referenceRecordingName: detail.referenceRecordingName || '',
    requireReview: detail.requireReview ?? defaultRequireReview(detail.type || 'quiz'),
    requireRecording: detail.requireRecording ?? false,
    allowRetry: detail.allowRetry ?? false,
    maxAttempts: String(detail.maxAttempts ?? 3),
    reviewTouched: true,
    durationMinutes: meta.durationMinutes ? String(meta.durationMinutes) : '',
  }
}

/** A copy is a new draft: fresh title, no due date, and questions created from scratch (no ids). */
export function toCopyForm(form: AssessmentForm, lang: 'en' | 'ar'): AssessmentForm {
  return {
    ...form,
    title: lang === 'ar' ? `نسخة من ${form.title}` : `Copy of ${form.title}`,
    dueDate: '',
    status: 'draft',
    questions: form.questions.map(q => ({ ...q, id: undefined })),
  }
}
