'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Bell, BellOff } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'

interface Prefs {
  attendance: boolean
  assessment: boolean
  enrollment: boolean
  announcements: boolean
}

export function NotificationPreferencesTab() {
  const lang = useLanguage()
  const [prefs, setPrefs] = useState<Prefs>({ attendance: true, assessment: true, enrollment: true, announcements: true })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  useEffect(() => {
    const stored = localStorage.getItem('niangelos_parent_notification_prefs')
    if (stored) {
      try { setPrefs(JSON.parse(stored)) } catch {}
    }
    http.get<any>('/auth/me')
      .then(data => {
        if (data.notificationPrefs) {
          setPrefs(prev => ({ ...prev, ...data.notificationPrefs }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      localStorage.setItem('niangelos_parent_notification_prefs', JSON.stringify(prefs))
      await http.patch('/auth/me', { notificationPrefs: prefs })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const items = [
    {
      key: 'attendance' as const,
      label: t('Attendance Alerts', 'تنبيهات الحضور'),
      desc: t('Notify me when my child is marked absent or late', 'إشعاري عند تسجيل غياب أو تأخير لابني'),
    },
    {
      key: 'assessment' as const,
      label: t('Assessment Results', 'نتائج التقييمات'),
      desc: t('Notify me when new assessment results are published', 'إشعاري عند نشر نتائج التقييمات الجديدة'),
    },
    {
      key: 'enrollment' as const,
      label: t('Enrollment Updates', 'تحديثات التسجيل'),
      desc: t('Notify me about changes to my child\'s enrollment or group', 'إشعاري بالتغييرات في تسجيل أو مجموعة ابني'),
    },
    {
      key: 'announcements' as const,
      label: t('Announcements', 'الإعلانات'),
      desc: t('Receive school announcements and notices', 'استلام إعلانات المدرسة والإشعارات'),
    },
  ]

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gold-700" /></div>
      </div>
    )
  }

  const enabledCount = Object.values(prefs).filter(Boolean).length
  const totalCount = Object.values(prefs).length

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t('Notification Preferences', 'تفضيلات الإشعارات')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('Choose what notifications you receive about your children', 'اختر الإشعارات التي تريد استلامها عن أبنائك')}</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span aria-live="polite">{saved ? (lang === 'ar' ? 'تم الحفظ!' : 'Saved!') : (lang === 'ar' ? 'حفظ التفضيلات' : 'Save')}</span>
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        {enabledCount === 0 ? (
          <span className="flex items-center gap-1"><BellOff className="h-3.5 w-3.5" /> {t('All notifications disabled', 'جميع الإشعارات معطلة')}</span>
        ) : (
          <span className="flex items-center gap-1"><Bell className="h-3.5 w-3.5" /> {t(`${enabledCount} of ${totalCount} enabled`, `${enabledCount} من ${totalCount} مفعلة`)}</span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {items.map(item => (
          <label key={item.key}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <div>
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <input type="checkbox" checked={prefs[item.key]}
              onChange={e => setPrefs({ ...prefs, [item.key]: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setPrefs({ attendance: true, assessment: true, enrollment: true, announcements: true })}
          variant="outline"
          size="sm">
          {t('Enable all', 'تفعيل الكل')}
        </Button>
        <Button onClick={() => setPrefs({ attendance: false, assessment: false, enrollment: false, announcements: false })}
          variant="outline"
          size="sm">
          {t('Disable all', 'تعطيل الكل')}
        </Button>
      </div>
    </div>
  )
}
