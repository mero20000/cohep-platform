import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SubmissionReview from '../page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'ABC', assessmentId: 'a1', submissionId: 's1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/portal-session', () => ({
  ensurePortalSession: vi.fn().mockResolvedValue(undefined),
  portalGet: vi.fn(),
}))

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/http-client', () => ({
  http: {
    get: (...a: any[]) => mocks.get(...a),
    post: (...a: any[]) => mocks.post(...a),
  },
}))

const baseQuestion = {
  id: 'q1',
  text: 'Which tone is used on Sundays?',
  type: 'multiple_choice',
  options: ['Adam', 'Batos'],
  points: 10,
  studentAnswer: 'Batos',
  correctAnswer: 'Adam',
  isCorrect: false,
  score: 0,
  maxScore: 10,
}

function payload(overrides: { grade?: object; attempt?: object; questions?: object[] } = {}) {
  return {
    submission: { id: 's1', submittedAt: '2026-11-01T10:00:00Z', status: 'completed' },
    assessment: { id: 'a1', title: 'Hymns quiz', type: 'quiz', totalPoints: 10, passingScore: 7 },
    grade: { gradingComplete: true, earned: 0, max: 10, percentage: 0, passed: false, ...overrides.grade },
    attempt: { number: 1, max: 3, remaining: 2, canRetry: true, answerKeyOpen: false, ...overrides.attempt },
    questions: overrides.questions ?? [{ ...baseQuestion, correctAnswer: null, isCorrect: null, score: null }],
  }
}

describe('SubmissionReview result page', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.post.mockReset()
  })

  it('shows Try again only when attempt.canRetry', async () => {
    mocks.get.mockResolvedValue(payload({ attempt: { number: 1, canRetry: true } }))
    const { unmount } = render(<SubmissionReview />)
    const button = await screen.findByRole('button', { name: /try again/i })
    expect(button.textContent?.toLowerCase()).toContain('attempt 2 of 3')
    unmount()

    mocks.get.mockResolvedValue(payload({ attempt: { number: 1, canRetry: false, remaining: 2 } }))
    render(<SubmissionReview />)
    await screen.findByText('Hymns quiz')
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeTruthy()
  })

  it('shows No attempts left when failed with no attempts remaining', async () => {
    mocks.get.mockResolvedValue(payload({ attempt: { number: 3, remaining: 0, canRetry: false, answerKeyOpen: true } }))
    render(<SubmissionReview />)
    expect(await screen.findByText(/no attempts left/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeTruthy()
  })

  it('does not show No attempts left for a single-attempt assessment', async () => {
    mocks.get.mockResolvedValue(payload({ attempt: { number: 1, max: 1, remaining: 0, canRetry: false, answerKeyOpen: true } }))
    render(<SubmissionReview />)
    await screen.findByText('Hymns quiz')
    expect(screen.queryByText(/no attempts left/i)).toBeNull()
  })

  it('replaces the question list with an unlock note while the answer key is closed', async () => {
    mocks.get.mockResolvedValue(payload({ attempt: { answerKeyOpen: false } }))
    render(<SubmissionReview />)
    expect(await screen.findByText(/unlock after you pass or use your last attempt/i)).toBeTruthy()
    expect(screen.queryByText('Which tone is used on Sundays?')).toBeNull()
    expect(screen.queryByText('Question Review')).toBeNull()
  })

  it('still shows the question review when the answer key is open', async () => {
    mocks.get.mockResolvedValue(
      payload({
        attempt: { number: 1, max: 1, remaining: 0, canRetry: false, answerKeyOpen: true },
        questions: [baseQuestion],
      }),
    )
    render(<SubmissionReview />)
    expect(await screen.findByText('Which tone is used on Sundays?')).toBeTruthy()
    expect(screen.getByText('Question Review')).toBeTruthy()
    expect(screen.queryByText(/unlock after you pass/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
  })

  it('falls back to pre-feature behaviour when an older backend sends no attempt (graded)', async () => {
    const { attempt: _omit, ...legacy } = payload({ questions: [baseQuestion] })
    mocks.get.mockResolvedValue(legacy)
    const { container } = render(<SubmissionReview />)
    expect(await screen.findByText('Which tone is used on Sundays?')).toBeTruthy()
    expect(screen.getByText('Question Review')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    expect(screen.queryByText(/attempt \d of \d/i)).toBeNull()
    expect(screen.queryByText(/no attempts left/i)).toBeNull()
    expect(container.textContent).not.toMatch(/unlock after you pass/i)
  })

  it('falls back to pre-feature behaviour when an older backend sends no attempt (awaiting marking)', async () => {
    const { attempt: _omit, ...legacy } = payload({ grade: { gradingComplete: false, earned: null, percentage: null, passed: null } })
    mocks.get.mockResolvedValue(legacy)
    render(<SubmissionReview />)
    expect(await screen.findByText('Awaiting marking')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    expect(screen.queryByText(/attempt \d of \d/i)).toBeNull()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeTruthy()
  })

  it('shows the attempt label near the score when the assessment allows several attempts', async () => {
    mocks.get.mockResolvedValue(payload({ attempt: { number: 2, max: 3, remaining: 1 } }))
    render(<SubmissionReview />)
    expect(await screen.findByText('Attempt 2 of 3')).toBeTruthy()
  })
})
