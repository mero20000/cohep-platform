'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'

interface BottomNavItem {
  href: string
  name: string
  nameAr: string
  icon: React.ElementType
  badge?: number
  /** Section prefix that keeps this item active on sibling routes (e.g. /dashboard/attendance). */
  activePrefix?: string
}

interface MobileBottomNavProps {
  items: BottomNavItem[]
  lang: 'en' | 'ar'
  /** When set, a "More" button is shown as the last slot and opens the full menu. */
  onMore?: () => void
}

export function MobileBottomNav({ items, lang, onMore }: MobileBottomNavProps) {
  const pathname = usePathname()
  const visible = items.slice(0, onMore ? 4 : 5)

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white border-t border-gray-200 shadow-[0_-1px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      aria-label={lang === 'ar' ? 'التنقل السفلي' : 'Bottom navigation'}
    >
      <div className="flex h-16 items-stretch">
        {visible.map(item => {
          const base = item.activePrefix ?? item.href
          const isActive = pathname === item.href ||
            (base !== '/dashboard' && pathname.startsWith(base))
          const Icon = item.icon
          const badge = item.badge ?? 0
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center transition-colors active:scale-95 ${
                isActive
                  ? 'text-gold-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {badge > 0 && (
                  <span
                    className="absolute -top-1.5 -inset-e-2.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold leading-none text-white"
                    aria-label={lang === 'ar' ? `${badge} عناصر معلقة` : `${badge} pending`}
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-gold-500" />
                )}
              </div>
              <span className="mt-1.5 w-full truncate text-xs font-medium leading-none">
                {lang === 'ar' ? item.nameAr : item.name}
              </span>
            </Link>
          )
        })}
        {onMore && (
          <button
            type="button"
            onClick={onMore}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center text-gray-500 transition-colors hover:text-gray-700 active:scale-95"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="mt-1.5 w-full truncate text-xs font-medium leading-none">
              {lang === 'ar' ? 'المزيد' : 'More'}
            </span>
          </button>
        )}
      </div>
    </nav>
  )
}
