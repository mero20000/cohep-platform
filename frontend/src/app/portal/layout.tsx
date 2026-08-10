'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { LogOut, User, Home, Bell, Menu, X, ChevronDown, Globe, CheckCheck, Loader2, Info, Calendar, Award, ClipboardCheck, UserCheck, Settings, Megaphone, Music } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { track } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { AudioPlayer } from '@/components/audio-player'

interface NotificationItem {
  id: string; type: string; title: string; titleAr?: string; body: string; bodyAr?: string;
  isRead: boolean; createdAt: string;
  data?: { url?: string; audioUrl?: string; lessonId?: string; hymnName?: string };
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; email?: string; roles?: string[]; id?: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showNotiPanel, setShowNotiPanel] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notiLoading, setNotiLoading] = useState(false)
  const [bannerAnnouncement, setBannerAnnouncement] = useState<{ id: string; title: string; titleAr?: string; body: string; bodyAr?: string; priority: string } | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [isResizing, setIsResizing] = useState(false)
  const dragStart = useRef({ x: 0, width: 256 })
  const resizeFrame = useRef<number | null>(null)
  const notiRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const lang = useLanguage()
  const isLoginPage = pathname === '/portal/login'

  useEffect(() => {
    document.title = 'Parent Portal — Coptic Orthodox Hymn Education Platform (COHEP)'
  }, [])

  useEffect(() => {
    if (isLoginPage) return
    const stored = localStorage.getItem('user')
    if (!stored) { router.push('/portal/login'); return }
    try { setUser(JSON.parse(stored)) } catch { router.push('/portal/login') }
  }, [router, isLoginPage])

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', lang)
    const saved = localStorage.getItem('niangelos_portal_sidebar_width')
    if (saved) {
      const w = parseInt(saved, 10)
      if (w >= 180 && w <= 450) { setSidebarWidth(w); dragStart.current.width = w }
    }
  }, [lang])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      if (resizeFrame.current) cancelAnimationFrame(resizeFrame.current)
      resizeFrame.current = requestAnimationFrame(() => {
        const raw = lang === 'ar' ? window.innerWidth - e.clientX : e.clientX
        const clamped = Math.max(180, Math.min(450, raw))
        setSidebarWidth(clamped)
      })
    }
    const handleMouseUp = () => {
      if (!isResizing) return
      setIsResizing(false)
      localStorage.setItem('niangelos_portal_sidebar_width', String(sidebarWidth))
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (resizeFrame.current) cancelAnimationFrame(resizeFrame.current)
    }
  }, [isResizing, lang, sidebarWidth])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) setShowNotiPanel(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleLanguage = () => {
    const newLang = lang === 'en' ? 'ar' : 'en'
    localStorage.setItem('niangelos_language', newLang)
    document.documentElement.setAttribute('dir', newLang === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', newLang)
    window.dispatchEvent(new CustomEvent('langchange', { detail: newLang }))
    track('locale.set', 'locale', { locale: newLang })
  }

  const handleSignOut = () => {
    void fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/auth/logout', {
      method: 'POST', credentials: 'include',
    }).catch(() => {})
    localStorage.removeItem('user')
    router.push('/portal/login')
  }

  const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

  const notiIcon = (type: string) => {
    switch (type) {
      case 'attendance': return Calendar
      case 'enrollment': return UserCheck
      case 'assessment': return ClipboardCheck
      case 'badge': return Award
      case 'practice_guide': return Music
      default: return Info
    }
  }

  const fetchNotifications = useCallback(async () => {
    const userId = user?.email || user?.id || ''
    if (!userId) return
    setNotiLoading(true)
    try {
      const list = await http.get<{ data: NotificationItem[] }>('/notifications', { schoolId: getSchoolId(), userId, limit: '5' })
      setNotifications(list.data || [])
    } catch {}
    setNotiLoading(false)
  }, [user])

  const handleMarkAsRead = async (id: string) => {
    await http.patch(`/notifications/${id}/read`, null, { schoolId: getSchoolId() })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const handleMarkAllAsRead = async () => {
    const userId = user?.email || user?.id || ''
    await http.patch('/notifications/read-all', null, { schoolId: getSchoolId(), userId })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  useEffect(() => { if (user && !isLoginPage) fetchNotifications() }, [user, fetchNotifications, isLoginPage])

  useEffect(() => {
    if (isLoginPage) return
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications, isLoginPage])

  useEffect(() => {
    if (isLoginPage || !user) return
    const sub = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (existing) return
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/vapid-public-key')
        const { key } = await res.json()
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        })
        const json = sub.toJSON()
        const token = localStorage.getItem('niangelos_token')
        await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth }),
        })
      } catch {}
    }
    if ('serviceWorker' in navigator && 'PushManager' in window) sub()
  }, [isLoginPage, user])

  useEffect(() => {
    if (isLoginPage) return
    const dismissed = localStorage.getItem('niangelos_banner_dismissed')
    if (dismissed) setBannerDismissed(dismissed)
    http.get<any[]>('/announcements', { banner: 'true', limit: '1', status: 'published' })
      .then(list => { if (list && list.length > 0) setBannerAnnouncement(list[0]) })
      .catch(() => {})
  }, [isLoginPage])

  const relativeTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return lang === 'ar' ? 'الآن' : 'Just now'
    if (mins < 60) return lang === 'ar' ? `منذ ${mins} د` : `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return lang === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return lang === 'ar' ? `منذ ${days} ي` : `${days}d ago`
  }

  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` : 'P'
  const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}` : 'Parent'
  const unreadCount = notifications.filter(n => !n.isRead).length

  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  if (isLoginPage) return <>{children}</>

  return (
    <div className={`min-h-screen bg-gray-50 ${lang === 'ar' ? 'rtl' : 'ltr'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transform ${isResizing ? 'transition-none' : 'transition-transform duration-200'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} rtl:${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0`}
        style={{ width: sidebarWidth }}>
        <div onMouseDown={(e) => {
            e.preventDefault()
            dragStart.current = { x: lang === 'ar' ? window.innerWidth - e.clientX : e.clientX, width: sidebarWidth }
            setIsResizing(true)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-gold-300/50 active:bg-blue-400/50 z-50" />
        <div className="flex h-16 items-center gap-2.5 border-b border-gray-200 px-5">
          <Image src="/cohep-logo.png" alt="COHEP" width={64} height={64} className="h-16 w-16 rounded-lg object-contain" />
          <span className="text-lg font-bold tracking-tight text-gray-900">{t('Parent Portal', 'بوابة أولياء الأمور')}</span>
          <Button onClick={() => setSidebarOpen(false)} variant="ghost" size="icon" className="lg:hidden ml-auto text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="p-3 space-y-1">
          {[
            { label: 'My Children', labelAr: 'أبنائي', href: '/portal', icon: Home },
            { label: 'Settings', labelAr: 'الإعدادات', href: '/portal/settings', icon: Settings },
          ].map(item => {
            const isActive = pathname === item.href
            return (
              <Link key={item.label} href={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-blue-50 text-blue-700 border-r-2 border-gold-500' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-r-2 border-transparent'}`}>
                <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                {t(item.label, item.labelAr)}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className={`${isResizing ? '' : 'transition-all duration-200'}`}
        style={{ [lang === 'ar' ? 'paddingRight' : 'paddingLeft']: sidebarWidth }}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
          <Button onClick={() => setSidebarOpen(true)} variant="ghost" size="icon" className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          {/* Notification bell */}
          <div ref={notiRef} className="relative">
            <Button onClick={() => { setShowNotiPanel(!showNotiPanel); setShowMenu(false) }}
              variant="ghost"
              size="icon"
              className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {showNotiPanel && (
              <div className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-80 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden z-50`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">{t('Notifications', 'الإشعارات')}</h3>
                  {unreadCount > 0 && (
                    <Button onClick={handleMarkAllAsRead}
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-700">
                      <CheckCheck className="h-3.5 w-3.5" />
                      {t('Mark all read', 'تحديد الكل كمقروء')}
                    </Button>
                  )}
                </div>
                {notiLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gold-500" /></div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-gray-400">{t('No new notifications', 'لا توجد إشعارات جديدة')}</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {notifications.map(n => {
                      const Icon = notiIcon(n.type)
                      return (
                        <Button key={n.id} onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                          variant="ghost"
                          className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} px-4 py-3 hover:bg-gray-50 active:bg-gray-100 ${!n.isRead ? 'bg-blue-50/40' : ''}`}>
                          <div className="flex items-start gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${!n.isRead ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                {lang === 'ar' && n.titleAr ? n.titleAr : n.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                {lang === 'ar' && n.bodyAr ? n.bodyAr : n.body}
                              </p>
                              {n.type === 'practice_guide' && n.data?.audioUrl && (
                                <div className="mt-2" onClick={e => e.stopPropagation()}>
                                  <AudioPlayer src={`${API_ORIGIN}${n.data.audioUrl}`} compact />
                                </div>
                              )}
                              <time className="text-[10px] text-gray-400 mt-1 block">{relativeTime(n.createdAt)}</time>
                            </div>
                            {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
                          </div>
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button onClick={toggleLanguage}
            variant="outline"
            className="flex items-center gap-1.5"
            title={t('Switch language', 'تبديل اللغة')}>
            <Globe className="h-4 w-4" />
            {lang === 'ar' ? 'EN' : 'ع'}
          </Button>

          <div ref={userMenuRef} className="relative">
            <Button onClick={() => { setShowMenu(!showMenu); setShowNotiPanel(false) }}
              variant="ghost"
              className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {initials}
              </div>
              <span className="text-sm font-medium text-gray-900 hidden sm:block">{displayName}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </Button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden z-50">
                <div className="py-1">
                  <Link href="/portal/settings" onClick={() => setShowMenu(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Settings className="h-4 w-4" /> {t('Settings', 'الإعدادات')}
                  </Link>
                  <Button onClick={() => { setShowMenu(false); handleSignOut() }}
                    variant="ghost"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 justify-start">
                    <LogOut className="h-4 w-4" /> {t('Sign Out', 'تسجيل الخروج')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </header>

        {bannerAnnouncement && bannerAnnouncement.id !== bannerDismissed && (
          <div className={`px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 ${bannerAnnouncement.priority === 'urgent' ? '' : ''}`}>
            <div className={`flex items-start gap-3 rounded-xl border p-4 ${bannerAnnouncement.priority === 'urgent' ? 'border-red-200 bg-red-50' : bannerAnnouncement.priority === 'important' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
              <Megaphone className={`h-5 w-5 mt-0.5 flex-shrink-0 ${bannerAnnouncement.priority === 'urgent' ? 'text-red-500' : bannerAnnouncement.priority === 'important' ? 'text-amber-500' : 'text-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${bannerAnnouncement.priority === 'urgent' ? 'text-red-800' : bannerAnnouncement.priority === 'important' ? 'text-amber-800' : 'text-blue-800'}`}>
                  {lang === 'ar' ? (bannerAnnouncement.titleAr || bannerAnnouncement.title) : bannerAnnouncement.title}
                </p>
                <p className={`text-xs mt-0.5 ${bannerAnnouncement.priority === 'urgent' ? 'text-red-600' : bannerAnnouncement.priority === 'important' ? 'text-amber-600' : 'text-blue-600'}`}>
                  {lang === 'ar' ? (bannerAnnouncement.bodyAr || bannerAnnouncement.body) : bannerAnnouncement.body}
                </p>
              </div>
              <Button onClick={() => { setBannerDismissed(bannerAnnouncement.id); localStorage.setItem('niangelos_banner_dismissed', bannerAnnouncement.id) }}
                variant="ghost"
                size="icon"
                className={`flex-shrink-0 ${bannerAnnouncement.priority === 'urgent' ? 'text-red-400 hover:bg-red-100' : bannerAnnouncement.priority === 'important' ? 'text-amber-400 hover:bg-amber-100' : 'text-blue-400 hover:bg-blue-100'}`}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
