export interface PendingAnswer {
  questionId: string
  questionText: string
  type: string
  points: number
  correctAnswer: string | null
  answer: string | null
  awarded: number | null
}

export interface PendingItem {
  submissionId: string
  submittedAt: string
  isLate: boolean
  attemptNumber: number
  student: {
    id: string
    firstName: string
    lastName: string
    studentCode: string | null
    levelName: string | null
    groupName: string | null
    gradeName: string | null
  }
  assessment: {
    id: string
    title: string
    titleAr: string | null
    type: string
    dueDate: string | null
    totalPoints: number
    referenceRecordingUrl: string | null
    referenceRecordingName: string | null
  }
  recording: { url: string; type: string | null; durationSeconds: number | null } | null
  notes: string | null
  /** Answers to questions that were edited or removed after the student answered. */
  extraAnswers: { questionId: string; answer: string }[]
  hasEssay: boolean
  autoScore: number
  answers: PendingAnswer[]
}

/**
 * True when the automatic score cannot stand as the mark: an essay, a recording to listen
 * to, or nothing auto-graded at all (oral / recording-only assessments).
 */
export function needsManualMarking(i: Pick<PendingItem, 'hasEssay' | 'recording' | 'answers'>): boolean {
  return i.hasEssay || !!i.recording || i.answers.length === 0
}

/** One row of the Marked tab: either work a marker scored, or work returned to the student to redo. */
export interface MarkedItem {
  status: 'marked' | 'returned'
  submissionId: string
  /** When it was marked, or when it was returned */
  at: string
  /** null for returned work: nothing has been scored */
  score: number | null
  maxScore: number
  percentage: number | null
  /** The marker's feedback, or the reason it was returned */
  feedback: string | null
  /** null when staff entered the mark directly without a student submission */
  submittedAt: string | null
  isLate: boolean
  /** Kept after marking so the reviewer can refer back to it */
  recording: { url: string; type: string | null; durationSeconds: number | null } | null
  notes: string | null
  /** Who marked it, or who returned it */
  by: { id: string; name: string; isAdmin: boolean } | null
  student: { id: string; firstName: string; lastName: string; studentCode: string | null; groupName: string | null; gradeName: string | null }
  assessment: { id: string; title: string; titleAr: string | null; totalPoints: number }
}

export interface MarkedResponse { days: number; truncated: boolean; items: MarkedItem[] }

export interface QuestionScore { questionId: string; score: number }

export interface ReviewStats {
  days: number
  totalPending: number
  groups: { groupId: string; groupName: string; pending: number; oldestPendingAt: string | null; completed: number; avgTurnaroundHours: number | null }[]
  markers: { userId: string; name: string; completed: number; avgTurnaroundHours: number | null }[]
}

export const ADMIN_ROLES = ['super_admin', 'admin', 'principal']

/** Whole days a submission has been waiting. */
export function waitingDays(submittedAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(submittedAt).getTime()) / 86_400_000))
}

export function formatHours(h: number | null, lang: 'en' | 'ar'): string {
  if (h === null) return '—'
  if (h < 48) return lang === 'ar' ? `${h} ساعة` : `${h} h`
  const d = Math.round((h / 24) * 10) / 10
  return lang === 'ar' ? `${d} يوم` : `${d} d`
}

/** Feedback phrases a reviewer can drop in with one click. */
export const FEEDBACK_SNIPPETS: { en: string; ar: string }[] = [
  { en: 'Excellent work!', ar: 'عمل ممتاز!' },
  { en: 'Good effort — keep practicing.', ar: 'مجهود جيد — واصل التدريب.' },
  { en: 'Please review the lesson and try again.', ar: 'يرجى مراجعة الدرس والمحاولة مرة أخرى.' },
  { en: 'Your answer is incomplete.', ar: 'إجابتك غير مكتملة.' },
]
