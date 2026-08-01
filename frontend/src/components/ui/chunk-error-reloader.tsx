'use client'

import { useEffect, useRef } from 'react'
import { shouldAutoReloadOnChunkError } from '@/lib/error-reload'

interface Props {
  error: Error | null | undefined
}

export function ChunkErrorReloader({ error }: Props) {
  const attemptedRef = useRef(false)
  useEffect(() => {
    if (attemptedRef.current) return
    if (shouldAutoReloadOnChunkError(error)) {
      attemptedRef.current = true
      window.location.reload()
    }
  }, [error])
  return null
}
