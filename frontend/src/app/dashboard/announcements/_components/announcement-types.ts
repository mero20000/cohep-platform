import { ROLES } from '@/lib/roles'

export interface Announcement {
  id: string
  title: string
  titleAr?: string
  body: string
  bodyAr?: string
  priority: 'normal' | 'important' | 'urgent'
  targetRoles: string[]
  targetSubscribers: boolean
  createdBy: { id: string; firstName: string; lastName: string }
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedAnnouncements {
  data: Announcement[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const emptyAnnouncement = {
  title: '', titleAr: '', body: '', bodyAr: '',
  priority: 'normal' as 'normal' | 'important' | 'urgent',
  targetRoles: [] as string[],
  targetSubscribers: false,
}

export type AnnouncementForm = typeof emptyAnnouncement

export const PRIORITY_STYLE: Record<string, { variant: 'info' | 'warning' | 'danger'; dot: string; label: string; labelAr: string }> = {
  normal:    { variant: 'info',    dot: 'bg-blue-400',       label: 'Normal',    labelAr: 'عادي' },
  important: { variant: 'warning', dot: 'bg-amber-400',     label: 'Important', labelAr: 'هام' },
  urgent:    { variant: 'danger',  dot: 'bg-red-400',        label: 'Urgent',    labelAr: 'عاجل' },
}

export const ROLE_OPTIONS = [...ROLES]
