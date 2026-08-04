'use client'
import { useEffect } from 'react'

export function LangSync() {
  useEffect(() => {
    const sync = () => {
      const lang = localStorage.getItem('niangelos_language') || 'en'
      document.documentElement.lang = lang
    }
    sync()
    window.addEventListener('langchange', sync)
    return () => window.removeEventListener('langchange', sync)
  }, [])

  return null
}
