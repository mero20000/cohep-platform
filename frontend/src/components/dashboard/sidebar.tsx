'use client'

import Link from 'next/link'
import Image from 'next/image'
import { X, Cross, LogOut, PanelLeftClose, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardSidebarProps {
  lang: 'en' | 'ar'
  sidebarWidth: number
  isResizing: boolean
  sidebarVisible: boolean
  sidebarOpen: boolean
  schoolLogo: string | null
  schoolName: string
  schoolNameAr: string
  mainNav: any[]
  secondaryNav: any[]
  pathname: string
  isParent: boolean
  autoHide: boolean
  onStartResize: (e: React.MouseEvent) => void
  onSetSidebarOpen: (v: boolean) => void
  onSetAutoHide: (v: boolean) => void
  onSignOut: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function DashboardSidebar({
  lang,
  sidebarWidth,
  isResizing,
  sidebarVisible,
  sidebarOpen,
  schoolLogo,
  schoolName,
  schoolNameAr,
  mainNav,
  secondaryNav,
  pathname,
  isParent,
  autoHide,
  onStartResize,
  onSetSidebarOpen,
  onSetAutoHide,
  onSignOut,
  onMouseEnter,
  onMouseLeave,
}: DashboardSidebarProps) {
  const language = lang
  const dragStart = { x: 0, width: sidebarWidth }

  return (
    <aside onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      className={`fixed inset-y-0 z-50 bg-white border-gray-200 transform ${isResizing ? 'transition-none' : 'transition-all duration-300 ease-in-out'} ${
        language === 'ar'
          ? 'border-l lg:right-0'
          : 'border-r lg:left-0'
      } ${sidebarOpen ? 'translate-x-0' : language === 'ar' ? 'translate-x-full' : '-translate-x-full'} lg:translate-x-0 ${
        sidebarVisible ? '' : `lg:${language === 'ar' ? 'translate-x-[100%]' : 'translate-x-[-100%]'} overflow-hidden`
      }`}
      style={{ width: sidebarVisible ? sidebarWidth : 0 }}>
      {sidebarVisible && (
        <div
          onMouseDown={(e) => onStartResize(e)}
          className={`absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-gold-300/50 active:bg-blue-400/50 z-50 ${language === 'ar' ? 'left-0' : 'right-0'}`}
        />
      )}
      <div className="border-b border-gray-200">
        <div className="flex items-center gap-2.5 px-5 pt-3 pb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white flex-shrink-0">
            <Cross className="h-4 w-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold tracking-tight truncate">COHEP</span>
            <span className="text-[10px] text-gray-500 truncate leading-tight">Coptic Orthodox Hymn Education Platform</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onSetSidebarOpen(false)} aria-label={language === 'ar' ? 'إغلاق' : 'Close sidebar'} className={`lg:hidden text-gray-400 hover:text-gray-600 h-7 w-7 ${language === 'ar' ? 'mr-auto' : 'ml-auto'}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 px-5 pb-3">
          {schoolLogo ? (
            <Image src={schoolLogo} alt={language === 'ar' && schoolNameAr ? schoolNameAr : schoolName} width={18} height={18} className="rounded object-cover border border-gray-200 flex-shrink-0" />
          ) : null}
          <span className="text-xs font-medium text-gray-600 truncate">{language === 'ar' && schoolNameAr ? schoolNameAr : schoolName}</span>
        </div>
      </div>

      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
        <nav aria-label={language === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'} className="flex-1 px-3 py-4 space-y-1">
          {mainNav.map((item: any) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.name} href={item.href} onClick={() => onSetSidebarOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive ? `bg-blue-50 text-blue-700 ${language === 'ar' ? 'border-l-2' : 'border-r-2'} border-gold-500` : `text-gray-600 hover:bg-gray-100 hover:text-gray-900 ${language === 'ar' ? 'border-l-2' : 'border-r-2'} border-transparent`}`}>
                <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                {language === 'ar' ? item.nameAr || item.name : item.name}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-gray-200 p-3 space-y-1">
          <nav aria-label={language === 'ar' ? 'قائمة الإعدادات' : 'Settings navigation'}>
          {!isParent && secondaryNav.map((item: any) => (
            <Link key={item.name} href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              <item.icon className="h-5 w-5 text-gray-400" />
              {language === 'ar' ? item.nameAr || item.name : item.name}
            </Link>
          ))}
          <Button variant="ghost" onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors justify-start">
            <LogOut className="h-5 w-5 text-gray-400" />
            {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
          </Button>
          <Button variant="ghost" onClick={() => { onSetAutoHide(!autoHide); localStorage.setItem('niangelos_sidebar_autohide', String(!autoHide)) }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors justify-start"
            title={language === 'ar' ? (autoHide ? 'إخفاء تلقائي: تشغيل (حرك المؤشر للإظهار)' : 'إخفاء تلقائي: إيقاف (الشريط الجانبي ظاهر دائمًا)') : (autoHide ? 'Auto-hide: ON (hover edge to show)' : 'Auto-hide: OFF (sidebar always visible)')}>
            {autoHide ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            {autoHide ? (language === 'ar' ? 'إخفاء تلقائي: تشغيل' : 'Auto-hide: ON') : (language === 'ar' ? 'إخفاء تلقائي: إيقاف' : 'Auto-hide: OFF')}
          </Button>
          </nav>
        </div>
      </div>
    </aside>
  )
}
