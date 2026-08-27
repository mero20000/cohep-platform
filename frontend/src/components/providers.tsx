'use client'

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LogtoProvider, type LogtoConfig } from '@logto/react'
import { ToastProvider } from './ui/toast'
import { startAnalytics, endAnalytics } from '@/lib/analytics'

const logtoConfig: LogtoConfig = {
  endpoint: process.env.NEXT_PUBLIC_LOGTO_ENDPOINT || 'https://your-tenant.logto.app',
  appId: process.env.NEXT_PUBLIC_LOGTO_APP_ID || 'your-app-id',
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }))

  useEffect(() => {
    startAnalytics()
    const onHide = () => endAnalytics()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') endAnalytics()
    })
    return () => {
      endAnalytics()
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

  return (
    <LogtoProvider config={logtoConfig}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </LogtoProvider>
  )
}
