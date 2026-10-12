/*
 * Phase > task. Everything here is pure so it can be tested.
 * Order is by date, not by when a task was created: earliest start first (falling back to the due date),
 * then earliest due date, then creation order as a tie-break. Numbers are given in that order, so they
 * move if the dates change.
 */
export interface TreeTask {
  id: number
  milestone_id: number | null
  start_date: string | null
  due_date: string | null
}

const LATE = '9999-12-31'

export function byDate<T extends TreeTask>(a: T, b: T) {
  const as = a.start_date ?? a.due_date ?? LATE
  const bs = b.start_date ?? b.due_date ?? LATE
  if (as !== bs) return as < bs ? -1 : 1
  const ad = a.due_date ?? a.start_date ?? LATE
  const bd = b.due_date ?? b.start_date ?? LATE
  if (ad !== bd) return ad < bd ? -1 : 1
  return a.id - b.id
}

/** The number of every task inside its phase: 1, 2, 3 ... Tasks under no phase are numbered among themselves. */
export function taskCodes<T extends TreeTask>(tasks: T[]) {
  const codes = new Map<number, string>()
  const groups = new Map<number | null, T[]>()
  for (const t of tasks) groups.set(t.milestone_id, [...(groups.get(t.milestone_id) ?? []), t])
  for (const group of groups.values()) group.sort(byDate).forEach((t, i) => codes.set(t.id, String(i + 1)))
  return codes
}

/** The tasks of one phase (or of no phase) in date order. */
export const tasksIn = <T extends TreeTask>(tasks: T[], milestoneId: number | null) =>
  tasks.filter((t) => t.milestone_id === milestoneId).sort(byDate)
