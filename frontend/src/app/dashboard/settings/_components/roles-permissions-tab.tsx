'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Shield, ChevronDown, ChevronUp, Users, Crown, GraduationCap, BookOpen, Layers, Heart, Baby, Save, Loader2, Pencil, Plus, X } from 'lucide-react'
import { ROLES, type RoleValue } from '@/lib/roles'
import { PERMISSIONS, getPermissionsForRole, getDefaultPermissionsForRole, setRolePermissions, type Permission } from '@/lib/permissions'
import { useLanguage } from '@/lib/use-language'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }> | undefined> = {
  super_admin: Crown, admin: Shield, principal: GraduationCap,
  curriculum_manager: BookOpen, level_leader: Layers, group_leader: Users,
  servant: Heart, parent: Baby,
}

const CATEGORIES = [
  { key: 'management', label: 'Management', labelAr: 'إداري' },
  { key: 'ministry', label: 'Ministry', labelAr: 'خدمة' },
  { key: 'parent', label: 'Parent', labelAr: 'ولي أمر' },
]

// Group permissions by module for organised display
const PERM_GROUPS: { module: string; moduleAr: string; perms: { key: Permission; label: string; labelAr: string }[] }[] = (() => {
  const groups: Record<string, { module: string; moduleAr: string; perms: { key: Permission; label: string; labelAr: string }[] }> = {}
  for (const [key, label] of Object.entries(PERMISSIONS)) {
    const mod = key.split(':')[0]
    const labelAr: Record<string, string> = {
      'student:view':'عرض الطلاب','student:create':'إضافة طلاب','student:edit':'تعديل الطلاب','student:edit-sensitive':'تعديل البيانات الحساسة','student:delete':'حذف الطلاب','student:bulk-delete':'حذف جماعي','student:import':'استيراد','student:export':'تصدير',
      'servant:view':'عرض الخدام','servant:create':'إضافة خدام','servant:edit':'تعديل الخدام','servant:delete':'حذف الخدام',
      'attendance:view':'عرض الحضور','attendance:record':'تسجيل الحضور','attendance:manage':'إدارة جلسات الحضور',
      'assessment:view':'عرض التقييمات','assessment:create':'إنشاء تقييمات','assessment:edit':'تعديل التقييمات','assessment:delete':'حذف التقييمات','assessment:grade':'تقدير التقييمات',
      'curriculum:view':'عرض المنهج','curriculum:edit':'تعديل المنهج',
      'gamification:view':'عرض التحفيز','gamification:manage':'إدارة التحفيز',
      'announcement:view':'عرض الإعلانات','announcement:create':'إنشاء إعلانات','announcement:edit':'تعديل إعلانات','announcement:delete':'حذف إعلانات','announcement:publish':'نشر إعلانات',
      'settings:view':'عرض الإعدادات','settings:manage':'إدارة الإعدادات','settings:manage-system':'إدارة إعدادات النظام',
      'users:view':'عرض المستخدمين','users:create':'إنشاء مستخدمين','users:edit':'تعديل مستخدمين','users:delete':'حذف مستخدمين','users:manage-roles':'إدارة الأدوار والصلاحيات',
      'reports:view':'عرض التقارير','reports:export':'تصدير التقارير',
      'parents:link':'ربط أولياء الأمور','registrations:approve':'الموافقة على التسجيلات',
    }
    if (!groups[mod]) {
      const modAr: Record<string, string> = { student:'الطلاب', servant:'الخدام', attendance:'الحضور', assessment:'التقييمات', curriculum:'المنهج', gamification:'التحفيز', announcement:'الإعلانات', settings:'الإعدادات', users:'المستخدمين', reports:'التقارير', parents:'أولياء الأمور', registrations:'التسجيلات' }
      groups[mod] = { module: mod, moduleAr: modAr[mod] || mod, perms: [] }
    }
    groups[mod].perms.push({ key: key as Permission, label, labelAr: labelAr[key] || label })
  }
  return Object.values(groups)
})()

export function RolesPermissionsTab() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [expanded, setExpanded] = useState<RoleValue | null>(null)
  const [editing, setEditing] = useState<RoleValue | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  // activePerms[role] = Permission[]
  const [activePerms, setActivePerms] = useState<Record<string, Permission[]>>({})

  useEffect(() => {
    http.get<any[]>('/users', { schoolId: getSchoolId() })
      .then(users => {
        const c: Record<string, number> = {}
        for (const u of users) {
          for (const ur of (u.userRoles || [])) {
            const rn = ur.role?.name
            if (rn) c[rn] = (c[rn] || 0) + 1
          }
        }
        setCounts(c)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const merged: Record<string, Permission[]> = {}
    for (const role of ROLES) {
      merged[role.value] = getPermissionsForRole(role.value)
    }
    setActivePerms(merged)
  }, [])

  const togglePerm = (role: RoleValue, perm: Permission) => {
    setActivePerms(prev => {
      const current = prev[role] || []
      return {
        ...prev,
        [role]: current.includes(perm)
          ? current.filter(p => p !== perm)
          : [...current, perm],
      }
    })
  }

  const grantAll = (role: RoleValue, perms: Permission[]) => {
    setActivePerms(prev => {
      const current = prev[role] || []
      const merged = [...new Set([...current, ...perms])]
      return { ...prev, [role]: merged }
    })
  }

  const revokeAll = (role: RoleValue, perms: Permission[]) => {
    setActivePerms(prev => {
      const current = prev[role] || []
      return { ...prev, [role]: current.filter(p => !perms.includes(p)) }
    })
  }

  const resetToDefaults = (role: RoleValue) => {
    setActivePerms(prev => ({
      ...prev,
      [role]: getDefaultPermissionsForRole(role),
    }))
  }

  const handleSave = async (role: RoleValue) => {
    setSaving(true)
    const perms = activePerms[role] || []
    try {
      await http.post(`/roles/${role}/permissions`, { permissions: perms }, { schoolId: getSchoolId() })
      setRolePermissions(role, perms)
      toast('success', t('Permissions updated', 'تم تحديث الصلاحيات'))
    } catch {
      toast('error', t('Failed to save permissions', 'فشل حفظ الصلاحيات'))
    }
    setSaving(false)
    setEditing(null)
  }

  return (
    <div className="space-y-6">
      {CATEGORIES.map(cat => {
        const roles = ROLES.filter(r => r.category === cat.key)
        return (
          <div key={cat.key}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t(cat.label, cat.labelAr)}</h3>
            <div className="space-y-2">
              {roles.map(role => {
                const Icon = ROLE_ICONS[role.value]
                const isOpen = expanded === role.value
                const isEditing = editing === role.value
                const count = counts[role.value] ?? 0
                const perms = activePerms[role.value] || []
                const totalPerms = Object.keys(PERMISSIONS).length
                const catColors: Record<string, { border: string; bg: string; icon: string }> = {
                  management: { border: 'border-purple-200', bg: 'bg-purple-50', icon: 'text-purple-600' },
                  ministry:   { border: 'border-blue-200',   bg: 'bg-blue-50',   icon: 'text-blue-600' },
                  parent:     { border: 'border-green-200',  bg: 'bg-green-50',  icon: 'text-green-600' },
                }
                const cc = catColors[role.category] || catColors.management

                return (
                  <div key={role.value} className={`rounded-xl border ${cc.border} overflow-hidden transition-shadow hover:shadow-sm`}>
                    <button type="button" onClick={() => { setExpanded(isOpen ? null : role.value); setEditing(null) }}
                      className={`w-full flex items-center justify-between px-4 py-3 ${cc.bg} hover:brightness-95 transition-all`}>
                      <div className="flex items-center gap-3">
                        {Icon && <Icon className={`h-5 w-5 ${cc.icon}`} />}
                        <div className="text-left">
                          <span className="text-sm font-medium text-gray-900">{lang === 'ar' ? role.labelAr : role.label}</span>
                          <span className="mx-2 text-xs text-gray-400">&middot;</span>
                          <span className="text-xs text-gray-500">{role.value}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{perms.length}/{totalPerms} {t('perms', 'صلاحيات')}</span>
                        <span className="text-xs text-gray-400">{count} {t('users', 'مستخدم')}</span>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 py-3 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-gray-500">{t('Permissions', 'الصلاحيات')}</span>
                          <div className="flex items-center gap-2">
                            {!isEditing ? (
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(role.value) }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                                <Pencil className="h-3 w-3" />{t('Edit', 'تعديل')}
                              </Button>
                            ) : (
                              <>
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); resetToDefaults(role.value) }}
                                  className="text-xs text-gray-500 hover:text-gray-700 underline">{t('Reset to defaults', 'إعادة للافتراضي')}</Button>
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSave(role.value) }} disabled={saving}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800">
                                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  {t('Save', 'حفظ')}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                          {PERM_GROUPS.map(group => {
                            const allOn = group.perms.every(p => perms.includes(p.key))
                            const someOn = group.perms.some(p => perms.includes(p.key))
                            return (
                              <div key={group.module}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    {lang === 'ar' ? group.moduleAr : group.module}
                                  </span>
                                  {isEditing && (
                                    <div className="flex gap-2">
                                      <Button variant="ghost" size="sm" onClick={() => grantAll(role.value, group.perms.map(p => p.key))}
                                        className="text-[10px] text-green-600 hover:text-green-700 font-medium">{t('All', 'الكل')}</Button>
                                      <Button variant="ghost" size="sm" onClick={() => revokeAll(role.value, group.perms.map(p => p.key))}
                                        className="text-[10px] text-red-500 hover:text-red-600 font-medium">{t('None', 'لا شيء')}</Button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.perms.map(p => {
                                    const enabled = perms.includes(p.key)
                                    return (
                                      <span key={p.key}
                                        onClick={isEditing ? () => togglePerm(role.value, p.key) : undefined}
                                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs cursor-default transition-colors ${
                                          isEditing ? 'cursor-pointer' : ''
                                        } ${
                                          enabled
                                            ? 'border-blue-200 bg-blue-50 text-blue-800'
                                            : 'border-gray-200 bg-white text-gray-400'
                                        } ${isEditing ? 'hover:brightness-95' : ''}`}>
                                        {isEditing && (
                                          <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                        )}
                                        {lang === 'ar' ? p.labelAr : p.label}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
