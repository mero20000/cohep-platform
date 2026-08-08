import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'

export interface GradeItem {
  id: string
  name: string
  nameAr?: string | null
  status: string
  groupId?: string
  groupName?: string
  studentCount?: number
}

export interface GroupOption {
  id: string
  name: string
  nameAr?: string | null
  description?: string | null
  status: string
}

export async function fetchGrades(): Promise<GradeItem[]> {
  return http.get<GradeItem[]>('/grades', { schoolId: getSchoolId() })
}

export async function fetchActiveGrades(): Promise<GradeItem[]> {
  const grades = await fetchGrades()
  return grades.filter(g => g.status === 'active')
}

export async function fetchGroups(): Promise<GroupOption[]> {
  return http.get<GroupOption[]>('/students/groups/all', { schoolId: getSchoolId() })
}

export async function createGrade(input: { name: string; nameAr?: string; groupId: string }) {
  return http.post<GradeItem>('/grades', input, { schoolId: getSchoolId() })
}

export async function updateGrade(id: string, input: { name?: string; nameAr?: string; groupId?: string; status?: string }) {
  return http.patch<GradeItem>(`/grades/${id}`, input)
}

export async function deleteGrade(id: string) {
  return http.delete<void>(`/grades/${id}`)
}
