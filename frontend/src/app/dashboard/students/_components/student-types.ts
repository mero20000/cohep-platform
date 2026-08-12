// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Level { id: string; name: string; number: number; status?: string }
export interface Group { id: string; name: string; levelId: string; status?: string }
export interface LevelWithGroups extends Level { groups: Group[] }
export interface ChurchItem { id: string; name: string; nameAr?: string; country?: string; city?: string; isActive?: boolean }

export interface Student {
  id: string; studentCode: string; firstName: string; lastName: string
  firstNameAr?: string; lastNameAr?: string; dateOfBirth: string; gender: string
  churchName?: string; gradeId?: string; grade?: { id: string; name: string } | null; photoUrl?: string
  levelId: string; groupId: string; status: string; enrollmentDate: string
  level: { id: string; name: string; number: number }
  group: { id: string; name: string }
  metadata?: { phone?: string; email?: string; address?: string; notes?: string; churchToolId?: string }
  parentEmail?: string
  portalAccessKey?: string
  studentParents?: Array<{ parent?: { id: string; firstName: string; lastName: string; phone?: string; email?: string }; relationship?: string }>
}

export interface PaginatedResponse {
  data: Student[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface StudentStats {
  total: number; active: number; inactive: number; graduated: number
  male: number; female: number
  gradeDistribution: { grade: string; count: number }[]
}

// ─── Form ────────────────────────────────────────────────────────────────────
export const emptyForm = {
  name: '', firstNameAr: '', lastNameAr: '', dateOfBirth: '', gender: 'male',
  churchName: '', gradeId: '', levelId: '', groupId: '', groupName: '', photoUrl: '',
  status: 'active', phone: '', email: '', address: '', notes: '', churchToolId: '', parentEmail: '',
}
export type StudentForm = typeof emptyForm

// ─── Constants ───────────────────────────────────────────────────────────────
export const STATUS_STYLE: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info'; bar: string }> = {
  active:    { variant: 'success', bar: 'border-s-green-400' },
  inactive:  { variant: 'danger',  bar: 'border-s-red-400'   },
  graduated: { variant: 'warning', bar: 'border-s-amber-400' },
}

// ─── Utils ───────────────────────────────────────────────────────────────────
export function photoSrc(url: string | undefined | null): string {
  if (!url) return ''
  if (url.startsWith('blob:')) return url
  if (url.startsWith('http')) return url
  if (url.startsWith('/uploads/')) {
    const base = process.env.NEXT_PUBLIC_UPLOADS_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3001'
    return `${base}${url}`
  }
  return url
}

export function calcAge(dob: string): number {
  const d = new Date(dob)
  if (isNaN(d.getTime())) return 0
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a
}
