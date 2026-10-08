import { Pill, type Tone } from '@/components/Pill'
import type { TaskPriority, TaskStatus } from '@/types/database'

export const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
}

export const priorityLabels: Record<TaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' }

/** Same hues as the Gantt bars, so a status looks the same everywhere. */
export const statusTone: Record<TaskStatus, Tone> = { todo: 'slate', in_progress: 'blue', review: 'amber', done: 'green' }
const priorityTone: Record<TaskPriority, Tone> = { low: 'slate', medium: 'blue', high: 'red' }

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Pill tone={statusTone[status]}>{statusLabels[status]}</Pill>
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Pill tone={priorityTone[priority]}>{priorityLabels[priority]}</Pill>
}
