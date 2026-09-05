'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface BottomNavItem {
  href: string
  name: string
  nameAr: string
  icon: React.ElementType
}

interface MobileBottomNavProps {
  items: BottomNavItem[]
  lang: 'en' | 'ar'
}

export function MobileBottomNav({ items, lang }: MobileBottomNavProps) {
  const pathname = usePathname()
  // Show max 5 items
  const visible = items.slice(0, 5)

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white border-t border-gray-200 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]"
      aria-label={lang === 'ar' ? 'التنقل السفلي' : 'Bottom navigation'}
    >
      <div className="flex h-16 items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {visible.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-center transition-colors active:scale-95 ${
                isActive
                  ? 'text-gold-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'text-gold-600' : 'text-gray-400'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-gold-500" />
                )}
              </div>
              <span className={`text-[10px] font-medium leading-none mt-1.5 ${isActive ? 'text-gold-600' : 'text-gray-400'}`}>
                {lang === 'ar' ? item.nameAr : item.name}
              </span>
            </Link>
          )
        })}
      </div>
      {/* Safe area padding for notched phones */}
      <div className="bg-white pb-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
