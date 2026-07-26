import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Assessments - Coptic Orthodox Hymn Education Platform (COHEP)',
  description: 'Create and manage assessments and exams',
}

export default function AssessmentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
