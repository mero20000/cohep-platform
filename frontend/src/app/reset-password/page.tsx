'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── Password strength helper ──────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-400' }
  if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-400' }
  if (score <= 3) return { score, label: 'Good', color: 'bg-blue-400' }
  return { score, label: 'Strong', color: 'bg-green-500' }
}

// ── Core reset form ───────────────────────────────────────────────────────────

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') || ''

  const [step, setStep] = useState<'verifying' | 'invalid' | 'form' | 'submitting' | 'done' | 'error'>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const strength = passwordStrength(password)
  const passwordsMatch = password === confirm
  const canSubmit = password.length >= 8 && passwordsMatch && strength.score >= 2

  // Verify token on mount
  useEffect(() => {
    if (!token) { setStep('invalid'); return }

    fetch(`${API}/auth/reset-password/verify?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data?.valid) {
          setUserEmail(data.email || '')
          setStep('form')
        } else {
          setStep('invalid')
        }
      })
      .catch(() => setStep('invalid'))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setStep('submitting')
    setErrorMsg('')

    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setErrorMsg(data?.message || 'Something went wrong. Please request a new link.')
        setStep('error')
        return
      }

      setStep('done')
      setTimeout(() => router.replace('/auth/login'), 3000)
    } catch {
      setErrorMsg('Connection failed. Please check your internet and try again.')
      setStep('error')
    }
  }

  // ── States ──────────────────────────────────────────────────────────────────

  if (step === 'verifying') return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
      <p className="text-sm text-gray-500">Verifying your reset link…</p>
    </div>
  )

  if (step === 'invalid') return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
      <h2 className="text-base font-bold text-red-800 mb-2">Link expired or invalid</h2>
      <p className="text-sm text-red-600 mb-6">
        Password reset links expire after 1 hour and can only be used once.
        Please request a new one.
      </p>
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
      >
        <KeyRound className="h-4 w-4" />
        Request new link
      </Link>
    </div>
  )

  if (step === 'done') return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-green-500 mb-3" />
      <h2 className="text-base font-bold text-green-800 mb-2">Password updated</h2>
      <p className="text-sm text-green-700 mb-2">
        Your password has been changed successfully.
      </p>
      <p className="text-xs text-green-600">Redirecting you to login in 3 seconds…</p>
    </div>
  )

  if (step === 'error') return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
      <h2 className="text-base font-bold text-red-800 mb-2">Reset failed</h2>
      <p className="text-sm text-red-600 mb-6">{errorMsg}</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => setStep('form')}
          className="rounded-xl border border-red-300 px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/auth/login"
          className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  )

  // ── Main form ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {userEmail && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">Resetting password for</p>
          <p className="text-sm font-semibold text-gray-900">{userEmail}</p>
        </div>
      )}

      {/* New password */}
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
          New password
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20 transition-colors"
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Strength bar */}
        {password.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i <= strength.score ? strength.color : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className={`text-[11px] font-medium ${
              strength.score <= 1 ? 'text-red-500' :
              strength.score <= 2 ? 'text-amber-600' :
              strength.score <= 3 ? 'text-blue-600' : 'text-green-600'
            }`}>
              {strength.label} — {password.length < 8 ? 'minimum 8 characters' : 'use uppercase, numbers, and symbols for a stronger password'}
            </p>
          </div>
        )}
      </div>

      {/* Confirm password */}
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
          Confirm new password
        </label>
        <div className="relative">
          <input
            id="confirm-password"
            type={showConfirm ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 transition-colors ${
              confirm.length > 0 && !passwordsMatch
                ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                : 'border-gray-300 focus:border-gold-500 focus:ring-gold-500/20'
            }`}
            placeholder="Repeat your new password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showConfirm ? 'Hide' : 'Show'}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm.length > 0 && !passwordsMatch && (
          <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
        )}
        {confirm.length > 0 && passwordsMatch && (
          <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Passwords match
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit || step === 'submitting'}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-gold-200/50 transition-all"
      >
        {step === 'submitting' ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Updating password…</>
        ) : (
          <><KeyRound className="h-4 w-4" /> Set new password</>
        )}
      </button>

      <p className="text-center text-xs text-gray-400">
        Remember it now?{' '}
        <Link href="/auth/login" className="font-medium text-gold-600 hover:text-gold-700 transition-colors">
          Back to login
        </Link>
      </p>
    </form>
  )
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/cohep-logo.png" alt="COHEP" width={72} height={72} className="inline-block h-18 w-18 rounded-2xl object-contain shadow-xl shadow-gold-500/30 mb-4" />
          <h1 className="text-xl font-bold text-white">Reset your password</h1>
          <p className="text-sm text-gray-400 mt-1">Choose a new password for your COHEP account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 backdrop-blur p-6 shadow-2xl">
          <Suspense fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            Back to COHEP home
          </Link>
        </div>
      </div>
    </div>
  )
}
