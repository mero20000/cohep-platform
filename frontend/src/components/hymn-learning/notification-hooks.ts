'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portalGet, portalPatch } from '@/lib/portal-session'

export type StudentNotificationType =
  | 'practice_reviewed'
  | 'assessment_graded'
  | 'liturgy_verified'
  | 'liturgy_rejected'
  | 'liturgy_clearance'
  | 'badge_awarded'

export interface StudentNotification {
  id: string
  type: StudentNotificationType
  title: string
  titleAr?: string | null
  body?: string | null
  bodyAr?: string | null
  /** Portal-relative only — the backend strips anything absolute before storing. */
  linkPath?: string | null
  read: boolean
  createdAt: string
}

const keys = {
  all: (code: string) => ['student-notifications', code] as const,
  unread: (code: string) => ['student-notifications', code, 'unread'] as const,
}

/**
 * Delivery is polling: there is no push transport behind this. 60s is frequent enough
 * that a servant's review shows up while the student is still in the app, and slow enough
 * not to hammer a free-tier backend.
 */
const POLL_MS = 60_000

export function useStudentNotifications(code: string) {
  return useQuery({
    queryKey: keys.all(code),
    queryFn: () => portalGet<StudentNotification[]>(code, `/student-portal/${code}/me/notifications`),
    enabled: !!code,
    staleTime: 30_000,
    refetchInterval: POLL_MS,
  })
}

export function useStudentUnreadCount(code: string) {
  return useQuery({
    queryKey: keys.unread(code),
    queryFn: () => portalGet<{ unread: number }>(code, `/student-portal/${code}/me/notifications/unread-count`),
    enabled: !!code,
    staleTime: 30_000,
    refetchInterval: POLL_MS,
  })
}

export function useMarkNotificationRead(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      portalPatch<{ updated: number }>(code, `/student-portal/${code}/me/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all(code) })
      qc.invalidateQueries({ queryKey: keys.unread(code) })
    },
  })
}

export function useMarkAllNotificationsRead(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portalPatch<{ updated: number }>(code, `/student-portal/${code}/me/notifications/read-all`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all(code) })
      qc.invalidateQueries({ queryKey: keys.unread(code) })
    },
  })
}
