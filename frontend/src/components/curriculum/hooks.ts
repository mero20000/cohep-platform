import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/use-language'
import { getSchoolId } from '@/lib/school'
import { API, toDateStr } from './constants'
import type { Level, Subject, Lesson, Allocation, AcademicYear, AcademicWeek, Group, LessonFormData, SubjectItem } from './types'

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('niangelos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.accessToken) localStorage.setItem('niangelos_token', data.accessToken)
    return true
  } catch {
    return false
  }
}

async function request<T>(url: string, method: string, body?: unknown): Promise<T> {
  let res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
    throw new Error(err.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

async function fetchJson<T>(url: string): Promise<T> {
  return request<T>(url, 'GET')
}

async function mutateJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  return request<T>(url, method, body)
}

export function useLevelsQuery() {
  return useQuery({
    queryKey: ['curriculum', 'levels'],
    queryFn: () => fetchJson<Level[]>(`${API}/curriculum/levels?schoolId=${getSchoolId()}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useSubjectsQuery() {
  return useQuery({
    queryKey: ['curriculum', 'subjects'],
    queryFn: () => fetchJson<Subject[]>(`${API}/curriculum/subjects?schoolId=${getSchoolId()}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAcademicYearsQuery() {
  return useQuery({
    queryKey: ['curriculum', 'academic-years'],
    queryFn: () => fetchJson<AcademicYear[]>(`${API}/curriculum/academic-years?schoolId=${getSchoolId()}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useWeeksQuery(academicYearId?: string) {
  const params = new URLSearchParams({ schoolId: getSchoolId() })
  if (academicYearId) params.set('academicYearId', academicYearId)
  return useQuery({
    queryKey: ['curriculum', 'weeks', academicYearId],
    queryFn: () => fetchJson<AcademicWeek[]>(`${API}/curriculum/weeks?${params}`),
    enabled: !!academicYearId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useGroupsQuery() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const data = await fetchJson<Array<{ groups: Group[] }>>(`${API}/students/groups/all?schoolId=${getSchoolId()}`)
      return data.flatMap(l => l.groups)
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useLessonQuery(lessonId?: string) {
  return useQuery({
    queryKey: ['curriculum', 'lesson', lessonId],
    queryFn: () => fetchJson<Lesson>(`${API}/curriculum/lessons/${lessonId}`),
    enabled: !!lessonId,
  })
}

export function useLessonsQuery(levelId?: string) {
  const params = new URLSearchParams({ schoolId: getSchoolId() })
  if (levelId) params.append('levelId', levelId)
  return useQuery({
    queryKey: ['curriculum', 'lessons', levelId ?? 'all'],
    queryFn: () => fetchJson<Lesson[]>(`${API}/curriculum/lessons?${params}`),
  })
}

export function useAllAllocationsQuery(academicYearId: string, levelId?: string) {
  const params = new URLSearchParams({ schoolId: getSchoolId(), academicYearId })
  if (levelId) params.append('levelId', levelId)
  return useQuery({
    queryKey: ['curriculum', 'allocations', academicYearId, levelId ?? 'all'],
    queryFn: () => fetchJson<Allocation[]>(`${API}/curriculum/allocations?${params}`),
    enabled: !!academicYearId,
  })
}

export function useCreateAllocationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutateJson(`${API}/curriculum/allocations`, 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'allocations'] }),
  })
}

export function useUpdateAllocationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      mutateJson(`${API}/curriculum/allocations/${id}`, 'PUT', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'allocations'] }),
  })
}

export function useDeleteAllocationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mutateJson(`${API}/curriculum/allocations/${id}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'allocations'] }),
  })
}

export function useBulkDeleteAllocationsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: URLSearchParams) =>
      mutateJson(`${API}/curriculum/allocations?${params}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'allocations'] }),
  })
}

export function useDeleteLevelMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mutateJson(`${API}/curriculum/levels/${id}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'levels'] }),
  })
}

export function useCreateSubjectMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; nameAr?: string; description?: string }) =>
      mutateJson(`${API}/curriculum/subjects?schoolId=${getSchoolId()}`, 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'subjects'] }),
  })
}

export function useUpdateSubjectMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; nameAr?: string; description?: string } }) =>
      mutateJson(`${API}/curriculum/subjects/${id}?schoolId=${getSchoolId()}`, 'PUT', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'subjects'] }),
  })
}

export function useDeleteSubjectMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mutateJson(`${API}/curriculum/subjects/${id}?schoolId=${getSchoolId()}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'subjects'] }),
  })
}

export function useCreateLessonMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutateJson(`${API}/curriculum/lessons?schoolId=${getSchoolId()}`, 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'lessons'] }),
  })
}

export function useUpdateLessonMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      mutateJson(`${API}/curriculum/lessons/${id}`, 'PUT', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'lessons'] }),
  })
}

export function useDeleteLessonMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mutateJson(`${API}/curriculum/lessons/${id}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'lessons'] }),
  })
}

export function useAllItemsQuery(levelNumber?: number) {
  return useQuery({
    queryKey: ['curriculum', 'items', levelNumber],
    queryFn: () => {
      const params = new URLSearchParams({ schoolId: getSchoolId() })
      if (levelNumber !== undefined) params.set('levelNumber', String(levelNumber))
      return fetchJson<SubjectItem[]>(`${API}/curriculum/items?${params}`)
    },
    enabled: levelNumber !== undefined,
  })
}

export function useUpdateItemStatusMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      mutateJson(`${API}/curriculum/items/${id}/status`, 'PATCH', { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'items'] }),
  })
}

export function useBulkImportLessonsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutateJson(`${API}/curriculum/lessons/bulk?schoolId=${getSchoolId()}`, 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curriculum', 'lessons'] }),
  })
}
