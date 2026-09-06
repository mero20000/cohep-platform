'use client'

import { useReducedMotion, motion, AnimatePresence } from 'motion/react'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}

export function AnimatedChartTooltip({ active, payload, label }: TooltipProps) {
  const reduce = useReducedMotion()
  const isVisible = active && payload && payload.length > 0

  if (reduce) {
    if (!isVisible) return null
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
        {label && <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>}
        {payload.map((entry, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.value.toLocaleString('en-GB')}
          </p>
        ))}
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 4 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
        >
          {label && <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>}
          {payload.map((entry, i) => (
            <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
              {entry.value.toLocaleString('en-GB')}
            </p>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
