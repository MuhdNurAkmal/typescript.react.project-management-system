import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AuthCard } from '@/components/AuthCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useOrg } from '@/hooks/useOrg'
import { errorMessage } from '@/lib/errors'
import { MIN_PASSWORD_LENGTH } from '@/lib/password'
import { supabase } from '@/lib/supabase'

/** Opened from a company's invitation link: register (or sign in) and land inside that company. */
export default function Join() {
  const { code = '' } = useParams()
  const { user, profile, loading, signUp } = useAuth()
  const { setCurrentId, refresh } = useOrg()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
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
      toast.error(errorMessage(err, 'Could not join'))
    } finally {
      setBusy(false)
    }
  }

  async function onJoin() {
    setBusy(true)
    try {
      await join()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not join'))
    } finally {
      setBusy(false)
    }
  }

  if (loading || info.isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>

  if (info.error || !info.data) {
    return (
      <AuthCard title="Link not valid" description="This invitation link is wrong, switched off, or the company is suspended. Ask the company for a new one.">
        <Button className="w-full" onClick={() => navigate(user ? '/' : '/login')}>
          {user ? 'Go to the app' : 'Go to sign in'}
        </Button>
      </AuthCard>
    )
  }

  if (user) {
    return (
      <AuthCard title={`Join ${info.data}`} description={`You are signed in as ${profile?.full_name || user.email}. Join this company with your current account?`}>
        <div className="space-y-3">
          <Button className="w-full" onClick={onJoin} disabled={busy}>
            {busy ? 'Joining…' : `Join ${info.data}`}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            Not now
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={`Join ${info.data}`} description="Create your account and you will be taken straight into the company.">
      <form onSubmit={onRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account and join'}
        </Button>
        <p className="text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" state={{ from: { pathname: `/join/${code}` } }} className="underline">
            Sign in to join
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
