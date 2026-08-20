'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Save, CheckCircle2 } from 'lucide-react'

export function AppearanceTab() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light')
  const [accentColor, setAccentColor] = useState('gold')
  const [sidebarStyle, setSidebarStyle] = useState<'compact' | 'expanded'>('compact')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('niangelos_theme') as 'light' | 'dark' | 'system' | null
      const savedAccent = localStorage.getItem('niangelos_accent')
      const savedSidebar = localStorage.getItem('niangelos_sidebar') as 'compact' | 'expanded' | null
      if (savedTheme) setTheme(savedTheme)
      if (savedAccent) setAccentColor(savedAccent)
      if (savedSidebar) setSidebarStyle(savedSidebar)
      applyTheme(savedTheme || 'light', savedAccent || 'gold')
    } catch {}
  }, [])

  const applyTheme = (t: string, accent: string) => {
    const root = document.documentElement
    if (t === 'dark') {
      root.classList.add('dark')
    } else if (t === 'light') {
      root.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      prefersDark ? root.classList.add('dark') : root.classList.remove('dark')
    }
    root.classList.remove('accent-blue', 'accent-green', 'accent-purple')
    if (accent !== 'gold') {
      root.classList.add(`accent-${accent}`)
    }
  }

  const handleSave = () => {
    localStorage.setItem('niangelos_theme', theme)
    localStorage.setItem('niangelos_accent', accentColor)
    localStorage.setItem('niangelos_sidebar', sidebarStyle)
    applyTheme(theme, accentColor)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>
          <p className="mt-1 text-sm text-gray-500">Customize the look and feel of the platform</p>
        </div>
        <Button onClick={handleSave} aria-label="Save appearance settings" className="bg-gold-500 hover:bg-gold-600">
          <Save className="h-4 w-4" /> <span aria-live="polite">{saved ? 'Saved!' : 'Save Appearance'}</span>
        </Button>
      </div>
      <div className="mt-6 space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map(t => (
              <Button key={t} variant="ghost" onClick={() => setTheme(t)} aria-label={`Select ${t} theme`}
                className={`rounded-lg border-2 p-4 text-center transition-colors capitalize h-auto ${theme === t ? 'border-gold-500 bg-gold-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`mx-auto h-10 w-16 rounded border ${t === 'light' ? 'bg-white border-gray-200' : t === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-r from-white to-gray-800 border-gray-300'}`} />
                <span className="mt-2 block text-sm font-medium text-gray-700">{t}</span>
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Accent Color</label>
          <div className="flex gap-3">
            {[
              { id: 'gold', color: 'bg-gold-500', ring: 'ring-gold-500' },
              { id: 'blue', color: 'bg-blue-500', ring: 'ring-blue-500' },
              { id: 'green', color: 'bg-green-500', ring: 'ring-green-500' },
              { id: 'purple', color: 'bg-purple-500', ring: 'ring-purple-500' },
            ].map(c => (
              <Button key={c.id} variant="ghost" size="icon" onClick={() => setAccentColor(c.id)} aria-label={`${c.id} accent color`}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${c.color} ${accentColor === c.id ? `ring-2 ring-offset-2 ${c.ring}` : 'ring-0'}`}>
                {accentColor === c.id && <CheckCircle2 className="h-5 w-5 text-white" />}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Sidebar Style</label>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => setSidebarStyle('compact')} aria-label="Compact sidebar"
              className={`rounded-lg border-2 p-4 text-center transition-colors h-auto ${sidebarStyle === 'compact' ? 'border-gold-500 bg-gold-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="mx-auto h-20 w-full rounded bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-400">Compact</div>
              <span className="mt-2 block text-sm font-medium text-gray-700">Compact</span>
            </Button>
            <Button variant="ghost" onClick={() => setSidebarStyle('expanded')} aria-label="Expanded sidebar"
              className={`rounded-lg border-2 p-4 text-center transition-colors h-auto ${sidebarStyle === 'expanded' ? 'border-gold-500 bg-gold-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="mx-auto h-20 w-full rounded bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-400">Expanded</div>
              <span className="mt-2 block text-sm font-medium text-gray-700">Expanded</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
