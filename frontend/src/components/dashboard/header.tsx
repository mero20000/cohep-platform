'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  Menu, X, Cross, ChevronDown, Search, User, Globe, Loader2,
  Bell, LogOut, Settings, Crown, CheckCheck, Building2,
  Calendar as CalendarIcon, Users, ClipboardCheck as ClipboardCheckIcon, Award, Info, GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NotificationItem {
  id: string; type: string; title: string; titleAr?: string; body: string; bodyAr?: string;
  isRead: boolean; createdAt: string; data?: any;
}

interface DashboardHeaderProps {
  lang: 'en' | 'ar'
  sidebarOpen: boolean
  schoolLogo: string | null
  schoolName: string
  schoolNameAr: string
  canSwitchSchool: boolean
  isSuperAdmin: boolean
  effectiveRole: string
  isViewingAs: boolean
  user: { firstName?: string; lastName?: string; email?: string; roles?: string[]; avatarUrl?: string } | null
  displayName: string
  initials: string
  unreadCount: number
  notifications: NotificationItem[]
  notiLoading: boolean
  switchSchools: { id: string; name: string; churchName: string }[]
  activeSchoolId: string | null
  roleOptions: { value: string; label: string; labelAr: string; icon: any }[]
  onSetSidebarOpen: (v: boolean) => void
  onSetShowNotiPanel: (v: boolean) => void
  onSetShowUserMenu: (v: boolean) => void
  showNotiPanel: boolean
  showUserMenu: boolean
  notiRef: React.RefObject<HTMLDivElement | null>
  userMenuRef: React.RefObject<HTMLDivElement | null>
  switchRef: React.RefObject<HTMLDivElement | null>
  roleRef: React.RefObject<HTMLDivElement | null>
  switchOpen: boolean
  roleOpen: boolean
  onSetSwitchOpen: (v: boolean) => void
  onSetRoleOpen: (v: boolean) => void
  onToggleLanguage: () => void
  onSetRole: (role: string) => void
  onClearRole: () => void
  onSetActiveSchool: (id: string | null) => void
  onMarkAllAsRead: () => void
  onMarkAsRead: (id: string) => void
  onSignOut: () => void
  relativeTime: (dateStr: string) => string
  onRefresh: () => void
  isRefreshing: boolean
  lastUpdated: Date
}

export function DashboardHeader({
  lang,
  sidebarOpen,
  schoolLogo,
  schoolName,
  schoolNameAr,
  canSwitchSchool,
  isSuperAdmin,
  effectiveRole,
  isViewingAs,
  user,
  displayName,
  initials,
  unreadCount,
  notifications,
  notiLoading,
  switchSchools,
  activeSchoolId,
  roleOptions,
  onSetSidebarOpen,
  onSetShowNotiPanel,
  onSetShowUserMenu,
  showNotiPanel,
  showUserMenu,
  notiRef,
  userMenuRef,
  switchRef,
  roleRef,
  switchOpen,
  roleOpen,
  onSetSwitchOpen,
  onSetRoleOpen,
  onToggleLanguage,
  onSetRole,
  onClearRole,
  onSetActiveSchool,
  onMarkAllAsRead,
  onMarkAsRead,
  onSignOut,
  relativeTime,
  onRefresh,
  isRefreshing,
  lastUpdated,
}: DashboardHeaderProps) {
  const language = lang
  const router = useRouter()
  const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'
  const [avatarError, setAvatarError] = useState(false)

  const notiIcon = (type: string) => {
    switch (type) {
      case 'attendance': return CalendarIcon
      case 'enrollment': return Users
      case 'assessment': return ClipboardCheckIcon
      case 'badge': return Award
      default: return Info
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" onClick={() => onSetSidebarOpen(true)} aria-label={language === 'ar' ? 'فتح القائمة' : 'Open menu'} aria-expanded={sidebarOpen} aria-controls="sidebar" className="lg:hidden h-9 w-9 text-gray-500 hover:text-gray-700">
        <Menu className="h-5 w-5" />
      </Button>

      <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity">
        {schoolLogo ? (
          <Image src={schoolLogo} alt={language === 'ar' && schoolNameAr ? schoolNameAr : schoolName} width={40} height={40} className="rounded-lg object-cover border border-gray-200 flex-shrink-0" unoptimized />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white flex-shrink-0">
            <Cross className="h-5 w-5" />
          </div>
        )}
        <span className="hidden sm:block text-sm font-bold text-gray-900">{language === 'ar' && schoolNameAr ? schoolNameAr : schoolName}</span>
      </Link>

      <div className="flex-1 flex items-center mx-2">
        <div className="relative w-full max-w-lg">
          <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400`} />
          <input type="text" placeholder={language === 'ar' ? 'بحث بالاسم...' : 'Search by name...'}
            aria-label={language === 'ar' ? 'بحث بالاسم' : 'Search students by name'}
            onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { router.push(`/dashboard/students?search=${encodeURIComponent((e.target as HTMLInputElement).value.trim())}`) } }}
            className={`w-full rounded-lg border border-gray-200 bg-gray-50 ${language === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 text-sm placeholder:text-gray-400 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500`} />
        </div>
      </div>

      {canSwitchSchool && (
        <div ref={switchRef} className="relative">
          <Button variant="outline" size="sm" onClick={() => onSetSwitchOpen(!switchOpen)}
            className="h-auto gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-gold-500" />
            <span className="max-w-[140px] truncate">
              {activeSchoolId
                ? (switchSchools.find(s => s.id === activeSchoolId)?.name || (language === 'ar' ? 'مدرسة' : 'School'))
                : (language === 'ar' ? 'مدرستي' : 'My School')}
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {switchOpen && (
            <div className={`absolute ${language === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-72 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden z-50`}>
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{language === 'ar' ? 'عرض ك' : 'View as'}</p>
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                <button onClick={() => { onSetActiveSchool(null); onSetSwitchOpen(false) }}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 active:bg-gray-100 ${!activeSchoolId ? 'text-blue-700 font-medium bg-blue-50/40' : 'text-gray-700'}`}>
                  <Building2 className="h-4 w-4 text-gold-500 shrink-0" />
                  <span className="truncate">{language === 'ar' ? `مدرستي (${schoolName})` : `My School (${schoolName})`}</span>
                  {!activeSchoolId && <CheckCheck className={`h-4 w-4 ml-auto ${language === 'ar' ? 'mr-auto ml-0' : ''} text-blue-700`} />}
                </button>
                {switchSchools.map(s => (
                  <button key={s.id} onClick={() => { onSetActiveSchool(s.id); onSetSwitchOpen(false) }}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 active:bg-gray-100 ${activeSchoolId === s.id ? 'text-blue-700 font-medium bg-blue-50/40' : 'text-gray-700'}`}>
                    <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="truncate">
                      {s.name}
                      {s.churchName && <span className="block text-[11px] text-gray-400">{s.churchName}</span>}
                    </span>
                    {activeSchoolId === s.id && <CheckCheck className={`h-4 w-4 ml-auto ${language === 'ar' ? 'mr-auto ml-0' : ''} text-blue-700`} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isSuperAdmin && (
        <div ref={roleRef} className="relative">
          <Button variant={isViewingAs ? "default" : "outline"} size="sm" onClick={() => onSetRoleOpen(!roleOpen)}
            className="h-auto gap-1.5">
            <Crown className="h-3.5 w-3.5 text-gold-500" />
            <span className="max-w-[140px] truncate">
              {roleOptions.find(o => o.value === effectiveRole)?.label || effectiveRole}
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {roleOpen && (
            <div className={`absolute ${language === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-64 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden z-50`}>
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{language === 'ar' ? 'عرض لوحة التحكم كـ' : 'View dashboard as'}</p>
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {roleOptions.map(o => {
                  const Icon = o.icon
                  const selected = effectiveRole === o.value
                  return (
                    <button key={o.value} onClick={() => { onSetRole(o.value); onSetRoleOpen(false) }}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 active:bg-gray-100 ${selected ? 'text-blue-700 font-medium bg-blue-50/40' : 'text-gray-700'}`}>
                      <Icon className="h-4 w-4 text-gold-500 shrink-0" />
                      <span className="truncate">{language === 'ar' ? o.labelAr : o.label}</span>
                      {selected && <CheckCheck className={`h-4 w-4 ml-auto ${language === 'ar' ? 'mr-auto ml-0' : ''} text-blue-700`} />}
                    </button>
                  )
                })}
                <div className="px-4 py-2 border-t border-gray-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{language === 'ar' ? 'البوابات' : 'Portals'}</p>
                </div>
                <Link href="/portal/login" onClick={() => onSetRoleOpen(false)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                  <Users className="h-4 w-4 text-gold-500 shrink-0" />
                  <span className="truncate">{language === 'ar' ? 'بوابة ولي الأمر' : 'Parent Portal'}</span>
                </Link>
                <Link href="/student-portal/login" onClick={() => onSetRoleOpen(false)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                  <GraduationCap className="h-4 w-4 text-gold-500 shrink-0" />
                  <span className="truncate">{language === 'ar' ? 'بوابة الطالب' : 'Student Portal'}</span>
                </Link>
                {isViewingAs && (
                  <button onClick={() => { onClearRole(); onSetRoleOpen(false) }}
                    className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-50 active:bg-gray-100">
                    <Crown className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="truncate">{language === 'ar' ? 'العودة لدوري الحقيقي' : 'Back to my real role'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onToggleLanguage}
          className="h-9 w-9 text-gray-500 hover:text-gray-700"
          title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
          <Globe className="h-4 w-4" />
        </Button>

        <div ref={notiRef} className="relative">
          <Button variant="ghost" size="icon" onClick={() => { onSetShowNotiPanel(!showNotiPanel); onSetShowUserMenu(false) }}
            aria-label={language === 'ar' ? 'الإشعارات' : 'Notifications'}
            className="relative h-9 w-9 text-gray-500 hover:text-gray-700">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className={`absolute -top-0.5 ${language === 'ar' ? '-left-0.5' : '-right-0.5'} flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white`}>
                {unreadCount}
              </span>
            )}
          </Button>

          {showNotiPanel && (
            <div className={`absolute ${language === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-80 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden z-50`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">{language === 'ar' ? 'الإشعارات' : 'Notifications'}</h3>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}
                    className="h-auto gap-1 text-xs font-medium text-blue-700 hover:text-blue-700">
                    <CheckCheck className="h-3.5 w-3.5" />
                    {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                  </Button>
                )}
              </div>
              {notiLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-gray-400">
                  {language === 'ar' ? 'لا توجد إشعارات جديدة' : 'No new notifications'}
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.map(n => {
                    const Icon = notiIcon(n.type)
                    return (
                      <button key={n.id} onClick={() => !n.isRead && onMarkAsRead(n.id)}
                        className={`w-full ${language === 'ar' ? 'text-right' : 'text-left'} px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${!n.isRead ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {language === 'ar' && n.titleAr ? n.titleAr : n.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {language === 'ar' && n.bodyAr ? n.bodyAr : n.body}
                            </p>
                            <time className="text-[10px] text-gray-400 mt-1 block">{relativeTime(n.createdAt)}</time>
                          </div>
                          {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              <Link href="/dashboard/notifications"
                className="block px-4 py-2.5 text-center text-xs font-medium text-blue-700 hover:bg-blue-50 border-t border-gray-100 transition-colors">
                {language === 'ar' ? 'عرض كل الإشعارات' : 'View all notifications'}
              </Link>
            </div>
          )}
        </div>

        <div ref={userMenuRef} className="relative">
          <Button variant="ghost" onClick={() => { onSetShowUserMenu(!showUserMenu); onSetShowNotiPanel(false) }}
            aria-label={language === 'ar' ? 'قائمة المستخدم' : 'User menu'}
            className="gap-1.5 px-1.5 h-auto hover:bg-gray-100">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 overflow-hidden">
              {user?.avatarUrl && !avatarError ? (
                <Image src={`${API_ORIGIN}${user.avatarUrl}`} alt="" width={28} height={28} onError={() => setAvatarError(true)} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-blue-700">{initials}</span>
              )}
            </div>
            <span className="hidden sm:block text-sm font-medium text-gray-900 max-w-[120px] truncate">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </Button>

          {showUserMenu && (
            <div className={`absolute ${language === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-56 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden z-50`}>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{user?.email || 'admin@niangelos.app'}</p>
              </div>
              <div className="py-1">
                <Link href="/dashboard/settings" onClick={() => onSetShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                  <User className="h-4 w-4 text-gray-400" /> {language === 'ar' ? 'الملف الشخصي' : 'Profile'}
                </Link>
                <Link href="/dashboard/settings" onClick={() => onSetShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                  <Settings className="h-4 w-4 text-gray-400" /> {language === 'ar' ? 'الإعدادات' : 'Settings'}
                </Link>
              </div>
              <div className="border-t border-gray-100 py-1">
                <Button variant="ghost" onClick={() => { onSetShowUserMenu(false); onSignOut() }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 justify-start">
                  <LogOut className="h-4 w-4" /> {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
