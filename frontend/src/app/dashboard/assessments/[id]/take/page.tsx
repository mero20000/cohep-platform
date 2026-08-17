'use client'

import { useParams, useSearchParams } from 'next/navigation'
import TakeAssessment from '@/components/assessments/take-assessment'

export default function DashboardTakePage() {
  const params = useParams()
  const search = useSearchParams()
  const assessmentId = String(params.id)
  const studentId = search.get('student') ?? ''
  return <TakeAssessment assessmentId={assessmentId} mode="dashboard" studentId={studentId} />
}
