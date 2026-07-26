'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Cross, Eye, EyeOff, Loader2 } from 'lucide-react'
import { getBaseSchoolId } from '@/lib/school'
import { Button } from '@/components/ui/button'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Cross className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Parent Portal</h1>
          <p className="text-gold-200 text-lg">Track your child&apos;s progress</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="lg:hidden mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500">
              <Cross className="h-7 w-7 text-white" />
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
        </div>
      </div>
    </div>
  )
}
