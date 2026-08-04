'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Save, Loader2, Camera, X, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'

interface ProfileFields {
  firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string;
  phone?: string; locale?: string; timezone?: string; email?: string;
  createdAt?: string; avatarUrl?: string;
}

interface FormState {
  firstName: string; lastName: string; firstNameAr: string; lastNameAr: string;
  phone: string; locale: string; timezone: string; avatarUrl: string;
}

export function ProfileTab() {
  const lang = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<ProfileFields | null>(null)
  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', firstNameAr: '', lastNameAr: '',
    phone: '', locale: 'en', timezone: 'UTC', avatarUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const loadProfile = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await http.get<any>('/auth/me')
      setProfile(data)
      setForm({
        firstName: data.firstName || '', lastName: data.lastName || '',
        firstNameAr: data.firstNameAr || '', lastNameAr: data.lastNameAr || '',
        phone: data.phone || '', locale: data.locale || 'en',
        timezone: data.timezone || 'UTC', avatarUrl: data.avatarUrl || '',
      })
    } catch (e: any) {
      setError(e.message || (lang === 'ar' ? 'فشل تحميل الملف الشخصي' : 'Failed to load profile'))
    }
    setLoading(false)
  }

  useEffect(() => { loadProfile() }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const data = await http.patch<any>('/auth/me', form)
      setProfile(p => ({ ...p, ...data }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const data = await http.upload<any>('/upload/avatar', fd)
      setForm(f => ({ ...f, avatarUrl: data.url }))
      setPreviewUrl('')
    } catch (e) { console.error(e) }
    setUploading(false)
  }

  const removeAvatar = () => {
    setForm(f => ({ ...f, avatarUrl: '' }))
    setPreviewUrl('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const avatarSrc = previewUrl || (form.avatarUrl ? `${API_ORIGIN}${form.avatarUrl}` : '')
  const initials = (form.firstName?.[0] || '') + (form.lastName?.[0] || '')

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="mt-2 h-4 w-60 bg-gray-100 rounded animate-pulse" />
        <div className="mt-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
          <Button variant="link" onClick={loadProfile} className="ml-auto text-sm text-blue-700 hover:text-blue-700 flex items-center gap-1">
            <RefreshCw className="h-4 w-4" /> {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'إعدادات الملف الشخصي' : 'Profile Settings'}</h3>
      <p className="mt-1 text-sm text-gray-500">{lang === 'ar' ? 'تحديث معلوماتك الشخصية' : 'Update your personal information'}</p>

      <div className="mt-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700 overflow-hidden">
              {avatarSrc ? (
                <Image src={avatarSrc} alt="Avatar" width={80} height={80} className="h-full w-full object-cover" />
              ) : (
                initials || '?'
              )}
            </div>
            <Button
              type="button"
              variant="default"
              size="icon"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg hover:bg-gold-600 transition-colors"
              title={lang === 'ar' ? 'رفع صورة' : 'Upload photo'}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </Button>
            {form.avatarUrl && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={removeAvatar}
                className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 transition-colors"
                title={lang === 'ar' ? 'إزالة الصورة' : 'Remove photo'}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{profile?.email}</p>
            <p className="text-xs text-gray-400">
              {lang === 'ar' ? 'عضو منذ' : 'Member since'} {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '—'}
            </p>
            <Button
              type="button"
              variant="link"
              onClick={() => fileRef.current?.click()}
              className="mt-1 text-xs text-blue-700 hover:text-blue-700 font-medium p-0 h-auto"
            >
              {lang === 'ar' ? 'تغيير الصورة' : 'Change photo'}
            </Button>
          </div>
        </div>

        {/* Form fields */}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={lang === 'ar' ? 'الاسم الأول' : 'First Name'} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          <FormField label={lang === 'ar' ? 'الاسم الأخير' : 'Last Name'} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={lang === 'ar' ? 'الاسم الأول (بالعربية)' : 'First Name (Arabic)'} value={form.firstNameAr} onChange={e => setForm({ ...form, firstNameAr: e.target.value })} dir="rtl" className="arabic-text" />
          <FormField label={lang === 'ar' ? 'الاسم الأخير (بالعربية)' : 'Last Name (Arabic)'} value={form.lastNameAr} onChange={e => setForm({ ...form, lastNameAr: e.target.value })} dir="rtl" className="arabic-text" />
        </div>
        <FormField label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} value={profile?.email || ''} disabled />
        <FormField label={lang === 'ar' ? 'الهاتف' : 'Phone'} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={lang === 'ar' ? 'اللغة' : 'Language'} as="select" value={form.locale} onChange={e => setForm({ ...form, locale: e.target.value })}>
            <option value="en">{lang === 'ar' ? 'الإنجليزية' : 'English'}</option><option value="ar">{lang === 'ar' ? 'العربية' : 'Arabic'}</option>
          </FormField>
          <FormField label={lang === 'ar' ? 'المنطقة الزمنية' : 'Timezone'} as="select" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
            <option value="UTC">UTC</option><option value="America/New_York">Eastern (ET)</option><option value="America/Chicago">Central (CT)</option>
            <option value="America/Denver">Mountain (MT)</option><option value="America/Los_Angeles">Pacific (PT)</option>
            <option value="Europe/London">London (GMT)</option><option value="Africa/Cairo">Cairo (EET)</option>
          </FormField>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} aria-label={lang === 'ar' ? 'حفظ تغييرات الملف الشخصي' : 'Save profile changes'}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span aria-live="polite">{saved ? (lang === 'ar' ? 'تم الحفظ!' : 'Saved!') : (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}