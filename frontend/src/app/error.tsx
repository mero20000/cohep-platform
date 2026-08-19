'use client'

import { ChunkErrorReloader } from '@/components/ui/chunk-error-reloader'

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <ChunkErrorReloader error={error} />
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
          <span className="text-2xl">!</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">{error.message || 'An unexpected error occurred'}</p>
        <button onClick={reset}
          className="mt-6 rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-medium text-gray-950 hover:bg-gold-600 transition-colors">
          Try again
        </button>
      </div>
    </div>
  )
}
