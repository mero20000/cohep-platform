export interface QuestionDraftLike {
  text: string
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  options: string
  correctAnswer: string
  points: string
}

export interface ValidationIssue {
  questionIndex: number
  message: string
}

export function validateQuestions(questions: QuestionDraftLike[], totalPoints: number): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const sum = questions.reduce((a, q) => a + (parseInt(q.points, 10) || 0), 0)
  if (sum > totalPoints) {
    issues.push({ questionIndex: -1, message: `Question points (${sum}) exceed total points (${totalPoints})` })
  }
  questions.forEach((q, i) => {
    if (q.type !== 'multiple_choice') return
    const opts = q.options.split('\n').map(o => o.trim()).filter(Boolean)
    if (opts.some(o => !o)) {
      issues.push({ questionIndex: i, message: 'Multiple-choice options cannot be empty' })
    }
    if (q.correctAnswer && !opts.includes(q.correctAnswer.trim())) {
      issues.push({ questionIndex: i, message: 'Correct answer must be one of the options' })
    }
  })
  return issues
}