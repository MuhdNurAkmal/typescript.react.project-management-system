/*
 * Planned versus actual dates for the Gantt chart. The plan is start_date / due_date; the actual is
 * actual_start / actual_end. Pure functions, so they can be tested.
 */
export interface ActualTask {
  status: string
  start_date: string | null
  due_date: string | null
  actual_start: string | null
  actual_end: string | null
}

export interface ActualBar {
  start: string
  end: string
  /** Still going: the bar runs up to today. */
  ongoing: boolean
  /** Finished (or running) past the planned end. */
  late: boolean
}

const later = (a: string, b: string) => (a > b ? a : b)

/** The actual bar of a task, or null when it has not started yet. */
export function taskActual(t: ActualTask, today: string): ActualBar | null {
  const start = t.actual_start ?? t.actual_end
  if (!start) return null
  const finished = t.actual_end !== null || t.status === 'done'
  const end = later(t.actual_end ?? (finished ? start : today), start)
  const plannedEnd = t.due_date ?? t.start_date
  return { start, end, ongoing: !finished, late: plannedEnd !== null && end > plannedEnd }
}

/**
 * The actual bar of a milestone: from the first actual start of its tasks; it ends at the last actual end once
 * every task is done, and runs to today until then.
 */
export function milestoneActual(tasks: ActualTask[], plannedEnd: string, today: string): ActualBar | null {
  const starts = tasks.map((t) => t.actual_start ?? t.actual_end).filter((d): d is string => d !== null)
  if (starts.length === 0) return null
  const start = starts.reduce((a, b) => (a < b ? a : b))
  const finished = tasks.length > 0 && tasks.every((t) => t.status === 'done')
  const ends = tasks.map((t) => t.actual_end).filter((d): d is string => d !== null)
  const end = later(finished && ends.length > 0 ? ends.reduce(later) : today, start)
  return { start, end, ongoing: !finished, late: end > plannedEnd }
}

/** Days between two yyyy-MM-dd dates (end minus start). */
export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000)
}
