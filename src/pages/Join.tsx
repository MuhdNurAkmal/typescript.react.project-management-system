import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthCard, FormError } from '@/components/AuthCard'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useOrg } from '@/hooks/useOrg'
import { errorMessage } from '@/lib/errors'
import { MIN_PASSWORD_LENGTH } from '@/lib/password'
import { supabase } from '@/lib/supabase'

const invitedBy = (name: string) => (
  <span className="inline-flex items-center gap-1.5">
    <Building2 className="size-3.5" /> {name}
  </span>
)

/** Opened from a company's invitation link: register (or sign in) and land inside that company. */
export default function Join() {
  const { code = '' } = useParams()
  const { user, profile, loading, signUp } = useAuth()
  const { setCurrentId, refresh } = useOrg()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const info = useQuery({
    queryKey: ['invite-info', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invite_info', { p_code: code })
      if (error) throw error
      return data[0]?.organization_name ?? null
    },
    retry: false,
  })

  async function join() {
    const { data: orgId, error } = await supabase.rpc('join_company', { p_code: code })
    if (error) throw error
    await refresh()
    setCurrentId(orgId)
    toast.success(`You joined ${info.data}`)
    navigate('/', { replace: true })
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp(email.trim(), password, fullName.trim())
      if (needsConfirmation) {
        toast.success('Account created. Confirm your email, sign in, then open this link again.')
        navigate('/login', { replace: true })
        return
      }
      await join()
    } catch (err) {
      setError(errorMessage(err, 'Could not join'))
    } finally {
      setBusy(false)
    }
  }

  async function onJoin() {
    setBusy(true)
    setError(null)
    try {
      await join()
    } catch (err) {
      setError(errorMessage(err, 'Could not join'))
    } finally {
      setBusy(false)
    }
  }

  if (loading || info.isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>

  if (info.error || !info.data) {
    return (
      <AuthCard title="This link is not valid" description="It may be wrong, switched off, or the company may be suspended. Ask the company for a new one.">
        <Button className="h-11 w-full text-sm" onClick={() => navigate(user ? '/' : '/login')}>
          {user ? 'Go to the app' : 'Go to sign in'}
        </Button>
      </AuthCard>
    )
  }

  if (user) {
    return (
      <AuthCard
        eyebrow={invitedBy(info.data)}
        title={`Join ${info.data}`}
        description={`You are signed in as ${profile?.full_name || user.email}. Join this company with your current account?`}
      >
        <div className="space-y-3">
          <FormError message={error} />
          <Button className="h-11 w-full text-sm" onClick={onJoin} disabled={busy}>
            {busy ? 'Joining…' : `Join ${info.data}`}
          </Button>
          <Button variant="ghost" className="h-11 w-full text-sm" onClick={() => navigate('/')}>
            Not now
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard eyebrow={invitedBy(info.data)} title={`You are invited to ${info.data}`} description="Create your account and you will be taken straight into the company.">
      <form onSubmit={onRegister} className="space-y-4">
        <FormError message={error} />
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" required className="h-11 px-3" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required className="h-11 px-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={setPassword} />
          <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>
        <Button type="submit" className="h-11 w-full text-sm" disabled={busy}>
          {busy ? 'Creating…' : 'Create account and join'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" state={{ from: { pathname: `/join/${code}` } }} className="text-primary hover:underline">
            Sign in to join
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
