import { Suspense } from 'react'
import { MarkClient } from './mark-client'
export const metadata = { title: 'Mark Attendance - COHEP', description: 'Mark today session attendance' }
export default function MarkPage() {
  return (<Suspense fallback={<div className="p-12 text-center text-gray-500">Loading…</div>}><MarkClient /></Suspense>)
}
