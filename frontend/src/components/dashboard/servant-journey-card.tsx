'use client'

import Link from 'next/link'
import { useMyServantProfile } from '@/components/servants/hooks'
import { Cross, ArrowRight } from 'lucide-react'

export function ServantJourneyCard() {
  const { data: profile, isLoading } = useMyServantProfile()

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 p-6 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
        <div className="flex gap-6">
          <div className="h-8 w-16 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!profile) return null

  const yearsOfService = profile.dateJoined
    ? Math.max(0, Math.floor((Date.now() - new Date(profile.dateJoined).getTime()) / (365.25 * 24 * 3600 * 1000)))
    : profile.yearsOfService

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Cross className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">Your Ministry Journey</h3>
      </div>

      <div className="flex items-center gap-8 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{yearsOfService}</div>
          <div className="text-xs text-gray-500">years</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{profile.totalStudents}</div>
          <div className="text-xs text-gray-500">students</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{profile.totalHymns}</div>
          <div className="text-xs text-gray-500">hymns</div>
        </div>
      </div>

      <Link
        href={`/dashboard/servants/${profile.userId}/profile`}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
      >
        View Full Profile
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
