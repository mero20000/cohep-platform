'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { getBaseSchoolId } from '@/lib/school'
import { Button } from '@/components/ui/button'
import ForgotPasswordPanel from '@/components/auth/forgot-password-panel'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
      try {
        localStorage.removeItem('niangelos_active_school')
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, schoolIdentifier: getBaseSchoolId() }),
        })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Login failed' }))
        throw new Error(err.message)
      }
      const data = await res.json()
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/portal')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-gold-600 via-gold-500 to-gold-700 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative text-center">
          <div className="mx-auto mb-6 flex h-[136px] w-[136px] items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Image src="/cohep-logo.png" alt="COHEP" width={120} height={120} className="h-[120px] w-[120px] object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Parent Portal</h1>
          <p className="text-gold-200 text-lg">Track your child&apos;s progress</p>
        </div>
      </div>

      <div className="flex-1 flex items-start lg:items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="lg:hidden mx-auto mb-4 flex h-[80px] w-[80px] sm:h-[104px] sm:w-[104px] items-center justify-center rounded-xl bg-blue-500">
              <Image src="/cohep-logo.png" alt="COHEP" width={96} height={96} className="h-16 w-16 sm:h-24 sm:w-24 object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Parent Sign In</h2>
            <p className="text-sm text-gray-500 mt-1">Access your child&apos;s attendance and assessments</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="parent@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm pr-10 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={loading}
              className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowForgot(!showForgot)}
                aria-expanded={showForgot}
                className="text-sm font-semibold text-gold-700 hover:text-gold-700 transition-colors py-2 min-h-[44px]"
              >
                Forgot password?
              </button>
            </div>

            {showForgot && (
              <div className="mt-4">
                <ForgotPasswordPanel defaultEmail={email} defaultSchoolId={getBaseSchoolId()} bilingual={false} />
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
