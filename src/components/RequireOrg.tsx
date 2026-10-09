import { Outlet } from 'react-router-dom'
import { AuthCard } from '@/components/AuthCard'
import { CreateCompanyForm } from '@/components/company/CreateCompanyForm'
import { useOrg } from '@/hooks/useOrg'

/** Everything in the app lives inside a company, so a user with none is asked to create one first. */
export function RequireOrg() {
  const { orgs, loading } = useOrg()

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>
  if (orgs.length === 0) {
    return (
      <AuthCard title="Create your company" description="Projects, attendance and leave all live inside a company. If someone invited you to theirs, ask them to add your email, then refresh this page.">
        <CreateCompanyForm />
      </AuthCard>
    )
  }
  return <Outlet />
}
