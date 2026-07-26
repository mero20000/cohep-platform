export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-72 animate-pulse rounded bg-gray-100" />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1 space-y-1">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
        <div className="lg:col-span-3">
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  )
}
