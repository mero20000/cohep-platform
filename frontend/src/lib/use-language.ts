'use client'
import { useState, useEffect } from 'react'

export function useLanguage(): 'en' | 'ar' {
  const [lang, setLang] = useState<'en' | 'ar'>('en')

  useEffect(() => {
    const saved = (localStorage.getItem('niangelos_language') || 'en') as 'en' | 'ar'
    setLang(saved)
    const handler = (e: Event) => setLang((e as CustomEvent).detail as 'en' | 'ar')
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  return lang
}
