export interface NotificationItem {
  id: string
  type: string
  title: string
  titleAr?: string
  body: string
  bodyAr?: string
  isRead: boolean
  createdAt: string
  data?: any
}

export interface PaginatedNotifications {
  data: NotificationItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
