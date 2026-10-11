import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthCard, FormError } from '@/components/AuthCard'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/errors'
import { MIN_PASSWORD_LENGTH } from '@/lib/password'

// Reached from the email link; Supabase signs the user in with a recovery session.
export default function ResetPassword() {
  const { user, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      toast.success('Password updated')
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not update the password'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Choose a new password" description={user ? 'Pick something you have not used elsewhere.' : undefined}>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !user ? (
        <div className="space-y-4">
          <FormError message="This reset link is invalid or has expired." />
          <Link to="/forgot-password" className="block text-center text-sm text-primary hover:underline">
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <PasswordInput id="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={setPassword} />
            <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>
          <Button type="submit" className="h-11 w-full text-sm" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
