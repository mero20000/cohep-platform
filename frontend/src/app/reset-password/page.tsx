'use client'

import { Suspense, useEffect, useState, FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Cross, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const lang = useLanguage()
  const isAr = lang === 'ar'

  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'success'>('loading')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    const controller = new AbortController()
    fetch(`${API}/auth/reset-password/verify?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('invalid'))))
      .then((data: { email: string }) => {
        setMaskedEmail(data.email)
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('invalid')
      })
    return () => controller.abort()
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(isAr ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '' }))
        throw new Error(err.message || (isAr ? 'فشل إعادة تعيين كلمة المرور' : 'Password reset failed'))
      }
      setStatus('success')
    } catch (err: any) {
      setError(err.message || (isAr ? 'فشل إعادة تعيين كلمة المرور' : 'Password reset failed'))
    }
    setSubmitting(false)
  }

  const container = (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 text-white">
            <Cross className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password'}</h2>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isAr ? 'جارٍ التحقق من الرابط...' : 'Checking your link...'}
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-4 text-sm text-gray-700">
                {isAr ? 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية.' : 'This reset link is invalid or expired.'}
              </p>
              <Button asChild variant="gold" className="mt-6 w-full">
                <Link href="/auth/login">{isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</Link>
              </Button>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <p className="mt-4 text-sm text-gray-700">
                {isAr
                  ? 'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
                  : 'Password reset successfully. You can now sign in with your new password.'}
              </p>
              <Button asChild variant="gold" className="mt-6 w-full">
                <Link href="/auth/login">{isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</Link>
              </Button>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
                {isAr
                  ? `إعادة تعيين كلمة المرور لـ ${maskedEmail}`
                  : `Reset password for ${maskedEmail}`}
              </p>

              {error && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr ? 'كلمة المرور الجديدة' : 'New password'}
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm pr-10 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                    placeholder={isAr ? '8 أحرف على الأقل' : 'At least 8 characters'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                />
              </div>

              <Button type="submit" variant="gold" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )

  return container
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
