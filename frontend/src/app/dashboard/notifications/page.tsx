'use client'
import { useState, useEffect, useCallback } from 'react'
import { Bell, Filter, X, CheckCheck, Info, Calendar, Award, ClipboardCheck, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/skeleton'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { type NotificationItem, type PaginatedNotifications } from './_components/notification-types'

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  attendance: Calendar, enrollment: UserCheck, assessment: ClipboardCheck, badge: Award, info: Info,
}

const TYPE_LABEL: Record<string, { en: string; ar: string }> = {
  attendance: { en: 'Attendance', ar: 'حضور' },
  enrollment: { en: 'Enrollment', ar: 'تسجيل' },
  assessment: { en: 'Assessment', ar: 'تقييم' },
  badge: { en: 'Badge', ar: 'شارة' },
  info: { en: 'Info', ar: 'معلومات' },
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [list, setList] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterRead, setFilterRead] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user')
      if (stored) setUser(JSON.parse(stored))
    } catch {}
  }, [])

  const fetchList = useCallback(async (p = 1) => {
    if (!user?.email) return
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(p), limit: '20', schoolId: getSchoolId(), userId: user.email,
      }
      if (filterRead) params.read = filterRead
      if (filterType) params.type = filterType
      const data = await http.get<PaginatedNotifications>('/notifications', params)
      setList(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch { toast('error', t('Failed to load notifications', 'فشل تحميل الإشعارات')) }
    setLoading(false)
  }, [user, filterRead, filterType])

  useEffect(() => { fetchList(page) }, [page, fetchList])

  const handleMarkRead = async (id: string) => {
    await http.patch(`/notifications/${id}/read`, null, { schoolId: getSchoolId() })
    setList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const handleMarkAllRead = async () => {
    await http.patch('/notifications/read-all', null, { schoolId: getSchoolId(), userId: user?.email || '' })
    setList(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return lang === 'ar' ? 'الآن' : 'Just now'
    if (mins < 60) return lang === 'ar' ? `منذ ${mins} د` : `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return lang === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return lang === 'ar' ? `منذ ${days} ي` : `${days}d ago`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Notifications', 'الإشعارات')}</h1>
          <p className="text-sm text-gray-500">{total} {t('notifications', 'إشعار')}</p>
        </div>
        {list.some(n => !n.isRead) && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}
            >
            <CheckCheck className="h-4 w-4" />{t('Mark All Read', 'تحديد الكل كمقروء')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500"><Filter className="h-4 w-4" />{t('Filters', 'فلتر')}</div>
        <select value={filterRead} onChange={e => { setFilterRead(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
          <option value="">{t('All', 'الكل')}</option>
          <option value="unread">{t('Unread', 'غير مقروء')}</option>
          <option value="read">{t('Read', 'مقروء')}</option>
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
          <option value="">{t('All types', 'كل الأنواع')}</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
          ))}
        </select>
        {(filterRead || filterType) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterRead(''); setFilterType(''); setPage(1) }}
            >
            <X className="h-3.5 w-3.5" />{t('Clear', 'مسح')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="px-4 py-16"><TableSkeleton rows={6} cols={3} /></div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Bell className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{t('No notifications', 'لا توجد إشعارات')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="divide-y divide-gray-100">
            {list.map(n => {
              const Icon = TYPE_ICON[n.type] || Info
              const tl = TYPE_LABEL[n.type]
              return (
                <div key={n.id}
                  className={`flex items-start gap-4 px-4 py-4 transition-colors ${n.isRead ? '' : 'bg-blue-50/40'} hover:bg-gray-50/50`}>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 ${n.isRead ? 'bg-gray-100' : 'bg-blue-100'}`}>
                    <Icon className={`h-4 w-4 ${n.isRead ? 'text-gray-400' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm ${n.isRead ? 'text-gray-700' : 'font-medium text-gray-900'}`}>
                          {lang === 'ar' ? (n.titleAr || n.title) : n.title}
                        </p>
                        {tl && <span className="text-[11px] text-gray-400">{lang === 'ar' ? tl.ar : tl.en}</span>}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{lang === 'ar' ? (n.bodyAr || n.body) : n.body}</p>
                  </div>
                  {!n.isRead && (
                    <Button variant="ghost" size="icon" onClick={() => handleMarkRead(n.id)}
                      >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                >{t('Previous', 'السابق')}</Button>
              <span className="text-sm text-gray-500">{t('Page', 'صفحة')} {page} / {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                >{t('Next', 'التالي')}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
