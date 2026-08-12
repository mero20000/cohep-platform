'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'student-favorites'

export function useStudentFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setFavorites(JSON.parse(stored))
      } catch {
        setFavorites([])
      }
    }
  }, [])

  const toggleFavorite = useCallback((studentId: string) => {
    setFavorites(prev => {
      const next = prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isFavorite = useCallback((studentId: string) => {
    return favorites.includes(studentId)
  }, [favorites])

  return { favorites, toggleFavorite, isFavorite }
}
