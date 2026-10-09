import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Admin pages are for the superadmin only. The database enforces this too; this just keeps everyone else out of the screens. */
export function RequireSuperadmin() {
  const { profile, loading } = useAuth()
  if (loading) return <p className="text-muted-foreground">Loading…</p>
  if (!profile?.is_superadmin) return <Navigate to="/" replace />
  return <Outlet />
}
