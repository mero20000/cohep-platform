'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const reduce = useReducedMotion()
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement
    }
    return () => {
      if (!open && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
    }
  }, [open, onClose])

  useEffect(() => {
    if (open && contentRef.current) contentRef.current.focus()
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="modal-overlay" ref={overlayRef} role="dialog" aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-desc' : undefined}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose() }}>
          <motion.div key="modal-content" ref={contentRef} tabIndex={-1}
            className={`w-full ${sizeMap[size]} rounded-2xl bg-white shadow-xl max-h-[95vh] flex flex-col outline-none`}
            initial={{ opacity: 0, ...(reduce ? {} : { scale: 0.95 }) }}
            animate={{ opacity: 1, ...(reduce ? {} : { scale: 1 }) }}
            exit={{ opacity: 0, ...(reduce ? {} : { scale: 0.95 }) }}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: [0.23, 1, 0.32, 1] }}
            onClick={e => e.stopPropagation()}>
            {(title || description) && (
              <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  {title && <h2 id="modal-title" className="text-lg font-semibold text-gray-900">{title}</h2>}
                  {description && <p id="modal-desc" className="mt-1 text-sm text-gray-500">{description}</p>}
                </div>
                <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
