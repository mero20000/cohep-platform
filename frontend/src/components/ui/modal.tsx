'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

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

  // Previously these ids were the literal strings 'modal-title'/'modal-desc',
  // so two mounted modals produced duplicate ids and aria-labelledby resolved
  // to whichever came first in the document.
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descId = `${baseId}-desc`

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement
    }
    return () => {
      // Restore focus to the trigger only when the modal actually closes
      // (open was true when this effect was created).
      if (open && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
    }
  }, [open])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      // Focus trap. Without this, Tab walks straight out of the dialog into the
      // page behind it, which is still fully reachable — a keyboard user ends
      // up navigating content they cannot see.
      const panel = contentRef.current
      if (!panel) return

      // Deliberately not filtering on offsetParent: it is null for any
      // position:fixed element, so a fixed control inside the panel would be
      // dropped from the cycle.
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true')

      if (focusables.length === 0) {
        // Nothing focusable inside — keep focus on the panel rather than
        // letting it escape.
        e.preventDefault()
        panel.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (open && contentRef.current) contentRef.current.focus()
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="modal-overlay" ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose() }}>
          {/*
            The dialog semantics belong on the panel, not the full-screen
            overlay: the overlay is only a backdrop, and naming it as the dialog
            made the accessible name and the focused element disagree.
          */}
          <motion.div key="modal-content" ref={contentRef} tabIndex={-1}
            role="dialog" aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            className={`w-full ${sizeMap[size]} rounded-2xl bg-white shadow-xl max-h-[95vh] flex flex-col outline-none`}
            initial={{ opacity: 0, ...(reduce ? {} : { scale: 0.95 }) }}
            animate={{ opacity: 1, ...(reduce ? {} : { scale: 1 }) }}
            exit={{ opacity: 0, ...(reduce ? {} : { scale: 0.95 }) }}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: [0.23, 1, 0.32, 1] }}
            onClick={e => e.stopPropagation()}>
            {(title || description) && (
              <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  {title && <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>}
                  {description && <p id={descId} className="mt-1 text-sm text-gray-500">{description}</p>}
                </div>
                <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
