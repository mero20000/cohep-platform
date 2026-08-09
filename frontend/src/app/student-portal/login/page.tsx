'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function StudentLoginPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/student-portal/login',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ portalAccessKey: code.trim() }) },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Access key not found' }))
        throw new Error(err.message)
      }
      router.push(`/student-portal/${code.trim()}`)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Image src="/cohep-logo.png" alt="COHEP" width={96} height={96} className="h-24 w-24 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Student Portal</h1>
          <p className="text-indigo-200 text-lg">Your hymns journey at a glance</p>
        </div>
      </div>

      <div className="flex-1 flex items-start lg:items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="lg:hidden mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500">
              <Image src="/cohep-logo.png" alt="COHEP" width={72} height={72} className="h-18 w-18 object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Student Sign In</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your access key to view your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Key</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" disabled={loading || !code.trim()} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? 'Signing in...' : 'View My Dashboard'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
