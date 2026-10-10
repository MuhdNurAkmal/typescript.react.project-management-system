import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

function FullPageLoading() {
  return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>
}

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoading />
  // someone sent here from a page that needs a login (for example an invitation link) goes back to it
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
  if (user) return <Navigate to={from ?? '/'} replace />
  return <Outlet />
}
