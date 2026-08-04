'use client'

import { useState, lazy, Suspense, useMemo, useRef, ComponentType, KeyboardEvent } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Settings, User, Bell, Shield, Globe, Palette,
  Layers, Church, Book, CalendarDays, Users, Building, GraduationCap, Star, Key as KeyIcon, Search, ChevronDown,
} from 'lucide-react'
import { useLanguage } from '@/lib/use-language'

const ProfileTab = lazy(() => import('./_components/profile-tab').then(m => ({ default: m.ProfileTab }))) as ComponentType
const SchoolTab = lazy(() => import('./_components/school-tab').then(m => ({ default: m.SchoolTab }))) as ComponentType
const ChurchesTab = lazy(() => import('./_components/churches-tab').then(m => ({ default: m.ChurchesTab }))) as ComponentType
const GroupsTab = lazy(() => import('./_components/groups-tab').then(m => ({ default: m.GroupsTab }))) as ComponentType
const LevelsTab = lazy(() => import('./_components/levels-tab').then(m => ({ default: m.LevelsTab }))) as ComponentType
const SubjectsTab = lazy(() => import('./_components/subjects-tab').then(m => ({ default: m.SubjectsTab }))) as ComponentType
const CalendarTab = lazy(() => import('./_components/calendar-tab').then(m => ({ default: m.CalendarTab }))) as ComponentType
const UsersTab = lazy(() => import('./_components/users-tab').then(m => ({ default: m.UsersTab }))) as ComponentType
const RolesPermissionsTab = lazy(() => import('./_components/roles-permissions-tab').then(m => ({ default: m.RolesPermissionsTab }))) as ComponentType
const SecurityTab = lazy(() => import('./_components/security-tab').then(m => ({ default: m.SecurityTab }))) as ComponentType
const NotificationsTab = lazy(() => import('./_components/notifications-tab').then(m => ({ default: m.NotificationsTab }))) as ComponentType
const LanguageTab = lazy(() => import('./_components/language-tab').then(m => ({ default: m.LanguageTab }))) as ComponentType
const AppearanceTab = lazy(() => import('./_components/appearance-tab').then(m => ({ default: m.AppearanceTab }))) as ComponentType
const GradesTab = lazy(() => import('./_components/grades-tab').then(m => ({ default: m.GradesTab }))) as ComponentType
const PointSystemTab = lazy(() => import('./_components/point-system-tab').then(m => ({ default: m.PointSystemTab }))) as ComponentType


interface TabItem { id: string; name: string; icon: any }
interface Category { label: string; items: TabItem[] }

function SettingsContent() {
  const lang = useLanguage()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Save-state: the active tab lives in the URL, so it survives refresh,
  // browser back/forward, and can be deep-linked.
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? 'profile')
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const tabsRef = useRef<Record<string, HTMLButtonElement | null>>({})

  const categories: Category[] = [
    {
      label: lang === 'ar' ? 'شخصي' : 'Personal',
      items: [
        { id: 'profile', name: lang === 'ar' ? 'الملف الشخصي' : 'Profile', icon: User },
        { id: 'security', name: lang === 'ar' ? 'الأمان' : 'Security', icon: Shield },
        { id: 'language', name: lang === 'ar' ? 'اللغة والمنطقة' : 'Language & Region', icon: Globe },
        { id: 'appearance', name: lang === 'ar' ? 'المظهر' : 'Appearance', icon: Palette },
      ],
    },
    {
      label: lang === 'ar' ? 'المدرسة' : 'School',
      items: [
        { id: 'school', name: lang === 'ar' ? 'إعدادات المدرسة' : 'School Settings', icon: Building },
        { id: 'churches', name: lang === 'ar' ? 'الكنائس' : 'Churches', icon: Church },
        { id: 'grades', name: lang === 'ar' ? 'الصفوف الدراسية' : 'Grades', icon: GraduationCap },
      ],
    },
    {
      label: lang === 'ar' ? 'أكاديمي' : 'Academic',
      items: [
        { id: 'levels', name: lang === 'ar' ? 'المستويات' : 'Levels', icon: GraduationCap },
        { id: 'groups', name: lang === 'ar' ? 'المجموعات' : 'Groups', icon: Layers },
        { id: 'subjects', name: lang === 'ar' ? 'المواد الدراسية' : 'Curriculum Subjects', icon: Book },
        { id: 'calendar', name: lang === 'ar' ? 'التقويم الأكاديمي' : 'Academic Calendar', icon: CalendarDays },
        { id: 'points', name: lang === 'ar' ? 'نظام النقاط' : 'Point System', icon: Star },
      ],
    },
    {
      label: lang === 'ar' ? 'النظام' : 'System',
      items: [
        { id: 'users', name: lang === 'ar' ? 'المستخدمين' : 'Users', icon: Users },
        { id: 'roles', name: lang === 'ar' ? 'الأدوار والصلاحيات' : 'Roles & Permissions', icon: KeyIcon },
        { id: 'notifications', name: lang === 'ar' ? 'الإشعارات' : 'Notifications', icon: Bell },
      ],
    },
  ]

  // Progressive disclosure: filter the tab wall as the user types.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories
      .map(cat => ({ ...cat, items: cat.items.filter(it => it.name.toLowerCase().includes(q)) }))
      .filter(cat => cat.items.length > 0)
  }, [categories, query])

  const allIds = useMemo(() => visible.flatMap(cat => cat.items.map(it => it.id)), [visible])

  const selectTab = (id: string) => {
    setActiveTab(id)
    router.replace(`/dashboard/settings?tab=${id}`, { scroll: false })
  }

  // Keyboard roving: arrow keys move between tabs, Home/End jump to the ends.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = allIds.indexOf(activeTab)
    if (idx < 0) return
    let next: string | null = null
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = allIds[(idx + 1) % allIds.length]
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        next = allIds[(idx - 1 + allIds.length) % allIds.length]
        break
      case 'Home':
        next = allIds[0]
        break
      case 'End':
        next = allIds[allIds.length - 1]
        break
      default:
        return
    }
    e.preventDefault()
    selectTab(next)
    tabsRef.current[next]?.focus()
  }

  const toggleCategory = (label: string) => setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</h1>
        <p className="text-sm text-gray-500">{lang === 'ar' ? 'إدارة حسابك والكنائس وتفضيلات المنصة' : 'Manage your account, churches, and platform preferences'}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'البحث في الإعدادات…' : 'Search settings…'}
              aria-label={lang === 'ar' ? 'البحث في الإعدادات' : 'Search settings'}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
          <nav role="tablist" aria-label="Settings tabs" aria-orientation="vertical" onKeyDown={onKeyDown}>
            {visible.map((category) => {
              const isCollapsed = collapsed[category.label]
              return (
                <div key={category.label} className="mb-4 last:mb-0">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.label)}
                    aria-expanded={!isCollapsed}
                    className="mb-1 flex w-full items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600"
                  >
                    <span>{category.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {category.items.map((item) => (
                        <button key={item.id} ref={el => { tabsRef.current[item.id] = el }} onClick={() => selectTab(item.id)}
                          role="tab"
                          tabIndex={activeTab === item.id ? 0 : -1}
                          aria-selected={activeTab === item.id}
                          aria-controls={`panel-${item.id}`}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            activeTab === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}>
                          <item.icon className={`h-4 w-4 shrink-0 ${activeTab === item.id ? 'text-blue-700' : 'text-gray-400'}`} />
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {visible.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500">{lang === 'ar' ? 'لا توجد نتائج' : 'No results'}</p>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={activeTab}>
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" /></div>}>
              {activeTab === 'profile' && <ProfileTab />}
              {activeTab === 'school' && <SchoolTab />}
              {activeTab === 'churches' && <ChurchesTab />}
              {activeTab === 'grades' && <GradesTab />}
              {activeTab === 'points' && <PointSystemTab />}
              {activeTab === 'levels' && <LevelsTab />}
              {activeTab === 'groups' && <GroupsTab />}
              {activeTab === 'subjects' && <SubjectsTab />}
              {activeTab === 'calendar' && <CalendarTab />}
              {activeTab === 'users' && <UsersTab />}
              {activeTab === 'roles' && <RolesPermissionsTab />}
              {activeTab === 'security' && <SecurityTab />}
              {activeTab === 'notifications' && <NotificationsTab />}
              {activeTab === 'language' && <LanguageTab />}
              {activeTab === 'appearance' && <AppearanceTab />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" /></div>}>
      <SettingsContent />
    </Suspense>
  )
}
