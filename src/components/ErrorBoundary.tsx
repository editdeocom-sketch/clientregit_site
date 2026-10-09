import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ClientRegit site crashed:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-3 text-sm text-muted">
            The page hit an unexpected error. Reload to try again, or email support if it keeps happening.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="cursor-pointer rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold-strong"
            >
              Reload page
            </button>
            <a
              href="mailto:support@clientregit.com"
              className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold hover:border-gold hover:text-gold-strong"
            >
              Email support
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
