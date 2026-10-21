import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Changing this value clears a caught error (e.g. a new package was opened). */
  resetKey?: unknown
}

interface ErrorBoundaryState {
  error: Error | null
  resetKey: unknown
}

/**
 * Keeps a rendering failure in the session chrome from blanking the whole
 * app: the header (Open / Close) stays usable, and the failure is shown
 * with a way to retry. The SCO itself runs in its own iframe and is not
 * affected.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Scormite] Interface error', error, info.componentStack)
  }

  private readonly retry = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-surface-950 p-6">
        <div role="alert" className="max-w-md space-y-3 rounded-md border border-border-subtle bg-surface-900 p-4 text-sm">
          <p className="font-medium text-slate-100">Part of the interface failed to display.</p>
          <p className="break-words font-mono text-xs text-red-400">{error.message}</p>
          <p className="text-xs text-slate-400">
            Your package is still open. Try again, or reload the page to start over.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={this.retry}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
