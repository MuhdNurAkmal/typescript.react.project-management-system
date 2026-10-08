import { format } from 'date-fns'

export const todayString = () => format(new Date(), 'yyyy-MM-dd')

/** Returns an error message, or null if the dates are valid. Dates are yyyy-mm-dd strings. */
export function validateTaskDates(start: string, due: string): string | null {
  if (start && due && due < start) return 'Due date cannot be before start date'
  return null
}

export function isOverdue(task: { due_date: string | null; status: string }, today = todayString()) {
  return !!task.due_date && task.due_date < today && task.status !== 'done'
}

/**
 * True if giving `taskId` the dependencies `newDeps` would create a cycle.
 * `edges` maps task id -> ids it depends on (excluding taskId's own current deps, which are being replaced).
 */
export function createsDependencyCycle(taskId: number, newDeps: number[], edges: Map<number, number[]>): boolean {
  if (newDeps.includes(taskId)) return true
  const seen = new Set<number>()
  const stack = [...newDeps]
  while (stack.length) {
    const current = stack.pop()!
    if (current === taskId) return true
    if (seen.has(current)) continue
    seen.add(current)
    stack.push(...(edges.get(current) ?? []))
  }
  return false
}

/** True if making `parentId` the parent of `taskId` would make a task its own ancestor. */
export function createsParentCycle(taskId: number, parentId: number | null, parentOf: Map<number, number | null>): boolean {
  let current = parentId
  const seen = new Set<number>()
  while (current != null) {
    if (current === taskId) return true
    if (seen.has(current)) return false
    seen.add(current)
    current = parentOf.get(current) ?? null
  }
  return false
}

/** Duration in whole minutes between two ISO timestamps (clock out defaults to now). */
export function durationMinutes(clockIn: string, clockOut: string | null, now = new Date()) {
  const end = clockOut ? new Date(clockOut) : now
  return Math.max(0, Math.round((end.getTime() - new Date(clockIn).getTime()) / 60000))
}
