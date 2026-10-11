import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { SignInBackdrop } from '@/components/SignInBackdrop'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/errors'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Sign in failed'))
    } finally {
      setBusy(false)
    }
  }

  const watchCaps = (e: KeyboardEvent) => setCapsLock(e.getModifierState('CapsLock'))

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <SignInBackdrop />
      <main className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-soft">
            U
          </span>
          <span className="text-xl font-semibold tracking-tight">UrusProgres</span>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-lift sm:p-8">
          <div role="tablist" aria-label="Sign in or create an account" className="mb-6 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
            <span role="tab" aria-selected="true" className="rounded-lg bg-card py-2 text-center shadow-soft">
              Sign in
            </span>
            <Link role="tab" aria-selected="false" to="/register" className="rounded-lg py-2 text-center text-muted-foreground transition-colors hover:text-foreground">
              Create account
            </Link>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Sign in to pick up where your projects left off.</p>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="h-11 px-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="h-11 pr-11 pl-3"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={watchCaps}
                  onKeyDown={watchCaps}
                  onBlur={() => setCapsLock(false)}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                  className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {capsLock && (
                <p role="status" className="text-xs text-warning-foreground">
                  Caps Lock is on.
                </p>
              )}
            </div>
            <Button type="submit" className="h-11 w-full text-sm" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">Projects, people and hours, kept in one place.</p>
      </main>
    </div>
  )
}
