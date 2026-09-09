'use client'
export function MarkSummaryBar({ present, late, absent, excused, marked, total, dirty, error, onRetry, lang }: any) {
  return (
    <div aria-live="polite" className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
      <span className="font-semibold">{marked}/{total}</span>
      <span className="text-green-700">● {present}</span><span className="text-amber-700">● {late}</span>
      <span className="text-red-700">● {absent}</span><span className="text-gray-600">● {excused}</span>
      {dirty && <span className="text-xs text-amber-700">{lang==='ar' ? 'تغييرات غير محفوظة' : 'Unsaved'}</span>}
      {error && <button type="button" onClick={onRetry} className="min-h-[44px] rounded-lg bg-red-50 px-3 text-sm font-medium text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">{lang==='ar' ? 'إعادة المحاولة' : 'Retry'}</button>}
    </div>
  )
}
