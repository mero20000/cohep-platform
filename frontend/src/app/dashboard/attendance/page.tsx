import { Suspense } from 'react'

import { AttendanceClient } from './attendance-client'

export const metadata = {
  title: 'Attendance - Coptic Orthodox Hymn Education Platform (COHEP)',
  description: 'Mark and manage session attendance for students and servants',
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-400">Loading attendance…</div>}>
      <AttendanceClient />
    </Suspense>
  )
}