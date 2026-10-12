import type { TaskStatus } from '@/types/database'

export type MilestoneState = 'done' | 'overdue' | 'at_risk' | 'on_track' | 'empty'

export interface MilestoneLike {
  id: number
  start_date: string
  end_date: string
  completed: boolean
}

export interface MilestoneTaskLike {
  milestone_id: number | null
  /** Subtasks are inside their task's percentage, so a phase only counts top-level tasks. */
  parent_task_id: number | null
  status: TaskStatus
  progress: number
  start_date: string | null
  due_date: string | null
}

/** A milestone this close to its end date, with tasks still open, counts as at risk. */
export const AT_RISK_DAYS = 7

const DAY = 86_400_000
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole days from `today` to `end` (negative once the end date has passed). Dates are yyyy-mm-dd strings. */
export function daysUntil(end: string, today: string) {
  return Math.round((toUtc(end) - toUtc(today)) / DAY)
}

/**
 * How a milestone is doing: its percentage, tasks done, and whether it is on track.
 * The percentage is the average of its tasks' percentages (a task with subtasks already carries the average of
 * its subtasks). Each task counts once, however many subtasks it has.
 * - done: finished (all its tasks done, or ticked by hand when it has none)
 * - overdue: the end date has passed and it is not done
 * - at risk: tasks still open and the end is within a week, or an open task is planned after the end date
 * - empty: no tasks yet, not due yet
 */
export function milestoneProgress(m: MilestoneLike, tasks: MilestoneTaskLike[], today: string) {
  const mine = tasks.filter((t) => t.milestone_id === m.id && t.parent_task_id === null)
  const total = mine.length
  const done = mine.filter((t) => t.status === 'done').length
  const open = total - done
  const percent = total === 0 ? (m.completed ? 100 : 0) : Math.round(mine.reduce((sum, t) => sum + t.progress, 0) / total)
  const daysLeft = daysUntil(m.end_date, today)
  const plannedAfterEnd = mine.some((t) => t.status !== 'done' && t.due_date !== null && t.due_date > m.end_date)

  let state: MilestoneState
  if (m.completed) state = 'done'
  else if (daysLeft < 0) state = 'overdue'
  else if (total === 0) state = 'empty'
  else if (open > 0 && (daysLeft <= AT_RISK_DAYS || plannedAfterEnd)) state = 'at_risk'
  else state = 'on_track'

  return { total, done, open, percent, daysLeft, state }
}

/** Is a task planned outside its milestone's dates? Used to warn (it never blocks). */
export function taskOutsideMilestone(
  task: { start_date: string | null; due_date: string | null },
  m: { start_date: string; end_date: string },
): 'after' | 'before' | null {
  if (task.due_date && task.due_date > m.end_date) return 'after'
  if (task.start_date && task.start_date < m.start_date) return 'before'
  if (task.due_date && task.due_date < m.start_date) return 'before'
  return null
}

export const outsideMessage = (side: 'after' | 'before', m: { start_date: string; end_date: string }) =>
  side === 'after'
    ? `This is planned after the milestone ends on ${m.end_date}. Finish it earlier or move the milestone.`
    : `This starts before the milestone begins on ${m.start_date}.`
