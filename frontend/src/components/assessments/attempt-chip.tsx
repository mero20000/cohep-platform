import { attemptLabel } from '@/app/dashboard/assessments/take-helpers'

/** Small pill reading "Attempt 2 of 3". Renders nothing for single-attempt assessments. */
export function AttemptChip({
  attempt,
  lang,
  className = '',
}: {
  attempt?: { number: number; max: number } | null
  lang: 'en' | 'ar'
  className?: string
}) {
  const label = attempt ? attemptLabel(attempt.number, attempt.max, lang) : null
  if (!label) return null
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 ${className}`}>
      {label}
    </span>
  )
}
