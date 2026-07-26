'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] ${error.name}: ${error.message}`, errorInfo.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div role="alert" className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 mb-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-800">Something went wrong</p>
            <p className="mt-1 text-xs text-red-600 max-w-xs">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button onClick={this.handleRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
