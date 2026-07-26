'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

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
    <nav aria-label="Pagination" className="flex items-center justify-between px-4 py-3 text-sm">
      <p className="text-gray-500">{total} result{total !== 1 ? 's' : ''}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) => p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <button key={p} onClick={() => onPageChange(p)} aria-label={`Page ${p}`} aria-current={p === page ? 'page' : undefined}
            className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
