import { Skeleton } from '@/components/ui/skeleton'

export default function StudentsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
