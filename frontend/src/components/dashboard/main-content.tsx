'use client'

import { RefreshCw } from 'lucide-react'
import { Breadcrumbs } from '../breadcrumb'
import { Button } from '@/components/ui/button'

interface MainContentProps {
  lang: 'en' | 'ar'
  lastUpdated: Date
  isRefreshing: boolean
  onRefresh: () => void
  children: React.ReactNode
}

export function DashboardMainContent({
  lang,
  lastUpdated,
  isRefreshing,
  onRefresh,
  children,
}: MainContentProps) {
  const language = lang

  const timeAgo = (date: Date) => {
    const diff = Date.now() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return language === 'ar' ? 'الآن' : 'Just now'
    if (mins < 60) return language === 'ar' ? `منذ ${mins} د` : `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return language === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return language === 'ar' ? `منذ ${days} ي` : `${days}d ago`
  }

  return (
    <main id="main-content" className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-1">
        <Breadcrumbs />
        <div className="flex items-center gap-2 text-[11px] text-gray-400 shrink-0">
          {isRefreshing && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          <span>{language === 'ar' ? 'آخر تحديث' : 'Updated'} {timeAgo(lastUpdated)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-7 w-7 hover:bg-gray-100 hover:text-blue-700"
            title={language === 'ar' ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <div className="animate-fade-in-up">{children}</div>
    </main>
  )
}
