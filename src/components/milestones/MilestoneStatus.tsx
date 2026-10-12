import { Pill, type Tone } from '@/components/Pill'
import type { MilestoneState } from '@/lib/milestoneUtils'

const labels: Record<MilestoneState, string> = {
  done: 'Done',
  overdue: 'Overdue',
  at_risk: 'At risk',
  on_track: 'On track',
  empty: 'No tasks yet',
}
const tones: Record<MilestoneState, Tone> = { done: 'green', overdue: 'red', at_risk: 'amber', on_track: 'blue', empty: 'slate' }
const bars: Record<MilestoneState, string> = { done: 'bg-success', overdue: 'bg-danger', at_risk: 'bg-warning', on_track: 'bg-primary', empty: 'bg-muted-foreground/40' }

export function MilestoneStatePill({ state }: { state: MilestoneState }) {
  return <Pill tone={tones[state]}>{labels[state]}</Pill>
}

/** "6 of 9 tasks done" with a bar coloured by how the milestone is doing. */
export function MilestoneProgress({ done, total, percent, state }: { done: number; total: number; percent: number; state: MilestoneState }) {
  return (
    <div className="min-w-32">
      <div className="mb-1 text-xs text-muted-foreground">{total === 0 ? 'No tasks yet' : `${percent}% · ${done} of ${total} tasks done`}</div>
      <div className="h-1.5 rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Milestone progress">
        <div className={`h-1.5 rounded-full ${bars[state]}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
