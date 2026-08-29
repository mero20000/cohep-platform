'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Check, Star, ClipboardCheck, Church, Award, XCircle } from 'lucide-react'
import {
  useStudentNotifications,
  useStudentUnreadCount,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type StudentNotification,
  type StudentNotificationType,
} from './notification-hooks'

const ICONS: Record<StudentNotificationType, typeof Bell> = {
  practice_reviewed: Star,
  assessment_graded: ClipboardCheck,
  liturgy_verified: Church,
  liturgy_rejected: XCircle,
  liturgy_clearance: Church,
  badge_awarded: Award,
}

/**
 * The student's notification bell.
 *
 * Until now every event that landed on a student — a review posted, a badge awarded, a
 * liturgy verified or rejected, an assessment graded, clearance to sing granted — was
 * discoverable only by opening the right screen and noticing something had changed.
 */
export function NotificationBell({
  code,
  lang,
  onNavigate,
}: {
  code: string
  lang: 'en' | 'ar'
  /** Called with a portal-relative link so the parent page can switch tabs. */
  onNavigate?: (linkPath: string) => void
}) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: unreadData } = useStudentUnreadCount(code)
  const { data: notifications, isLoading } = useStudentNotifications(code)
  const markRead = useMarkNotificationRead(code)
  const markAllRead = useMarkAllNotificationsRead(code)

  const unread = unreadData?.unread ?? 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const handleClick = (n: StudentNotification) => {
    if (!n.read) markRead.mutate(n.id)
    if (n.linkPath && onNavigate) {
      onNavigate(n.linkPath)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={unread > 0
          ? t(`Notifications, ${unread} unread`, `الإشعارات، ${unread} غير مقروءة`)
          : t('Notifications', 'الإشعارات')}
        aria-expanded={open}
        className="relative rounded-full p-2 text-white/90 transition-colors hover:bg-white/10"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute end-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
          role="dialog"
          aria-label={t('Notifications', 'الإشعارات')}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <h3 className="text-sm font-bold text-gray-900">{t('Notifications', 'الإشعارات')}</h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                {t('Mark all read', 'تحديد الكل كمقروء')}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">{t('Loading…', 'جارٍ التحميل…')}</p>
            ) : !notifications || notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">
                {t('Nothing yet. This is where you will hear about reviews, marks and badges.',
                   'لا شيء بعد. هنا ستعرف عن المراجعات والدرجات والشارات.')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map(n => {
                  const Icon = ICONS[n.type] ?? Bell
                  const title = lang === 'ar' ? (n.titleAr || n.title) : (n.title || n.titleAr)
                  const body = lang === 'ar' ? (n.bodyAr || n.body) : (n.body || n.bodyAr)
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleClick(n)}
                        className={`flex w-full items-start gap-2.5 px-4 py-3 text-start transition-colors hover:bg-gray-50 ${n.read ? '' : 'bg-blue-50/60'}`}
                      >
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.read ? 'text-gray-400' : 'text-blue-600'}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm ${n.read ? 'text-gray-700' : 'font-bold text-gray-900'}`}>{title}</span>
                          {body && <span className="mt-0.5 block text-xs text-gray-500">{body}</span>}
                          <span className="mt-0.5 block text-[10px] text-gray-400">
                            {new Date(n.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                          </span>
                        </span>
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
