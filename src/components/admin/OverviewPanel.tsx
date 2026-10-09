import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAdminOverview } from '@/components/admin/useAdmin'

export function OverviewPanel() {
  const { data, isLoading, error } = useAdminOverview()

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error || !data)
    return (
      <p className="flex items-center gap-2 text-danger-foreground" role="alert">
        <AlertCircle className="size-4" /> Could not load the overview: {error?.message ?? 'no data'}
      </p>
    )

  const tiles = [
    { label: 'Users', value: data.users, note: `${data.new_users_7d} new this week` },
    { label: 'Suspended users', value: data.suspended_users, note: 'cannot sign in to anything', warn: data.suspended_users > 0 },
    { label: 'Companies', value: data.companies, note: `${data.suspended_companies} suspended` },
    { label: 'Projects', value: data.projects, note: `${data.tasks} tasks in total` },
    { label: 'Open tasks', value: data.open_tasks, note: 'not done yet' },
    { label: 'Clocked in now', value: data.clocked_in_now, note: 'across all companies' },
    { label: 'Pending leave', value: data.pending_leave, note: 'waiting for a review' },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t.label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${t.warn ? 'text-danger' : ''}`}>{t.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
