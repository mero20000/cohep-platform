'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type HotkeyMap = Record<string, () => void>

export function useHotkeys(map: HotkeyMap) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    const ctrl = e.ctrlKey || e.metaKey

    if (ctrl && key === 'k') {
      e.preventDefault()
      const search = document.querySelector<HTMLInputElement>('input[type="text"]')
      search?.focus()
      return
    }
    if (ctrl) return

    const handler = map[key]
    if (handler) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      e.preventDefault()
      handler()
    }
  }, [map])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export function useDashboardHotkeys() {
  const router = useRouter()

  return useHotkeys({
    '?': () => {
      const el = document.getElementById('help-button')
      el?.click()
    },
    'h': () => router.push('/dashboard'),
    'g': () => router.push('/dashboard/gamification'),
    's': () => {
      const search = document.querySelector<HTMLInputElement>('input[type="text"]')
      search?.focus()
    },
    'a': () => router.push('/dashboard/attendance'),
    't': () => router.push('/dashboard/students'),
  })
}
