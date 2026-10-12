import { MilestoneProgress, MilestoneStatePill } from '@/components/milestones/MilestoneStatus'
import { useMilestones } from '@/hooks/useMilestones'
import { useProjectTasks } from '@/hooks/useTasks'
import { milestoneProgress } from '@/lib/milestoneUtils'
import { todayString } from '@/lib/taskValidation'

/** Overview card: every milestone with how many of its tasks are done and whether it is on track. */
export function MilestoneSummary({ projectId }: { projectId: number }) {
  const { data: milestones, isLoading, error } = useMilestones(projectId)
  const { data } = useProjectTasks(projectId)
  const today = todayString()
  const tasks = data?.tasks ?? []
  const unplanned = tasks.filter((t) => t.milestone_id === null && t.status !== 'done').length

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading milestones…</p>
  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (!milestones?.length) return <p className="text-sm text-muted-foreground">No milestones yet. A project manager can add phases in the Gantt tab.</p>

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border bg-card shadow-soft">
        {milestones.map((m) => {
          const p = milestoneProgress(m, tasks, today)
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-40 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.title}</span>
                  <MilestoneStatePill state={p.state} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.start_date} to {m.end_date}
                </div>
              </div>
              <MilestoneProgress done={p.done} total={p.total} percent={p.percent} state={p.state} />
            </li>
          )
        })}
      </ul>
      {unplanned > 0 && <p className="text-xs text-muted-foreground">{unplanned} open task{unplanned === 1 ? ' is' : 's are'} not under any milestone.</p>}
    </div>
  )
}
