import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface State {
  error: Error | null
}

/** Catches render errors so a bug in one page shows a message instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button onClick={() => window.location.assign('/')}>Back to home</Button>
        </div>
      </div>
    )
  }
}
