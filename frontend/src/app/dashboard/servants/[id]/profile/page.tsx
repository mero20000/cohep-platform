'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useServantProfile, useServantTimeline } from '@/components/servants/hooks'
import { MinistryTimeline } from '@/components/servants/ministry-timeline'
import { ArrowLeft, Cross, Loader2 } from 'lucide-react'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

export default function ServantProfilePage() {
  const params = useParams()
  const id = params?.id as string

  const { data: profile, isLoading: profileLoading } = useServantProfile(id)
  const { data: timeline, isLoading: timelineLoading } = useServantTimeline(id)

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">Servant not found or you don&apos;t have access.</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              {profile.photoUrl ? (
                <Image
                  src={profile.photoUrl.startsWith('http') ? profile.photoUrl : `${API_ORIGIN}${profile.photoUrl}`}
                  alt={profile.name}
                  width={64}
                  height={64}
                  priority
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <Cross className="h-7 w-7 text-blue-600" />
              )}
            </div>
            
            <div>
              <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {profile.roles.includes('level_leader') ? 'Level Leader' :
                 profile.roles.includes('group_leader') ? 'Group Leader' : 'Servant'}
                {profile.assignedLevel && ` · ${profile.assignedLevel}`}
                {profile.assignedGroup && ` · ${profile.assignedGroup}`}
              </p>
              {profile.teachingSubjects.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Teaching: {profile.teachingSubjects.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { value: profile.yearsOfService, label: 'years' },
            { value: profile.totalStudents, label: 'students' },
            { value: profile.totalSessions, label: 'sessions' },
            { value: profile.totalHymns, label: 'hymns' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Ministry Timeline</h2>
          <MinistryTimeline milestones={timeline || []} isLoading={timelineLoading} />
        </div>
      </div>
    </div>
  )
}
