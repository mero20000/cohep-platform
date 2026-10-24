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
  assessment: { id: string; title: string; titleAr: string | null; type: string; dueDate: string | null; totalPoints: number }
  hasEssay: boolean
  autoScore: number
  answers: PendingAnswer[]
}

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
