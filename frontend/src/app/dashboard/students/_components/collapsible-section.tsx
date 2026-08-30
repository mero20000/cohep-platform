'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: number | string
}

export function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-gray-100 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <div className="flex-shrink-0 text-gray-400">{icon}</div>}
          <h4 className="text-sm font-semibold text-gray-900 truncate">{title}</h4>
          {badge !== undefined && (
            <span className="text-xs text-gray-500 font-normal ml-1">
              {typeof badge === 'number' ? `(${badge})` : `(${badge})`}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30 space-y-3 animate-slideUp">
          {children}
        </div>
      )}
    </div>
  )
}
