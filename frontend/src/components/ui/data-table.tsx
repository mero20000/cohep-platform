'use client'

import type { ReactNode } from 'react'
import { EmptyState } from './empty-state'
import { LucideIcon } from 'lucide-react'

interface Column<T> {
  key: string
  header: string
  className?: string
  render?: (item: T, index: number) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  onRowClick?: (item: T) => void
  keyExtractor?: (item: T) => string
}

export function DataTable<T>({ columns, data, loading, emptyIcon, emptyTitle = 'No data', emptyDescription, emptyAction, onRowClick, keyExtractor }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-gold-600" />
      </div>
    )
  }

  if (data.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }

  return (
    <div className="overflow-x-auto table-to-cards">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            {columns.map(col => (
              <th key={col.key} scope="col" className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((item, idx) => (
            <tr key={keyExtractor ? keyExtractor(item) : idx}
              onClick={() => onRowClick?.(item)}
              className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100' : ''} transition-colors`}>
              {columns.map(col => (
                <td key={col.key} data-label={col.header} className={`px-4 py-3.5 ${col.className || ''}`}>
                  {col.render ? col.render(item, idx) : (item as Record<string, ReactNode>)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
