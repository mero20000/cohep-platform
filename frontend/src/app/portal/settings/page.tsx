'use client'

import { useState, lazy, Suspense, ComponentType } from 'react'
import { User, Shield, Globe, Palette, Bell } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import { NotificationPreferencesTab } from './_components/notification-preferences-tab'

const ProfileTab = lazy(() => import('@/app/dashboard/settings/_components/profile-tab').then(m => ({ default: m.ProfileTab }))) as ComponentType
const SecurityTab = lazy(() => import('@/app/dashboard/settings/_components/security-tab').then(m => ({ default: m.SecurityTab }))) as ComponentType
const LanguageTab = lazy(() => import('@/app/dashboard/settings/_components/language-tab').then(m => ({ default: m.LanguageTab }))) as ComponentType
const AppearanceTab = lazy(() => import('@/app/dashboard/settings/_components/appearance-tab').then(m => ({ default: m.AppearanceTab }))) as ComponentType

export default function PortalSettingsPage() {
  const lang = useLanguage()
  const [activeTab, setActiveTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: lang === 'ar' ? 'الملف الشخصي' : 'Profile', icon: User },
    { id: 'security', label: lang === 'ar' ? 'الأمان' : 'Security', icon: Shield },
    { id: 'language', label: lang === 'ar' ? 'اللغة والمنطقة' : 'Language & Region', icon: Globe },
    { id: 'appearance', label: lang === 'ar' ? 'المظهر' : 'Appearance', icon: Palette },
    { id: 'notifications', label: lang === 'ar' ? 'الإشعارات' : 'Notifications', icon: Bell },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</h1>
        <p className="text-sm text-gray-500">{lang === 'ar' ? 'إدارة حسابك وتفضيلاتك الشخصية' : 'Manage your account and personal preferences'}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <nav role="tablist" aria-label="Settings tabs" className="space-y-1">
            {tabs.map(tab => (
              <Button key={tab.id} onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                variant="ghost"
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}>
                <tab.icon className={`h-4 w-4 shrink-0 ${activeTab === tab.id ? 'text-blue-700' : 'text-gray-400'}`} />
                {tab.label}
              </Button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3">
          <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={activeTab}>
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" /></div>}>
              {activeTab === 'profile' && <ProfileTab />}
              {activeTab === 'security' && <SecurityTab />}
              {activeTab === 'language' && <LanguageTab />}
              {activeTab === 'appearance' && <AppearanceTab />}
              {activeTab === 'notifications' && <NotificationPreferencesTab />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
