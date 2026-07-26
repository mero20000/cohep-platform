'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'

export function LanguageTab() {
  const lang = useLanguage()
  const [locale, setLocale] = useState('en')
  const [timezone, setTimezone] = useState('UTC')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    http.get<any>('/auth/me')
      .then(data => {
        setLocale(data.locale || 'en')
        setTimezone(data.timezone || 'UTC')
      })
      .catch(console.error)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await http.patch('/auth/me', { locale, timezone })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'اللغة والمنطقة' : 'Language & Region'}</h3>
      <p className="mt-1 text-sm text-gray-500">{lang === 'ar' ? 'تعيين تفضيلات اللغة والمنطقة' : 'Set your language and regional preferences'}</p>
      <div className="mt-6 space-y-5 max-w-lg">
        <FormField label={lang === 'ar' ? 'لغة العرض' : 'Display Language'} as="select" value={locale} onChange={e => setLocale(e.target.value)}>
          <option value="en">{lang === 'ar' ? 'الإنجليزية' : 'English'}</option><option value="ar">{lang === 'ar' ? 'العربية' : 'Arabic (العربية)'}</option>
        </FormField>
        <div>
          <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'تنسيق التاريخ' : 'Date Format'}</label>
          <div className="mt-1.5 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600">
            {lang === 'ar' ? 'DD/MM/YYYY (مثال: 13/07/2026)' : 'DD/MM/YYYY (e.g. 13/07/2026)'}
          </div>
        </div>
        <FormField label={lang === 'ar' ? 'المنطقة الزمنية' : 'Timezone'} as="select" value={timezone} onChange={e => setTimezone(e.target.value)}>
          <option value="UTC">UTC</option><option value="America/New_York">Eastern (ET)</option><option value="America/Chicago">Central (CT)</option>
          <option value="America/Denver">Mountain (MT)</option><option value="America/Los_Angeles">Pacific (PT)</option>
          <option value="Europe/London">London (GMT)</option><option value="Africa/Cairo">Cairo (EET)</option>
        </FormField>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">
            <strong>{lang === 'ar' ? 'النص القبطي:' : 'Coptic Text:'}</strong> {lang === 'ar' ? 'المنصة تدعم الكتابة القبطية (Ⲛⲙⲧⲙⲏⲧⲟ) عبر خط Noto Sans Coptic. جميع أسماء التسابيح القبطية تظهر بخطها الأصلي.' : 'The platform supports Coptic script (Ⲛⲙⲧⲙⲏⲧⲟ) via the Noto Sans Coptic font. All Coptic hymn names are displayed in their original script.'}
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} aria-label={lang === 'ar' ? 'حفظ تفضيلات اللغة' : 'Save language preferences'}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span aria-live="polite">{saved ? (lang === 'ar' ? 'تم الحفظ!' : 'Saved!') : (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
