'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http-client'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MasteryStatus = 'not_started' | 'introduced' | 'practicing' | 'known' | 'mastered'

export interface HymnProgress {
  status: MasteryStatus
  masteryStatus: MasteryStatus
  srRepetitions: number
  progressPercent: number
  nextReviewAt: string | null
  lastAccessedAt: string | null
}

export interface HymnMapItem {
  id: string
  title: string
  titleAr?: string
  titleCoptic?: string
  level: { number: number; name: string }
  subject: { name: string; color?: string }
  estimatedDurationMinutes?: number
  liturgicalTags?: { seasons?: string[]; weekdayTypes?: string[]; feasts?: string[] }
  resources: { id: string; type: string; fileUrl: string; language: string; durationSeconds?: number }[]
  progress: HymnProgress | null
}

export interface DueReviewItem {
  progressId: string
  lesson: { id: string; title: string; titleAr?: string; titleCoptic?: string; level: { number: number; name: string }; subject: { name: string; color?: string }; audioUrl: string | null }
  mastery: MasteryStatus
  srRepetitions: number
  overdueDays: number
}

export interface ThisSundayResponse {
  sunday: string
  copticDate: { year: number; month: number; day: number; monthName: string }
  season: string
  hymns: { id: string; title: string; titleAr?: string; titleCoptic?: string; level: { number: number; name: string }; subject: { name: string; color?: string }; audioUrl: string | null; liturgicalTags?: any }[]
}

export interface ReviewQueueItem {
  id: string
  student: { id: string; firstName: string; lastName: string; photoUrl?: string }
  lesson: { id: string; title: string; titleAr?: string; titleCoptic?: string }
  recordingUrl: string
  selfRating: number
  durationSec?: number
  submittedAt: string
}

export interface LearningStats {
  total: number
  not_started: number
  introduced: number
  practicing: number
  known: number
  mastered: number
  touched: number
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const hymnKeys = {
  all:        ['hymn-learning'] as const,
  map:        (studentId?: string) => [...hymnKeys.all, 'map', studentId] as const,
  dueReview:  (studentId?: string) => [...hymnKeys.all, 'due-review', studentId] as const,
  thisSunday: () => [...hymnKeys.all, 'this-sunday'] as const,
  stats:      (studentId?: string) => [...hymnKeys.all, 'stats', studentId] as const,
  history:    (lessonId: string, studentId?: string) => [...hymnKeys.all, 'history', lessonId, studentId] as const,
  reviewQueue: () => [...hymnKeys.all, 'review-queue'] as const,
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useHymnMap(studentId?: string) {
  return useQuery({
    queryKey: hymnKeys.map(studentId),
    queryFn: () => http.get<HymnMapItem[]>('/hymn-learning/map', studentId ? { studentId } : {}),
    staleTime: 30_000,
  })
}

export function useDueForReview(studentId?: string) {
  return useQuery({
    queryKey: hymnKeys.dueReview(studentId),
    queryFn: () => http.get<DueReviewItem[]>('/hymn-learning/due-review', studentId ? { studentId } : {}),
    staleTime: 30_000,
  })
}

export function useThisSunday() {
  return useQuery({
    queryKey: hymnKeys.thisSunday(),
    queryFn: () => http.get<ThisSundayResponse>('/hymn-learning/this-sunday'),
    staleTime: 3_600_000,
  })
}

export function useLearningStats(studentId?: string) {
  return useQuery({
    queryKey: hymnKeys.stats(studentId),
    queryFn: () => http.get<LearningStats>('/hymn-learning/stats', studentId ? { studentId } : {}),
    staleTime: 30_000,
  })
}

export function useHymnHistory(lessonId: string, studentId?: string) {
  return useQuery({
    queryKey: hymnKeys.history(lessonId, studentId),
    queryFn: () => http.get<any[]>(`/hymn-learning/history/${lessonId}`, studentId ? { studentId } : {}),
    enabled: !!lessonId,
    staleTime: 10_000,
  })
}

export function useServantReviewQueue() {
  return useQuery({
    queryKey: hymnKeys.reviewQueue(),
    queryFn: () => http.get<ReviewQueueItem[]>('/hymn-learning/review-queue'),
    staleTime: 15_000,
  })
}

export function useLogPractice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { lessonId: string; selfRating: number; recordingUrl?: string; durationSec?: number; studentId?: string }) =>
      http.post<any>('/hymn-learning/practice', dto),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: hymnKeys.map() })
      qc.invalidateQueries({ queryKey: hymnKeys.dueReview() })
      qc.invalidateQueries({ queryKey: hymnKeys.stats() })
      qc.invalidateQueries({ queryKey: hymnKeys.history(vars.lessonId) })
    },
  })
}

export function useReviewSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; servantRating: number; servantNote?: string }) =>
      http.patch<any>(`/hymn-learning/sessions/${id}/review`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: hymnKeys.reviewQueue() }),
  })
}

// ─── Mastery colour mapping ───────────────────────────────────────────────────

export const MASTERY_META: Record<MasteryStatus, { label: string; labelAr: string; color: string; bg: string; border: string; ring: string; dot: string }> = {
  not_started: { label: 'Not started', labelAr: 'لم يبدأ', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', ring: 'ring-gray-200', dot: '#B4B2A9' },
  introduced:  { label: 'Introduced',  labelAr: 'تعرف عليه', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', ring: 'ring-blue-200', dot: '#378ADD' },
  practicing:  { label: 'Practicing',  labelAr: 'يتدرب', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', ring: 'ring-amber-200', dot: '#EF9F27' },
  known:       { label: 'Known',       labelAr: 'يعرفه', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', ring: 'ring-teal-200', dot: '#1D9E75' },
  mastered:    { label: 'Mastered',    labelAr: 'أتقنه', color: 'text-gold-700', bg: 'bg-gold-50', border: 'border-gold-300', ring: 'ring-gold-300', dot: '#C9A030' },
}
