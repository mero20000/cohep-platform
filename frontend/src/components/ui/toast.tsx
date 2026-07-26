'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, description?: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-500', text: 'text-green-800' },
  error: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', text: 'text-red-800' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', text: 'text-amber-800' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', text: 'text-blue-800' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) { clearTimeout(timer); timersRef.current.delete(id) }
  }, [])

  const addToast = useCallback((type: ToastType, title: string, description?: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev.slice(-4), { id, type, title, description, duration }])
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration)
      timersRef.current.set(id, timer)
    }
  }, [removeToast])

  useEffect(() => {
    return () => { timersRef.current.forEach(t => clearTimeout(t)) }
  }, [])

  return (
    <ToastContext value={{ toast: addToast }}>
      {children}
      <div aria-live="polite" aria-label="Notifications" className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const Icon = icons[t.type]
          const c = colors[t.type]
          return (
            <div key={t.id} role="alert"
              className={`pointer-events-auto ${c.bg} ${c.border} border rounded-xl p-4 shadow-lg animate-[slideIn_0.3s_ease-out]`}>
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${c.icon}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${c.text}`}>{t.title}</p>
                  {t.description && <p className="mt-1 text-sm opacity-80">{t.description}</p>}
                </div>
                <button onClick={() => removeToast(t.id)} aria-label="Dismiss" className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors">
                  <X className="h-4 w-4 opacity-50" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}
