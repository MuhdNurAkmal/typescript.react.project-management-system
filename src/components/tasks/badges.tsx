import { Badge } from '@/components/ui/badge'
import type { TaskPriority, TaskStatus } from '@/types/database'

export const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
}

export const priorityLabels: Record<TaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' }

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const variant = status === 'done' ? 'default' : status === 'todo' ? 'outline' : 'secondary'
  return <Badge variant={variant}>{statusLabels[status]}</Badge>
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={priority === 'high' ? 'destructive' : 'outline'}>{priorityLabels[priority]}</Badge>
}
