'use client'

import { Button } from '@/components/ui/button'

export default function AttendanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-gray-900">Something went wrong loading attendance</h2>
      <p className="mt-2 text-sm text-gray-500">{error.message}</p>
      <Button variant="outline" size="sm" onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  )
}
