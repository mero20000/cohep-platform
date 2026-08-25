'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'

const LABEL_MAP: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'لوحة التحكم'],
  students: ['Students', 'الطلاب'],
  servants: ['Servants', 'الخدام'],
  curriculum: ['Curriculum', 'المنهج'],
  attendance: ['Attendance', 'الحضور'],
  assessments: ['Assessments', 'التقييمات'],
  gamification: ['Gamification', 'الألعاب التحفيزية'],
  settings: ['Settings', 'الإعدادات'],
  parents: ['My Children', 'أولادي'],
  'pending-registrations': ['Registrations', 'التسجيلات'],
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const lang = useLanguage()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const pair = LABEL_MAP[seg]
    const label = pair ? (lang === 'ar' ? pair[1] : pair[0]) : seg.replace(/-/g, ' ')
    const isLast = i === segments.length - 1
    return { href, label, isLast }
  })

  return (
    <nav aria-label={lang === 'ar' ? 'مسار التنقل' : 'Breadcrumb'} className="flex items-center gap-1.5 text-xs text-gray-500 mb-4 overflow-x-auto">
      <Link href="/dashboard" aria-label={lang === 'ar' ? 'الرئيسية' : 'Home'} className="flex items-center gap-1 hover:text-blue-700 transition-colors shrink-0">
        <Home className="h-3 w-3" />
        <span className="hidden sm:inline">{crumbs.length > 1 ? (lang === 'ar' ? 'الرئيسية' : 'Home') : ''}</span>
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5 shrink-0">
          <ChevronRight className="h-3 w-3 text-gray-300" />
          {crumb.isLast ? (
            <span className="font-medium text-gray-900 truncate max-w-[160px]">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-blue-700 transition-colors truncate max-w-[120px]">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
