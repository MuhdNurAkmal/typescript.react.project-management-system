import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/errors'
import { passwordStrength, validatePasswordChange, type PasswordStrength } from '@/lib/password'
import { supabase } from '@/lib/supabase'

export default function Profile() {
  return (
    <div>
      <PageHeader eyebrow="Account" title="Profile" description="Your details and how you sign in." />
      <div className="grid gap-10 lg:grid-cols-2">
        <DetailsSection />
        <PasswordSection />
      </div>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="max-w-md">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  )
}

function DetailsSection() {
  const { user, profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setFullName(profile?.full_name ?? ''), [profile])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    await refreshProfile()
    toast.success('Profile updated')
  }

  return (
    <Section title="Details" description="Your name is shown to the people you work with.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ''} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy || fullName.trim() === (profile?.full_name ?? '')}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </Section>
  )
}

const strengthLabel: Record<PasswordStrength, string> = { weak: 'Weak', fair: 'Fair', strong: 'Strong' }
const strengthColor: Record<PasswordStrength, string> = { weak: 'bg-red-400', fair: 'bg-amber-400', strong: 'bg-emerald-500' }
const strengthWidth: Record<PasswordStrength, string> = { weak: 'w-1/3', fair: 'w-2/3', strong: 'w-full' }

function PasswordSection() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validatePasswordChange(current, next, confirm)
    if (problem) return toast.error(problem)
    if (!user?.email) return toast.error('Your account has no email address')
    setBusy(true)
    try {
      // Prove it is really you: the current password must sign in before it can be replaced.
      const { error: checkError } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
      if (checkError) throw new Error('Your current password is incorrect')
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) throw error
      // Log out every other device or browser that still holds the old password's session.
      await supabase.auth.signOut({ scope: 'others' })
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success('Password changed. Other devices were signed out.')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the password'))
    } finally {
      setBusy(false)
    }
  }

  const strength = passwordStrength(next)

  return (
    <Section title="Password" description="Choose a new password. You will stay signed in here; other devices are signed out.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw-current">Current password</Label>
          <Input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-new">New password</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
          {next && (
            <div className="space-y-1" aria-live="polite">
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full transition-all ${strengthColor[strength]} ${strengthWidth[strength]}`} />
              </div>
              <p className="text-xs text-muted-foreground">Strength: {strengthLabel[strength]}. At least 8 characters; longer and mixed is better.</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </Section>
  )
}
