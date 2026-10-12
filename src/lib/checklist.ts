/** A checklist item is a tick box (0 or 100) or a percentage (0 to 100). */
export interface ChecklistLike {
  progress: number
}

/** Average of the items, rounded; null when there is no checklist (the task then keeps its own percentage). */
export function checklistPercent(items: ChecklistLike[]): number {
  if (items.length === 0) return 0
  return Math.round(items.reduce((sum, i) => sum + i.progress, 0) / items.length)
}

/** The percentage a task shows: the checklist's average when it has one (Done counts as 100), else its own. */
export function taskPercent(task: { status: string; progress: number }, items: ChecklistLike[]): number {
  if (task.status === 'done') return 100
  return items.length > 0 ? checklistPercent(items) : task.progress
}
