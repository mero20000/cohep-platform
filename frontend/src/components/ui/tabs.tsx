'use client'

import { LucideIcon } from 'lucide-react'

interface Tab {
  id: string
  label: string
  icon?: LucideIcon
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <nav className="flex gap-6 border-b border-gray-200" role="tablist">
      {tabs.map(tab => {
        const isActive = tab.id === activeTab
        return (
          <button key={tab.id} role="tab" aria-selected={isActive} aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 -mb-px border-b-2 px-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'border-gold-500 text-blue-700' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
            {tab.icon && <tab.icon className={`h-4 w-4 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
