import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SignInBackdrop } from '@/components/SignInBackdrop'

/**
 * Shared shell for every signed-out screen: the faint timeline backdrop, the logo and one centred card.
 * `tab` shows the Sign in / Create account switch on the pages where it makes sense.
 */
export function AuthCard({
  title,
  description,
  eyebrow,
  tab,
  children,
}: {
  title: string
  description?: string
  /** A small line above the title, for example the company an invitation is for. */
  eyebrow?: ReactNode
  tab?: 'signin' | 'register'
  children: ReactNode
}) {
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
          {tab && (
            <div role="tablist" aria-label="Sign in or create an account" className="mb-6 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
              <Tab active={tab === 'signin'} to="/login">
                Sign in
              </Tab>
              <Tab active={tab === 'register'} to="/register">
                Create account
              </Tab>
            </div>
          )}

          {eyebrow && <div className="mb-2 inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-accent-foreground">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description ? <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p> : <div className="mb-6" />}
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">Projects, people and hours, kept in one place.</p>
      </main>
    </div>
  )
}

function Tab({ active, to, children }: { active: boolean; to: string; children: ReactNode }) {
  if (active)
    return (
      <span role="tab" aria-selected="true" className="rounded-lg bg-card py-2 text-center shadow-soft">
        {children}
      </span>
    )
  return (
    <Link role="tab" aria-selected="false" to={to} className="rounded-lg py-2 text-center text-muted-foreground transition-colors hover:text-foreground">
      {children}
    </Link>
  )
}

/** Inline error box used by the signed-out forms. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger-foreground">
      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" />
      <span>{message}</span>
    </div>
  )
}
