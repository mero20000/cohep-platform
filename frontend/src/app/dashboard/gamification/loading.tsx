import { CardSkeleton } from '@/components/ui/skeleton'

export default function GamificationLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-12 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
