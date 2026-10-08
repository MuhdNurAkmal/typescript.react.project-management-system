import { statusLabels } from '@/components/tasks/badges'
import type { TaskStatus } from '@/types/database'

const order: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
const fill: Record<TaskStatus, string> = { todo: 'bg-slate-300', in_progress: 'bg-sky-400', review: 'bg-amber-400', done: 'bg-emerald-400' }

/** Stacked bar showing how many tasks sit in each status, with a legend. */
export function StatusBar({ counts, legend = true }: { counts: Record<TaskStatus, number>; legend?: boolean }) {
  const total = order.reduce((sum, s) => sum + counts[s], 0)
  return (
    <div className="space-y-2">
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={order.map((s) => `${counts[s]} ${statusLabels[s]}`).join(', ')}
      >
        {total > 0 &&
          order.map((s) =>
            counts[s] > 0 ? <div key={s} className={fill[s]} style={{ width: `${(counts[s] / total) * 100}%` }} title={`${statusLabels[s]}: ${counts[s]}`} /> : null,
          )}
      </div>
      {legend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {order.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${fill[s]}`} />
              {statusLabels[s]} <span className="font-medium text-foreground">{counts[s]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
