'use client'

import { Search, X } from 'lucide-react'

interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: Array<{
    value: string
    onChange: (value: string) => void
    options: FilterOption[]
    label?: string
  }>
  actions?: React.ReactNode
}

export function FilterBar({ search, onSearchChange, searchPlaceholder = 'Search...', filters, actions }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search || ''} onChange={e => onSearchChange(e.target.value)} placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-9 py-2 text-sm placeholder:text-gray-400 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          {search && (
            <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {filters?.map((f, i) => (
        <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label={f.label || 'Filter'}>
          {f.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ))}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
