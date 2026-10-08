import { Badge } from '@/components/ui/badge'
import type { AttendanceStatus } from '@/types/database'

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const variant = status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  )
}
