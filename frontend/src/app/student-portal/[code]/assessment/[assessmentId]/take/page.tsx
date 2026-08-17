'use client'

import { useParams } from 'next/navigation'
import TakeAssessment from '@/components/assessments/take-assessment'

export default function PortalTakePage() {
  const params = useParams()
  const code = String(params.code)
  const assessmentId = String(params.assessmentId)
  return <TakeAssessment assessmentId={assessmentId} mode="portal" accessKey={code} />
}
