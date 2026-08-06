'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (size: number) => void
  lang?: 'en' | 'ar'
}

export function Pagination({ page, totalPages, total, onPageChange, pageSize, onPageSizeChange, lang = 'en' }: PaginationProps) {
  if (totalPages <= 1) return null

  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const resultLabel = lang === 'ar'
    ? `${total} ${total === 1 ? 'نتيجة' : 'نتيجة'}`
    : `${total} result${total !== 1 ? 's' : ''}`

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <nav aria-label={t('Pagination','التنقل بين الصفحات')} className="flex items-center justify-between px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <p className="text-gray-500">{resultLabel}</p>
        {pageSize && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            aria-label={t('Rows per page','عدد الصفوف')}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {[20, 50, 100].map(s => <option key={s} value={s}>{s} {t('/ page','/ صفحة')}</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label={t('Previous page','الصفحة السابقة')}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) => p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <button key={p} onClick={() => onPageChange(p)} aria-label={t(`Page ${p}`,`صفحة ${p}`)} aria-current={p === page ? 'page' : undefined}
            className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label={t('Next page','الصفحة التالية')}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}