'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export function useDirtyForm(isDirty: boolean) {
  const [prompt, setPrompt] = useState(false)

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault()
      e.returnValue = ''
    }
  }, [isDirty])

  useEffect(() => {
    if (isDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, handleBeforeUnload])

  const confirmLeave = useCallback((message?: string) => {
    if (!isDirty) return true
    return window.confirm(message || 'You have unsaved changes. Are you sure you want to leave?')
  }, [isDirty])

  return { confirmLeave, setPrompt }
}
