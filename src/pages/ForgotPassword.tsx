import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { AuthCard, FormError } from '@/components/AuthCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/errors'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(errorMessage(err, 'Could not send the reset email'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Forgot your password?" description="Enter your email and we will send you a link to choose a new one.">
      {sent ? (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-success-soft p-4 text-sm text-success-foreground">
          <MailCheck className="mt-0.5 size-5 shrink-0" />
          <p>If an account exists for {email}, a reset link is on its way. It may take a minute to arrive.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required className="h-11 px-3" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="h-11 w-full text-sm" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
