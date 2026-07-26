'use client'

import { ReactNode } from 'react'
import { Modal } from './modal'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
  confirmDisabled?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', variant = 'danger', loading, confirmDisabled }: ConfirmDialogProps) {
  const iconBg = variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
  const iconColor = variant === 'danger' ? 'text-red-600' : 'text-amber-600'
  const btnBg = variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
  const Icon = variant === 'danger' ? Trash2 : AlertTriangle

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="text-center">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg} mx-auto`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
        {typeof message === 'string' ? (
          <p className="mt-2 text-sm text-gray-500">{message}</p>
        ) : (
          <div className="mt-2">{message}</div>
        )}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={onClose} disabled={loading}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50">
          {cancelLabel}
        </button>
        <button onClick={onConfirm} disabled={loading || confirmDisabled}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${btnBg}`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
