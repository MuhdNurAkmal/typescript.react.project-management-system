/*
 * Phase > task > subtask. Everything here is pure so it can be tested.
 * Order is by date, not by when a task was created: earliest start first (falling back to the due date),
 * then earliest due date, then creation order as a tie-break. Numbers are given in that order, so they
 * move if the dates change.
 */
export interface TreeTask {
  id: number
  parent_task_id: number | null
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

export const topLevel = <T extends TreeTask>(tasks: T[]) => tasks.filter((t) => t.parent_task_id === null)

export const subtasksOf = <T extends TreeTask>(tasks: T[], parentId: number) =>
  tasks.filter((t) => t.parent_task_id === parentId).sort(byDate)

/** Tasks that are not split into subtasks, plus the subtasks themselves: the real units of work. */
export function leafTasks<T extends TreeTask>(tasks: T[]) {
  const parents = new Set(tasks.map((t) => t.parent_task_id).filter((id): id is number => id !== null))
  return tasks.filter((t) => !parents.has(t.id))
}

/**
 * The code of every task inside its phase: tasks are 1, 2, 3 and their subtasks 1.1, 1.2 ...
 * Tasks under no phase are numbered the same way among themselves.
 */
export function taskCodes<T extends TreeTask>(tasks: T[]) {
  const codes = new Map<number, string>()
  const groups = new Map<number | null, T[]>()
  for (const t of topLevel(tasks)) groups.set(t.milestone_id, [...(groups.get(t.milestone_id) ?? []), t])
  for (const group of groups.values()) {
    group.sort(byDate).forEach((t, i) => {
      const code = String(i + 1)
      codes.set(t.id, code)
      subtasksOf(tasks, t.id).forEach((s, j) => codes.set(s.id, `${code}.${j + 1}`))
    })
  }
  return codes
}

/** Tasks in display order: each task followed by its subtasks, grouped by phase in the order given. */
export function orderedWithin<T extends TreeTask>(tasks: T[], milestoneId: number | null): { task: T; indent: boolean }[] {
  const out: { task: T; indent: boolean }[] = []
  for (const t of topLevel(tasks).filter((x) => x.milestone_id === milestoneId).sort(byDate)) {
    out.push({ task: t, indent: false })
    for (const s of subtasksOf(tasks, t.id)) out.push({ task: s, indent: true })
  }
  return out
}
