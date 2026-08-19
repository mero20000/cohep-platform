'use client'

import { ChunkErrorReloader } from '@/components/ui/chunk-error-reloader'

export default function StudentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <ChunkErrorReloader error={error} />
      <h2 className="text-lg font-semibold text-gray-900">Something went wrong loading students</h2>
      <p className="mt-2 text-sm text-gray-500">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-gold-600">
        Try again
      </button>
    </div>
  )
}
