'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'

interface NotificationPrefs {
  attendance: boolean; enrollments: boolean; curriculum: boolean; systemUpdates: boolean
}

export function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({ attendance: true, enrollments: true, curriculum: false, systemUpdates: true })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const schoolId = getSchoolId()

  useEffect(() => {
    const load = async () => {
      try {
        const configs = await http.get<any[]>(`/users/schools/${schoolId}/config`)
        const notiConfig = configs.find((c: any) => c.key === 'notification_preferences')
        if (notiConfig?.value) setPrefs(notiConfig.value as NotificationPrefs)
      } catch {}
    }
    if (schoolId) load()
  }, [schoolId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await http.post(`/users/schools/${schoolId}/config`, {
        key: 'notification_preferences', value: prefs, description: 'User notification preferences',
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const items = [
    { key: 'attendance', label: 'Attendance Alerts', desc: 'Get notified when students are marked absent' },
    { key: 'enrollments', label: 'New Student Enrollments', desc: 'Notification when a new student joins' },
    { key: 'curriculum', label: 'Curriculum Changes', desc: 'Alert when lessons or allocations are modified' },
    { key: 'systemUpdates', label: 'System Updates', desc: 'Platform updates and maintenance notices' },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
          <p className="mt-1 text-sm text-gray-500">Configure how you receive notifications</p>
        </div>
        <Button onClick={handleSave} disabled={saving} aria-label="Save notification preferences">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span aria-live="polite">{saved ? 'Saved!' : 'Save Preferences'}</span>
        </Button>
      </div>
      <div className="mt-6 space-y-4 max-w-lg">
        {items.map((item) => (
          <label key={item.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <input type="checkbox" checked={prefs[item.key as keyof NotificationPrefs]}
              onChange={e => setPrefs({ ...prefs, [item.key]: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
          </label>
        ))}
      </div>
    </div>
  )
}
