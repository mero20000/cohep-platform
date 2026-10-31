'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http-client'

export interface ServantProfileData {
  userId: string
  name: string
  photoUrl: string | null
  roles: string[]
  assignedLevel: string | null
  assignedGroup: string | null
  teachingSubjects: string[]
  teachingGender: string | null
  yearsOfService: number
  dateJoined: string | null
  totalStudents: number
  totalSessions: number
  totalHymns: number
  totalReviews: number
  lastCalculatedAt: string
  nextMilestone: NextMilestone | null
  /** Milestones not yet celebrated; only sent when you view your own profile. */
  newMilestones?: ServantMilestoneData[]
}

export interface ServantMilestoneData {
  type: string
  threshold: number
  label: string
  labelAr?: string | null
  reachedAt: string
}

export interface NextMilestone {
  type: string
  current: number
  target: number
  remaining: number
  label: string
  labelAr: string
}

const servantKeys = {
  all: ['servants'] as const,
  profile: (id: string) => [...servantKeys.all, 'profile', id] as const,
  myProfile: () => [...servantKeys.all, 'myProfile'] as const,
  timeline: (id: string) => [...servantKeys.all, 'timeline', id] as const,
  schoolSummary: () => [...servantKeys.all, 'schoolSummary'] as const,
}

export function useMyServantProfile() {
  return useQuery({
    queryKey: servantKeys.myProfile(),
    queryFn: () => http.get<ServantProfileData>('/servants/profile/me'),
    staleTime: 60_000,
  })
}

export function useServantProfile(userId: string) {
  return useQuery({
    queryKey: servantKeys.profile(userId),
    queryFn: () => http.get<ServantProfileData>(`/servants/${userId}/profile`),
    enabled: !!userId,
    staleTime: 60_000,
  })
}

export function useServantTimeline(userId: string) {
  return useQuery({
    queryKey: servantKeys.timeline(userId),
    queryFn: () => http.get<ServantMilestoneData[]>(`/servants/${userId}/timeline`),
    enabled: !!userId,
    staleTime: 60_000,
  })
}

export function useSchoolServantSummary() {
  return useQuery({
    queryKey: servantKeys.schoolSummary(),
    queryFn: () => http.get<ServantProfileData[]>('/servants/school/summary'),
    staleTime: 60_000,
  })
}

/** Dismisses the milestone celebration for good (marks every pending milestone as seen). */
export function useMarkMilestonesSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => http.post('/servants/milestones/seen'),
    onSuccess: () => qc.invalidateQueries({ queryKey: servantKeys.all }),
  })
}
