import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TakeAssessment from '../take-assessment'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn() }),
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('@/components/audio-player', () => ({
  AudioPlayer: () => null,
}))

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/http-client', () => ({
  http: {
    get: (...a: any[]) => mocks.get(...a),
    post: (...a: any[]) => mocks.post(...a),
    upload: (...a: any[]) => mocks.upload(...a),
  },
}))

function takePayload(header: Record<string, unknown> = {}) {
  return {
    assessment: {
      id: 'a1',
      title: 'Hymns quiz',
      type: 'quiz',
      totalPoints: 10,
      passingScore: 6,
      durationMinutes: null,
      requireRecording: false,
      attemptNumber: 1,
      maxAttempts: 1,
      ...header,
    },
    questions: [
      { id: 'q1', text: 'The hymn is Coptic?', type: 'true_false', options: null, points: 10, orderIndex: 0 },
    ],
  }
}

function renderTake(mode: 'portal' | 'dashboard' = 'portal') {
  return render(
    <TakeAssessment
      assessmentId="a1"
      mode={mode}
      accessKey={mode === 'portal' ? 'KEY1' : undefined}
      studentId={mode === 'dashboard' ? 's1' : undefined}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TakeAssessment', () => {
  it('disables Submit and labels the recording required when requireRecording is on in portal mode', async () => {
    mocks.get.mockResolvedValue(takePayload({ requireRecording: true }))
    renderTake('portal')

    expect(await screen.findByText('Voice recording (required)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('does not block Submit for a required recording in dashboard mode', async () => {
    mocks.get.mockResolvedValue(takePayload({ requireRecording: true }))
    renderTake('dashboard')

    await screen.findByText('Hymns quiz')
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled()
  })

  describe('allowRecording', () => {
    it('renders no recording block when allowRecording is false', async () => {
      mocks.get.mockResolvedValue(takePayload({ allowRecording: false }))
      renderTake('portal')

      await screen.findByText('Hymns quiz')
      expect(screen.queryByText(/Voice recording/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /start recording/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled()
    })

    it('shows the optional recording block when allowRecording is true', async () => {
      mocks.get.mockResolvedValue(takePayload({ allowRecording: true }))
      renderTake('portal')

      expect(await screen.findByText('Voice recording (optional)')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument()
    })

    it('shows the optional recording block when the field is missing (older backend)', async () => {
      mocks.get.mockResolvedValue(takePayload())
      renderTake('portal')

      expect(await screen.findByText('Voice recording (optional)')).toBeInTheDocument()
    })

    it('still shows a required recording', async () => {
      mocks.get.mockResolvedValue(takePayload({ requireRecording: true, allowRecording: true }))
      renderTake('portal')

      expect(await screen.findByText('Voice recording (required)')).toBeInTheDocument()
    })
  })

  it('shows Attempt 2 of 3 in the header', async () => {
    mocks.get.mockResolvedValue(takePayload({ attemptNumber: 2, maxAttempts: 3 }))
    renderTake('portal')

    expect(await screen.findByText(/Attempt 2 of 3/)).toBeInTheDocument()
  })

  it('keeps the page open and explains when the timer hits 0:00 without a required recording', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mocks.get.mockResolvedValue(takePayload({ requireRecording: true, durationMinutes: 1 }))
    renderTake('portal')

    await screen.findByText('1:00')
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000) })

    expect(mocks.post).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/recording is required/i)
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  const retryResult = {
    gradingComplete: true, earned: 0, max: 10, passed: false,
    attemptNumber: 1, maxAttempts: 3, attemptsRemaining: 2,
    canRetry: true, revealDetail: false,
  }

  async function submitFirstAttempt(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByLabelText('True'))
    await user.click(screen.getByRole('button', { name: /submit/i }))
    return screen.findByRole('button', { name: /Try again/ })
  }

  it('hides per-question marks and shows Try again when the result has revealDetail false and canRetry true', async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(takePayload({ attemptNumber: 1, maxAttempts: 3 }))
    mocks.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/submit')) {
        return { id: 'sub1', grades: [], result: retryResult }
      }
      return {}
    })
    renderTake('portal')

    const retry = await submitFirstAttempt(user)
    expect(retry).toHaveTextContent('Try again — attempt 2 of 3')
    expect(screen.queryByText('Your Answers')).not.toBeInTheDocument()
    expect(screen.queryByText('The hymn is Coptic?')).not.toBeInTheDocument()
  })

  it('returns to a fresh take view for the next attempt after Try again, without navigating', async () => {
    const user = userEvent.setup()
    mocks.get
      .mockResolvedValueOnce(takePayload({ attemptNumber: 1, maxAttempts: 3 }))
      .mockResolvedValue(takePayload({ attemptNumber: 2, maxAttempts: 3 }))
    mocks.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/submit')) return { id: 'sub1', grades: [], result: retryResult }
      return {}
    })
    renderTake('portal')

    await user.click(await submitFirstAttempt(user))

    expect(mocks.post).toHaveBeenCalledWith('/student-portal/KEY1/assessments/a1/retake', {})
    expect(await screen.findByText(/Attempt 2 of 3/)).toBeInTheDocument()
    expect(screen.getByText(/The hymn is Coptic\?/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    expect(screen.queryByText(/Not quite yet/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Try again/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('True')).not.toBeChecked()
    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(push).not.toHaveBeenCalled()
  })

  describe('submitted screen', () => {
    const passedResult = {
      gradingComplete: true, earned: 10, max: 10, passed: true,
      attemptNumber: 2, maxAttempts: 3, attemptsRemaining: 1,
      canRetry: false, revealDetail: true,
    }

    async function submitWith(result: Record<string, unknown>, grades: unknown[] = []) {
      const user = userEvent.setup()
      mocks.get.mockResolvedValue(takePayload({ attemptNumber: 2, maxAttempts: 3 }))
      mocks.post.mockImplementation(async (url: string) =>
        url.endsWith('/submit') ? { id: 'sub1', grades, result } : {})
      renderTake('portal')
      await user.click(await screen.findByLabelText('True'))
      await user.click(screen.getByRole('button', { name: /submit/i }))
      return user
    }

    it('celebrates a pass with a single way back to the portal and no Home or Dashboard button', async () => {
      const user = await submitWith(passedResult, [{ questionId: 'q1', score: 10, maxScore: 10 }])

      expect(await screen.findByText('You passed!')).toBeInTheDocument()
      expect(screen.getByText(/Attempt 2 of 3/)).toBeInTheDocument()
      expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^home$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^dashboard$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /back to my assessments/i }))
      expect(push).toHaveBeenCalledWith('/student-portal/KEY1')
    })

    it('tells a failed student how many points short they are and how many attempts remain', async () => {
      await submitWith({ ...retryResult, earned: 4, attemptNumber: 1, attemptsRemaining: 2 })

      expect(await screen.findByText('Not quite yet')).toBeInTheDocument()
      expect(screen.getByText(/You need 2 more points to pass\. 2 attempts left\./)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
    })

    it('shows a neutral final state when the last attempt is not passed', async () => {
      await submitWith(
        { ...retryResult, earned: 4, attemptNumber: 3, attemptsRemaining: 0, canRetry: false, revealDetail: true },
        [{ questionId: 'q1', score: 0, maxScore: 10 }],
      )

      expect(await screen.findByText('Not passed this time')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Incorrect' })).toBeInTheDocument()
    })

    it('shows awaiting marking instead of a score', async () => {
      await submitWith({
        gradingComplete: false, earned: null, max: 10, passed: null,
        attemptNumber: 1, maxAttempts: 3, attemptsRemaining: 2, canRetry: false, revealDetail: false,
      })

      expect(await screen.findByText('Submitted')).toBeInTheDocument()
      expect(screen.getByText(/awaiting marking/i)).toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })
  })

  it('shows the error and re-enables Try again when the retake POST fails', async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(takePayload({ attemptNumber: 1, maxAttempts: 3 }))
    mocks.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/submit')) return { id: 'sub1', grades: [], result: retryResult }
      throw new Error('No attempts left')
    })
    renderTake('portal')

    const retry = await submitFirstAttempt(user)
    await user.click(retry)

    expect(await screen.findByRole('alert')).toHaveTextContent('No attempts left')
    expect(screen.getByRole('button', { name: /Try again/ })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })
})
