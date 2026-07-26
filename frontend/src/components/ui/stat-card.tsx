'use client'
import { useState, useEffect, useRef } from 'react'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  subtitle?: string
  trend?: { value: number; positive: boolean }
  compact?: boolean
  onClick?: () => void
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current)
    const start = performance.now()
    const from = 0
    const duration = 800
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value])
  return <>{display.toLocaleString()}</>
}

export function StatCard({ label, value, icon: Icon, iconColor = 'text-blue-700', iconBg = 'bg-blue-50', subtitle, trend, compact, onClick }: StatCardProps) {
  const isNumeric = typeof value === 'number'
  return (
    <div onClick={onClick} className={`rounded-xl border border-gray-200 bg-white ${compact ? 'p-3' : 'p-5'} hover-lift ${onClick ? 'cursor-pointer hover:border-gold-200 hover:shadow-md active:scale-[0.98] transition-all' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={compact ? 'text-xs text-gray-500' : 'text-sm text-gray-500'}>{label}</p>
          <p className={`mt-0.5 font-bold text-gray-900 ${compact ? 'text-xl' : 'text-2xl'}`}>
            {isNumeric ? <AnimatedNumber value={value} /> : value}
          </p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={`flex items-center justify-center rounded-xl ${iconBg} ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}>
          <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${iconColor}`} />
        </div>
      </div>
    </div>
  )
}
