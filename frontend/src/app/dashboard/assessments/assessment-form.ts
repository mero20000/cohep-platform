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
  lessonId: '',
  subjectId: '',
  totalPoints: '',
  passingPoints: '',
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
