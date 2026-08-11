'use client'

import { ServantMilestoneData } from './hooks'

interface MinistryTimelineProps {
  milestones: ServantMilestoneData[]
  isLoading: boolean
}

const TYPE_ICONS: Record<string, string> = {
  years_of_service: '📅',
  students_taught: '👨‍🎓',
  sessions_taught: '📖',
  hymns_covered: '🎵',
  role_change: '⭐',
}

export function MinistryTimeline({ milestones, isLoading }: MinistryTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-3 w-3 bg-gray-200 rounded-full" />
            <div className="h-4 w-48 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (milestones.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        Your ministry journey will appear here as you reach milestones.
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {milestones.map((milestone, i) => (
          <div key={i} className="relative flex items-start gap-4">
            <div className="relative z-10 flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 ring-4 ring-white">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900">{milestone.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {new Date(milestone.reachedAt).toLocaleDateString('en-GB', {
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
