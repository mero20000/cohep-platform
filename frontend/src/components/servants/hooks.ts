'use client'

import { useQuery } from '@tanstack/react-query'
import { http } from '@/lib/http-client'

export interface ServantProfileData {
  userId: string
  name: string
  photoUrl: string | null
  roles: string[]
  assignedLevel: string | null
  assignedGroup: string | null
  teachingSubjects: string[]
  yearsOfService: number
  totalStudents: number
  totalSessions: number
  totalHymns: number
  totalReviews: number
  lastCalculatedAt: string
}

export interface ServantMilestoneData {
  type: string
  threshold: number
  label: string
  reachedAt: string
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
