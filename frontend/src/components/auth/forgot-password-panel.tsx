'use client'

import { useState, KeyboardEvent } from 'react'
import { Loader2, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'
import { useFormValidation } from '@/hooks/use-form-validation'
import { email, required, type Schema } from '@/lib/validation'
import { FormField } from '@/components/ui/form-field'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface ForgotPasswordPanelProps {
  defaultEmail?: string
  defaultSchoolId?: string
  bilingual?: boolean
}

type ForgotForm = { email: string }
const forgotSchema: Schema<ForgotForm> = {
  email: [required({ en: 'Email', ar: 'البريد الإلكتروني' }), email()],
}

export default function ForgotPasswordPanel({
  defaultEmail = '',
  defaultSchoolId = '',
  bilingual = true,
}: ForgotPasswordPanelProps) {
  const lang = useLanguage()
  const isAr = bilingual && lang === 'ar'

  const [form, setForm] = useState<ForgotForm>({ email: defaultEmail })
  const [schoolId, setSchoolId] = useState(defaultSchoolId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const { fieldErrors, handleBlur, validate } = useFormValidation<ForgotForm>({
    values: form,
    schema: forgotSchema,
    lang: isAr ? 'ar' : 'en',
    fieldId: () => 'forgot-email',
  })

  const t = {
    email: isAr ? 'البريد الإلكتروني' : 'Email address',
    school: isAr ? 'معرّف المدرسة' : 'School ID',
    schoolOptional: isAr ? 'اختياري' : 'optional',
    send: isAr ? 'إرسال رابط الاستعادة' : 'Send reset link',
    sending: isAr ? 'جارٍ الإرسال...' : 'Sending...',
    success: isAr
      ? 'إذا كان الحساب موجودًا، تم إرسال رابط إعادة التعيين.'
      : 'If an account exists, a reset link was sent.',
    emailRequired: isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address',
  }

  const handleSubmit = async () => {
    setError('')
    setDone(false)
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), schoolIdentifier: schoolId.trim() || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '' }))
        throw new Error(err.message || (isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.'))
      }
      setDone(true)
    } catch (err: any) {
      setError(err.message || (isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.'))
    }
    setLoading(false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault()
      if (!loading) handleSubmit()
    }
  }

  return (
    <div onKeyDown={handleKeyDown} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <KeyRound className="h-4 w-4 text-gold-600" />
        {isAr ? 'استعادة كلمة المرور' : 'Reset your password'}
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {done && (
        <div role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 flex items-start gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{t.success}</span>
        </div>
      )}

      <FormField
        label={t.email}
        required
        type="email"
        fieldId="forgot-email"
        error={fieldErrors.email}
        value={form.email}
        onChange={(e) => setForm({ email: (e.target as HTMLInputElement).value })}
        onBlur={() => handleBlur('email')}
        autoComplete="email"
        placeholder="you@example.com"
      />

      <div>
        <label htmlFor="forgot-school" className="block text-xs font-medium text-gray-700 mb-1">
          {t.school} <span className="text-gray-500 font-normal">({t.schoolOptional})</span>
        </label>
        <input
          id="forgot-school"
          type="text"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          autoComplete="off"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
          placeholder="e.g. niangelos-main"
        />
      </div>

      <Button type="button" onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? t.sending : t.send}
      </Button>
    </div>
  )
}
