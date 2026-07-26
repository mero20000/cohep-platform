import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Students - Coptic Orthodox Hymn Education Platform (COHEP)',
  description: 'Manage student profiles, enrollment, and records',
}

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
