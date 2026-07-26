'use client'

import { useState, lazy, Suspense, ComponentType } from 'react'
import {
  Settings, User, Bell, Shield, Globe, Palette,
  Layers, Church, Book, CalendarDays, Users, Building, GraduationCap, Star, Key as KeyIcon,
} from 'lucide-react'
import { useLanguage } from '@/lib/use-language'

const ProfileTab = lazy(() => import('./_components/profile-tab').then(m => ({ default: m.ProfileTab }))) as ComponentType<{}>
const SchoolTab = lazy(() => import('./_components/school-tab').then(m => ({ default: m.SchoolTab }))) as ComponentType<{}>
const ChurchesTab = lazy(() => import('./_components/churches-tab').then(m => ({ default: m.ChurchesTab }))) as ComponentType<{}>
const GroupsTab = lazy(() => import('./_components/groups-tab').then(m => ({ default: m.GroupsTab }))) as ComponentType<{}>
const LevelsTab = lazy(() => import('./_components/levels-tab').then(m => ({ default: m.LevelsTab }))) as ComponentType<{}>
const SubjectsTab = lazy(() => import('./_components/subjects-tab').then(m => ({ default: m.SubjectsTab }))) as ComponentType<{}>
const CalendarTab = lazy(() => import('./_components/calendar-tab').then(m => ({ default: m.CalendarTab }))) as ComponentType<{}>
const UsersTab = lazy(() => import('./_components/users-tab').then(m => ({ default: m.UsersTab }))) as ComponentType<{}>
const RolesPermissionsTab = lazy(() => import('./_components/roles-permissions-tab').then(m => ({ default: m.RolesPermissionsTab }))) as ComponentType<{}>
const SecurityTab = lazy(() => import('./_components/security-tab').then(m => ({ default: m.SecurityTab }))) as ComponentType<{}>
const NotificationsTab = lazy(() => import('./_components/notifications-tab').then(m => ({ default: m.NotificationsTab }))) as ComponentType<{}>
const LanguageTab = lazy(() => import('./_components/language-tab').then(m => ({ default: m.LanguageTab }))) as ComponentType<{}>
const AppearanceTab = lazy(() => import('./_components/appearance-tab').then(m => ({ default: m.AppearanceTab }))) as ComponentType<{}>
const GradesTab = lazy(() => import('./_components/grades-tab').then(m => ({ default: m.GradesTab }))) as ComponentType<{}>
const PointSystemTab = lazy(() => import('./_components/point-system-tab').then(m => ({ default: m.PointSystemTab }))) as ComponentType<{}>

export default function SettingsPage() {
  const lang = useLanguage()
  const [activeTab, setActiveTab] = useState('profile')

  const categories = [
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</h1>
        <p className="text-sm text-gray-500">{lang === 'ar' ? 'إدارة حسابك والكنائس وتفضيلات المنصة' : 'Manage your account, churches, and platform preferences'}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav role="tablist" aria-label="Settings tabs">
            {categories.map((category, ci) => (
              <div key={ci} className="mb-4 last:mb-0">
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{category.label}</p>
                <div className="space-y-0.5">
                  {category.items.map((item) => (
                    <button key={item.id} onClick={() => setActiveTab(item.id)}
                      role="tab"
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
              </div>
            ))}
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
