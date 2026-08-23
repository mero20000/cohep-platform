'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http-client'
import { portalGet, ensurePortalSession } from '@/lib/portal-session'
import type { HymnMapItem, DueReviewItem, ThisSundayResponse, LearningStats } from './hooks'

// ─── Student-code-scoped query keys ────────────────────────────────────────

export const studentHymnKeys = {
  all:        (code: string) => ['student-hymn', code] as const,
  map:        (code: string) => [...studentHymnKeys.all(code), 'map'] as const,
  dueReview:  (code: string) => [...studentHymnKeys.all(code), 'due-review'] as const,
  thisSunday: (code: string) => [...studentHymnKeys.all(code), 'this-sunday'] as const,
  stats:      (code: string) => [...studentHymnKeys.all(code), 'stats'] as const,
  history:    (code: string, lessonId: string) => [...studentHymnKeys.all(code), 'history', lessonId] as const,
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useStudentHymnMap(code: string) {
  return useQuery({
    queryKey: studentHymnKeys.map(code),
    queryFn: () => portalGet<HymnMapItem[]>(code, `/student-portal/${code}/hymn-map`),
    enabled: !!code,
    staleTime: 30_000,
  })
}

export function useStudentThisSunday(code: string) {
  return useQuery({
    queryKey: studentHymnKeys.thisSunday(code),
    queryFn: () => portalGet<ThisSundayResponse>(code, `/student-portal/${code}/this-sunday`),
    enabled: !!code,
    staleTime: 3_600_000,
  })
}

export function useStudentDueReview(code: string) {
  return useQuery({
    queryKey: studentHymnKeys.dueReview(code),
    queryFn: () => portalGet<DueReviewItem[]>(code, `/student-portal/${code}/due-review`),
    enabled: !!code,
    staleTime: 30_000,
  })
}

export function useStudentStats(code: string) {
  return useQuery({
    queryKey: studentHymnKeys.stats(code),
    queryFn: () => portalGet<LearningStats>(code, `/student-portal/${code}/stats`),
    enabled: !!code,
    staleTime: 30_000,
  })
}

export function useStudentHymnHistory(code: string, lessonId: string) {
  return useQuery({
    queryKey: studentHymnKeys.history(code, lessonId),
    queryFn: () => http.get<any[]>(`/student-portal/${code}/history/${lessonId}`),
    enabled: !!code && !!lessonId,
    staleTime: 10_000,
  })
}

export function useStudentPractice(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: { lessonId: string; selfRating: number; recordingUrl?: string; durationSec?: number }) => {
      await ensurePortalSession(code)
      return http.post<any>(`/student-portal/${code}/practice`, dto)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: studentHymnKeys.map(code) })
      qc.invalidateQueries({ queryKey: studentHymnKeys.dueReview(code) })
      qc.invalidateQueries({ queryKey: studentHymnKeys.stats(code) })
      qc.invalidateQueries({ queryKey: studentHymnKeys.history(code, vars.lessonId) })
    },
  })
}

export function useStudentRecordingUpload(code: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/student-portal/${code}/recordings`,
        { method: 'POST', credentials: 'include', body: fd }
      )
      if (!res.ok) throw new Error('Upload failed')
      return res.json() as Promise<{ url: string }>
    },
  })
}
