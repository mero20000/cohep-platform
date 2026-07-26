import { Skeleton } from '@/components/ui/skeleton'

export default function CurriculumLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-96" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
            <Skeleton className="h-12 w-full" />
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
