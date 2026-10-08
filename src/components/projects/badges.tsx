import { Badge } from '@/components/ui/badge'
import type { ProjectStatus } from '@/types/database'

const statusLabel: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const variant = status === 'active' ? 'default' : status === 'on_hold' ? 'destructive' : 'secondary'
  return <Badge variant={variant}>{statusLabel[status]}</Badge>
}

export function RoleBadge({ name }: { name: string | null }) {
  return <Badge variant="outline" className="capitalize">{name ?? 'unknown'}</Badge>
}
