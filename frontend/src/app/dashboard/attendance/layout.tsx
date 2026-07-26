import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Attendance - Coptic Orthodox Hymn Education Platform (COHEP)',
  description: 'Track and manage session attendance',
}

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
