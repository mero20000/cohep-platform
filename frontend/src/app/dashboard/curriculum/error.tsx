'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChunkErrorReloader } from '@/components/ui/chunk-error-reloader'

export default function CurriculumError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <ChunkErrorReloader error={error} />
      <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-4 max-w-md">
        {error.message || 'Failed to load curriculum data. Please try again.'}
      </p>
      <Button variant="outline" size="sm" onClick={reset} className="inline-flex items-center gap-2">
        <RefreshCw className="h-4 w-4" /> Try Again
      </Button>
    </div>
  )
}
