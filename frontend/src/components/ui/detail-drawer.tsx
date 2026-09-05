'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function DetailDrawer({ open, onClose, title, subtitle, children, footer }: DetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    if (open && panelRef.current) panelRef.current.focus()
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            onClick={e => e.stopPropagation()}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-xl flex flex-col outline-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
              <div className="min-w-0 flex-1 pr-4">
                {title && <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>}
                {subtitle && <p className="mt-0.5 text-sm text-gray-500 truncate">{subtitle}</p>}
              </div>
              <button onClick={onClose} aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function DetailSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{label}</h3>}
      {children}
    </div>
  )
}

export function DetailRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between py-2 border-b border-gray-50 last:border-0 ${className ?? ''}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right ml-4">{value}</span>
    </div>
  )
}
