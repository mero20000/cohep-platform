export type TakeQuestion = {
  id: string
  text: string
  type: string
  options: string[] | null
  points: number
  orderIndex: number
}

export type TakeGrade = {
  questionId: string
  score: number
  maxScore: number
}

export type QuestionResult = {
  questionId: string
  status: 'correct' | 'incorrect' | 'pending'
  score: number
  maxScore: number
}

export function computeResult(grades: TakeGrade[], questions: TakeQuestion[]) {
  let earned = 0
  const items: QuestionResult[] = questions.map((q) => {
    const g = grades.find((gr) => gr.questionId === q.id)
    if (!g) {
      return { questionId: q.id, status: 'pending', score: 0, maxScore: q.points }
    }
    earned += g.score
    return { questionId: q.id, status: g.score > 0 ? 'correct' : 'incorrect', score: g.score, maxScore: g.maxScore }
  })
  return { earned, items }
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}