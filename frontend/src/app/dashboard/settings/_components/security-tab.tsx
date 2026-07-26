'use client'

import { useState } from 'react'
import { Key, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { http } from '@/lib/http-client'

export function SecurityTab() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleChangePassword = async () => {
    setError('')
    if (!form.currentPassword || !form.newPassword) { setError('All fields are required'); return }
    if (form.newPassword.length < 8) { setError('New password must be at least 8 characters'); return }
    if (form.newPassword !== form.confirmPassword) { setError('Passwords do not match'); return }
    setSaving(true)
    try {
      await http.post('/auth/change-password', {
        currentPassword: form.currentPassword, newPassword: form.newPassword,
      })
      setSaved(true)
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err?.message || 'Failed to change password')
    }
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
      <p className="mt-1 text-sm text-gray-500">Update your account password</p>
      {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
      {saved && <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700" aria-live="polite">Password changed successfully!</div>}
      <div className="mt-6 space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700">Current Password</label>
          <div className="relative mt-1.5">
            <input type={showCurrent ? 'text' : 'password'} value={form.currentPassword}
              onChange={e => setForm({ ...form, currentPassword: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-10 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowCurrent(!showCurrent)} aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">New Password</label>
          <div className="relative mt-1.5">
            <input type={showNew ? 'text' : 'password'} value={form.newPassword}
              onChange={e => setForm({ ...form, newPassword: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-10 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowNew(!showNew)} aria-label={showNew ? 'Hide new password' : 'Show new password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
        </div>
        <FormField label="Confirm New Password" type="password" value={form.confirmPassword}
          onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
        <div className="flex justify-end">
          <Button onClick={handleChangePassword} disabled={saving} aria-label="Change password">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            Change Password
          </Button>
        </div>
      </div>
    </div>
  )
}
