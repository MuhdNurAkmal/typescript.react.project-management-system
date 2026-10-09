import { Outlet } from 'react-router-dom'
import { NoCompany } from '@/components/company/NoCompany'
import { useOrg } from '@/hooks/useOrg'

/** Pages that need a company show a friendly "join or create one" screen instead when the user has none. */
export function RequireOrg() {
  const { orgs, loading } = useOrg()

  if (loading) return <p className="text-muted-foreground">Loading…</p>
  if (orgs.length === 0) return <NoCompany />
  return <Outlet />
}
