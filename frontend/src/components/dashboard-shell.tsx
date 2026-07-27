'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '@/lib/use-language'
import {
  LayoutDashboard, Users, BookOpen, Calendar, ClipboardCheck,
  Trophy, Settings, UserCheck, Baby, ClipboardList, Megaphone,
  Crown, Shield, GraduationCap, Layers, Heart, Church,
} from 'lucide-react'
import { HelpButton } from './help-button'
import { useDashboardHotkeys } from '@/hooks/use-hotkeys'
import { getSchoolId } from '@/lib/school'
import { useActiveSchool } from '@/lib/use-active-school'
import { useActiveRole } from '@/lib/use-active-role'
import { http } from '@/lib/http-client'
import { ROLES } from '@/lib/roles'
import { usePermission } from '@/lib/use-permission'
import { DashboardSidebar } from './dashboard/sidebar'
import { DashboardHeader } from './dashboard/header'
import { DashboardBanners } from './dashboard/banners'
import { DashboardMainContent } from './dashboard/main-content'

interface NotificationItem {
  id: string; type: string; title: string; titleAr?: string; body: string; bodyAr?: string;
  isRead: boolean; createdAt: string; data?: any;
}

const navigation = [
  { name: 'Dashboard', nameAr: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Students', nameAr: 'الطلاب', href: '/dashboard/students', icon: Users },
  { name: 'Servants', nameAr: 'الخدام', href: '/dashboard/servants', icon: UserCheck, perm: 'servant:view' as const },
  { name: 'Curriculum', nameAr: 'المنهج', href: '/dashboard/curriculum', icon: BookOpen, perm: 'curriculum:view' as const },
  { name: 'Attendance', nameAr: 'الحضور', href: '/dashboard/attendance', icon: Calendar, perm: 'attendance:view' as const },
  { name: 'Assessments', nameAr: 'التقييمات', href: '/dashboard/assessments', icon: ClipboardCheck, perm: 'assessment:view' as const },
  { name: 'Gamification', nameAr: 'الألعاب التحفيزية', href: '/dashboard/gamification', icon: Trophy, perm: 'gamification:view' as const },
  { name: 'Announcements', nameAr: 'الإعلانات', href: '/dashboard/announcements', icon: Megaphone, perm: 'announcement:view' as const },
  { name: 'Pending Reg.', nameAr: 'تسجيلات معلقة', href: '/dashboard/pending-registrations', icon: ClipboardList, superAdminOnly: true, perm: 'registrations:approve' as const },
]

const secondaryNav = [
  { name: 'Liturgy Verification', nameAr: 'التحقق من القداسات', href: '/dashboard/liturgy', icon: Church },
  { name: 'Settings', nameAr: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
]

const parentsNav = { name: 'My Children', nameAr: 'أولادي', href: '/dashboard/parents', icon: Baby }

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  super_admin: Crown, admin: Shield, principal: GraduationCap,
  curriculum_manager: BookOpen, level_leader: Layers, group_leader: Users,
  servant: Heart, parent: Baby,
}
const ROLE_SWITCH_OPTIONS = ROLES.map(r => ({ value: r.value, label: r.label, labelAr: r.labelAr, icon: ROLE_ICONS[r.value] }))

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; email?: string; roles?: string[]; avatarUrl?: string } | null>(null)
  const [schoolName, setSchoolName] = useState('Coptic Orthodox Hymn Education Platform (COHEP)')
  const [schoolNameAr, setSchoolNameAr] = useState('')
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null)
  const [churchLogo, setChurchLogo] = useState<string | null>(null)
  const [churchName, setChurchName] = useState<string | null>(null)
  const [sidebarWide, setSidebarWide] = useState(true)
  const [autoHide, setAutoHide] = useState(false)
  const [sidebarHover, setSidebarHover] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarHoverTimer = useRef<NodeJS.Timeout | null>(null)
  const dragStart = useRef({ x: 0, width: 256 })
  const resizeFrame = useRef<number | null>(null)
  const [showNotiPanel, setShowNotiPanel] = useState(false)
  const [bannerAnnouncement, setBannerAnnouncement] = useState<{ id: string; title: string; titleAr?: string; body: string; bodyAr?: string; priority: string } | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const language = useLanguage()
  const { activeSchoolId, setActiveSchool } = useActiveSchool()
  const canSwitchSchool = !!user?.roles?.some(r => r === 'super_admin' || r === 'admin')
  const [switchSchools, setSwitchSchools] = useState<{ id: string; name: string; churchName: string }[]>([])
  const [allSchools, setAllSchools] = useState<any[]>([])
  const [allChurches, setAllChurches] = useState<any[]>([])
  const [switchOpen, setSwitchOpen] = useState(false)
  const switchRef = useRef<HTMLDivElement>(null)
  const [roleOpen, setRoleOpen] = useState(false)
  const roleRef = useRef<HTMLDivElement>(null)
  const { effectiveRole, isViewingAs, setRole, clearRole } = useActiveRole()
  const isSuperAdmin = !!user?.roles?.some(r => r === 'super_admin')
  const showParentsNav = isSuperAdmin || effectiveRole === 'parent' || effectiveRole === 'admin' || effectiveRole === 'principal'
  const { can } = usePermission()
  const isParent = effectiveRole === 'parent'
  const mainNav: any[] = isParent
    ? [...navigation.filter((n) => n.name === 'Dashboard'), parentsNav]
    : navigation.filter((item) => {
        if ((item as any).superAdminOnly && !isSuperAdmin) return false
        if ((item as any).perm && !can((item as any).perm)) return false
        return item.href !== parentsNav.href || showParentsNav
      })
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notiLoading, setNotiLoading] = useState(false)
  const notiRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user')
      if (stored) setUser(JSON.parse(stored))
    } catch {}
    const savedTheme = localStorage.getItem('niangelos_theme') || 'light'
    const savedAccent = localStorage.getItem('niangelos_accent') || 'gold'
    const root = document.documentElement
    if (savedTheme === 'dark') root.classList.add('dark')
    else if (savedTheme === 'light') root.classList.remove('dark')
    else { const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; prefersDark ? root.classList.add('dark') : root.classList.remove('dark') }
    root.classList.remove('accent-blue', 'accent-green', 'accent-purple')
    if (savedAccent !== 'gold') root.classList.add(`accent-${savedAccent}`)
    const savedSidebar = localStorage.getItem('niangelos_sidebar')
    setSidebarWide(savedSidebar !== 'expanded')
    const savedAutoHide = localStorage.getItem('niangelos_sidebar_autohide')
    setAutoHide(savedAutoHide === 'true')
    const savedWidth = localStorage.getItem('niangelos_sidebar_width')
    if (savedWidth) {
      const w = parseInt(savedWidth, 10)
      if (w >= 180 && w <= 450) {
        setSidebarWidth(w)
        dragStart.current.width = w
      }
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      if (resizeFrame.current) cancelAnimationFrame(resizeFrame.current)
      resizeFrame.current = requestAnimationFrame(() => {
        const raw = language === 'ar' ? window.innerWidth - e.clientX : e.clientX
        const clamped = Math.max(180, Math.min(450, raw))
        setSidebarWidth(clamped)
      })
    }
    const handleMouseUp = () => {
      if (!isResizing) return
      setIsResizing(false)
      localStorage.setItem('niangelos_sidebar_width', String(sidebarWidth))
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
  }, [isResizing, language, sidebarWidth])

  useEffect(() => {
    if (!canSwitchSchool) return
    const churchMap = new Map(allChurches.map((c: any) => [c.id, c.name || c.nameAr || '']))
    const list = allSchools.map((s: any) => ({
      id: s.id,
      name: s.name || '',
      churchName: (s.churchId && churchMap.get(s.churchId)) || '',
    }))
    setSwitchSchools(list)
  }, [canSwitchSchool, allSchools, allChurches])

  useEffect(() => {
    http.get<any>('/users/schools/me')
      .then((s) => {
        if (s?.name) setSchoolName(s.name)
        if (s?.nameAr) setSchoolNameAr(s.nameAr)
        if (s?.logoUrl) setSchoolLogo(API_ORIGIN + s.logoUrl)
        else setSchoolLogo(null)
        if (s?.church) {
          if (s.church.logoUrl) setChurchLogo(API_ORIGIN + s.church.logoUrl)
          else setChurchLogo(null)
          if (s.church.name) setChurchName(s.church.name)
          if (s.church.schoolNameEn) setSchoolName(s.church.schoolNameEn)
          if (s.church.schoolNameAr) setSchoolNameAr(s.church.schoolNameAr)
        } else {
          setChurchLogo(null)
          setChurchName(null)
        }
      })
      .catch(() => console.warn('Failed to fetch school identity'))

    if (!canSwitchSchool) return
    Promise.all([
      http.get<any[]>('/users/schools'),
      http.get<any[]>('/churches'),
    ]).then(([schools, churches]) => {
      setAllSchools(Array.isArray(schools) ? schools.filter((s: any) => s.isActive !== false) : [])
      setAllChurches(Array.isArray(churches) ? churches : [])
    }).catch(() => console.warn('Failed to fetch school data'))
  }, [canSwitchSchool])

  useEffect(() => {
    if (allSchools.length === 0) return
    const s = (activeSchoolId && allSchools.find(x => x.id === activeSchoolId)) || allSchools[0]
    if (!s) return
    if (s.name) setSchoolName(s.name)
    if (s.nameAr) setSchoolNameAr(s.nameAr)
    if (s.logoUrl) setSchoolLogo(API_ORIGIN + s.logoUrl)
    else setSchoolLogo(null)
    const church = s.churchId ? allChurches.find((c: any) => c.id === s.churchId) : null
    if (church) {
      if (church.logoUrl) setChurchLogo(API_ORIGIN + church.logoUrl)
      else setChurchLogo(null)
      if (church.name) setChurchName(church.name)
      if (church.schoolNameEn) setSchoolName(church.schoolNameEn)
      if (church.schoolNameAr) setSchoolNameAr(church.schoolNameAr)
    } else {
      setChurchLogo(null)
      setChurchName(null)
    }
  }, [activeSchoolId, allSchools, allChurches])

  const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'

  const applyLanguage = (lang: 'en' | 'ar') => {
    const root = document.documentElement
    root.setAttribute('lang', lang)
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
  }

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ar' : 'en'
    localStorage.setItem('niangelos_language', newLang)
    applyLanguage(newLang)
    window.dispatchEvent(new CustomEvent('langchange', { detail: newLang }))
  }

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return language === 'ar' ? 'الآن' : 'Just now'
    if (mins < 60) return language === 'ar' ? `منذ ${mins} د` : `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return language === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return language === 'ar' ? `منذ ${days} ي` : `${days}d ago`
  }

  const fetchNotifications = useCallback(async () => {
    const userId = user?.email || ''
    if (!userId) return
    setNotiLoading(true)
    try {
      const list = await http.get<{ data: NotificationItem[] }>('/notifications', { schoolId: getSchoolId(), userId, limit: '10' })
      setNotifications(list.data || [])
      setLastUpdated(new Date())
    } catch {}
    setNotiLoading(false)
  }, [user])

  useEffect(() => { if (user) fetchNotifications() }, [user, fetchNotifications])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    const start = () => { interval = setInterval(fetchNotifications, 30000) }
    const stop = () => clearInterval(interval)
    const onVis = () => { document.hidden ? stop() : start() }
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [fetchNotifications])

  useEffect(() => {
    const dismissed = localStorage.getItem('niangelos_banner_dismissed')
    if (dismissed) setBannerDismissed(dismissed)
    http.get<{ data: { id: string; title: string; titleAr?: string; body: string; bodyAr?: string; priority: string }[] }>('/announcements', { schoolId: getSchoolId(), status: 'published', limit: '1' })
      .then(d => { if (d.data?.[0]) setBannerAnnouncement(d.data[0]) })
      .catch(() => {
        try {
          const stored = JSON.parse(localStorage.getItem('niangelos_announcements') || '[]')
          const published = stored.filter((a: any) => a.publishedAt).sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
          if (published.length) setBannerAnnouncement(published[0])
        } catch {}
      })
  }, [])

  useEffect(() => {
    if (schoolName && schoolName !== 'Coptic Orthodox Hymn Education Platform (COHEP)') {
      document.title = document.title.replace(/[-—] Coptic Orthodox Hymn Education Platform \(COHEP\)$/, ` — ${schoolName}`)
    }
  }, [schoolName, pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) setShowNotiPanel(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
      if (switchRef.current && !switchRef.current.contains(e.target as Node)) setSwitchOpen(false)
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSignOut = () => {
    void fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    localStorage.removeItem('user')
    localStorage.removeItem('niangelos_active_school')
    router.push('/auth/login')
  }

  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` : 'AU'
  const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}` : 'Admin User'
  const unreadCount = notifications.filter(n => !n.isRead).length
  const sidebarVisible = !autoHide || sidebarHover
  useDashboardHotkeys()

  const handleMarkAsRead = async (id: string) => {
    await http.patch(`/notifications/${id}/read`, null, { schoolId: getSchoolId() })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const handleMarkAllAsRead = async () => {
    const userId = user?.email || ''
    await http.patch('/notifications/read-all', null, { schoolId: getSchoolId(), userId })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const startHoverTimer = () => {
    if (sidebarHoverTimer.current) clearTimeout(sidebarHoverTimer.current)
    setSidebarHover(true)
  }
  const stopHoverTimer = () => {
    if (sidebarHoverTimer.current) clearTimeout(sidebarHoverTimer.current)
    sidebarHoverTimer.current = setTimeout(() => setSidebarHover(false), 500)
  }

  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault()
    dragStart.current = { x: language === 'ar' ? window.innerWidth - e.clientX : e.clientX, width: sidebarWidth }
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 800)
    window.dispatchEvent(new CustomEvent('dashboard-refresh'))
  }

  const handleDismissBanner = (id: string) => {
    setBannerDismissed(id)
    localStorage.setItem('niangelos_banner_dismissed', id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-gold-300">
        {language === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {autoHide && !sidebarHover && (
        <div className={`fixed ${language === 'ar' ? 'right-0' : 'left-0'} top-0 bottom-0 w-2 z-50 lg:block hidden cursor-pointer`}
          onMouseEnter={startHoverTimer} />
      )}

      <DashboardSidebar
        lang={language}
        sidebarWidth={sidebarWidth}
        isResizing={isResizing}
        sidebarVisible={sidebarVisible}
        sidebarOpen={sidebarOpen}
        schoolLogo={schoolLogo}
        schoolName={schoolName}
        schoolNameAr={schoolNameAr}
        mainNav={mainNav}
        secondaryNav={secondaryNav}
        pathname={pathname}
        isParent={isParent}
        autoHide={autoHide}
        onStartResize={handleStartResize}
        onSetSidebarOpen={setSidebarOpen}
        onSetAutoHide={setAutoHide}
        onSignOut={handleSignOut}
        onMouseEnter={startHoverTimer}
        onMouseLeave={stopHoverTimer}
      />

      <div className={`${isResizing ? 'transition-none' : 'transition-all duration-200'}`}
        style={{ [language === 'ar' ? 'paddingRight' : 'paddingLeft']: autoHide ? 0 : sidebarWidth }}>
        <DashboardHeader
          lang={language}
          sidebarOpen={sidebarOpen}
          schoolLogo={schoolLogo}
          schoolName={schoolName}
          schoolNameAr={schoolNameAr}
          canSwitchSchool={canSwitchSchool}
          isSuperAdmin={isSuperAdmin}
          effectiveRole={effectiveRole}
          isViewingAs={isViewingAs}
          user={user}
          displayName={displayName}
          initials={initials}
          unreadCount={unreadCount}
          notifications={notifications}
          notiLoading={notiLoading}
          switchSchools={switchSchools}
          activeSchoolId={activeSchoolId}
          roleOptions={ROLE_SWITCH_OPTIONS}
          onSetSidebarOpen={setSidebarOpen}
          onSetShowNotiPanel={setShowNotiPanel}
          onSetShowUserMenu={setShowUserMenu}
          showNotiPanel={showNotiPanel}
          showUserMenu={showUserMenu}
          notiRef={notiRef}
          userMenuRef={userMenuRef}
          switchRef={switchRef}
          roleRef={roleRef}
          switchOpen={switchOpen}
          roleOpen={roleOpen}
          onSetSwitchOpen={setSwitchOpen}
          onSetRoleOpen={setRoleOpen}
          onToggleLanguage={toggleLanguage}
          onSetRole={setRole}
          onClearRole={clearRole}
          onSetActiveSchool={setActiveSchool}
          onMarkAllAsRead={handleMarkAllAsRead}
          onMarkAsRead={handleMarkAsRead}
          onSignOut={handleSignOut}
          relativeTime={relativeTime}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
        />

        <DashboardBanners
          lang={language}
          canSwitchSchool={canSwitchSchool}
          activeSchoolId={activeSchoolId}
          isViewingAs={isViewingAs}
          effectiveRole={effectiveRole}
          switchSchools={switchSchools}
          roleOptions={ROLE_SWITCH_OPTIONS}
          bannerAnnouncement={bannerAnnouncement}
          bannerDismissed={bannerDismissed}
          onSetActiveSchool={setActiveSchool}
          onClearRole={clearRole}
          onDismissBanner={handleDismissBanner}
        />

        <DashboardMainContent
          lang={language}
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        >
          {children}
        </DashboardMainContent>
      </div>

      <HelpButton />
    </div>
  )
}
