'use client'

import { X, Building2, Crown, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardBannersProps {
  lang: 'en' | 'ar'
  canSwitchSchool: boolean
  activeSchoolId: string | null
  isViewingAs: boolean
  effectiveRole: string
  switchSchools: { id: string; name: string; churchName: string }[]
  roleOptions: { value: string; label: string; labelAr: string; icon: any }[]
  bannerAnnouncement: { id: string; title: string; titleAr?: string; body: string; bodyAr?: string; priority: string } | null
  bannerDismissed: string | null
  onSetActiveSchool: (id: string | null) => void
  onClearRole: () => void
  onDismissBanner: (id: string) => void
}

export function DashboardBanners({
  lang,
  canSwitchSchool,
  activeSchoolId,
  isViewingAs,
  effectiveRole,
  switchSchools,
  roleOptions,
  bannerAnnouncement,
  bannerDismissed,
  onSetActiveSchool,
  onClearRole,
  onDismissBanner,
}: DashboardBannersProps) {
  const language = lang

  return (
    <>
      {canSwitchSchool && activeSchoolId && (() => {
        const active = switchSchools.find(s => s.id === activeSchoolId)
        return (
          <div className="flex items-center justify-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-1.5 text-xs text-blue-800">
            <Building2 className="h-3.5 w-3.5" />
            <span>{language === 'ar' ? 'عرض ك' : 'Viewing as'}: <span className="font-semibold">{active?.name || (language === 'ar' ? 'مدرسة' : 'School')}</span>{active?.churchName ? ` · ${active.churchName}` : ''}</span>
            <Button variant="ghost" size="sm" onClick={() => onSetActiveSchool(null)} className="ml-1 h-auto px-1.5 py-0.5 font-medium text-blue-700 hover:bg-blue-100">{language === 'ar' ? 'مسح' : 'Clear'}</Button>
          </div>
        )
      })()}

      {isViewingAs && (() => {
        const opt = roleOptions.find(o => o.value === effectiveRole)
        return (
          <div className="flex items-center justify-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-1.5 text-xs text-blue-800">
            <Crown className="h-3.5 w-3.5" />
            <span>{language === 'ar' ? 'عرض لوحة التحكم كـ' : 'Viewing dashboard as'}: <span className="font-semibold">{language === 'ar' ? opt?.labelAr || effectiveRole : opt?.label || effectiveRole}</span></span>
            <Button variant="ghost" size="sm" onClick={() => onClearRole()} className="ml-1 h-auto px-1.5 py-0.5 font-medium text-blue-700 hover:bg-blue-100">{language === 'ar' ? 'مسح' : 'Clear'}</Button>
          </div>
        )
      })()}

      {bannerAnnouncement && bannerAnnouncement.id !== bannerDismissed && (
        <div className={`px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 ${bannerAnnouncement.priority === 'urgent' ? '' : ''}`}>
          <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
            bannerAnnouncement.priority === 'urgent' ? 'border-red-200 bg-red-50' : bannerAnnouncement.priority === 'important' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
          }`}>
            <Megaphone className={`h-5 w-5 mt-0.5 flex-shrink-0 ${bannerAnnouncement.priority === 'urgent' ? 'text-red-500' : bannerAnnouncement.priority === 'important' ? 'text-amber-500' : 'text-blue-500'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${bannerAnnouncement.priority === 'urgent' ? 'text-red-800' : bannerAnnouncement.priority === 'important' ? 'text-amber-800' : 'text-blue-800'}`}>
                {language === 'ar' ? (bannerAnnouncement.titleAr || bannerAnnouncement.title) : bannerAnnouncement.title}
              </p>
              <p className={`text-xs mt-0.5 ${bannerAnnouncement.priority === 'urgent' ? 'text-red-600' : bannerAnnouncement.priority === 'important' ? 'text-amber-600' : 'text-blue-600'}`}>
                {language === 'ar' ? (bannerAnnouncement.bodyAr || bannerAnnouncement.body) : bannerAnnouncement.body}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onDismissBanner(bannerAnnouncement.id)}
              className={`rounded-lg h-8 w-8 flex-shrink-0 ${bannerAnnouncement.priority === 'urgent' ? 'text-red-400 hover:bg-red-100' : bannerAnnouncement.priority === 'important' ? 'text-amber-400 hover:bg-amber-100' : 'text-blue-400 hover:bg-blue-100'}`}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
