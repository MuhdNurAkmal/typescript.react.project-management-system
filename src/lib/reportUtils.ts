import { durationMinutes } from '@/lib/attendanceUtils'
import { isOverdue } from '@/lib/taskValidation'
import type { Attendance, Task, TaskStatus } from '@/types/database'

type CsvCell = string | number | null | undefined

/** Escape one CSV cell. Cells that start with =, +, - or @ get a leading quote so spreadsheets don't run them as formulas. */
export function csvEscape(value: CsvCell): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface AttendanceSummary {
  user_id: string
  sessions: number
  minutes: number
}

/** Total worked minutes and session count per person. Rejected records are excluded unless asked for. */
export function summarizeAttendance(
  rows: Pick<Attendance, 'user_id' | 'clock_in' | 'clock_out' | 'status'>[],
  now = new Date(),
  includeRejected = false,
): AttendanceSummary[] {
  const byUser = new Map<string, AttendanceSummary>()
  for (const r of rows) {
    if (!includeRejected && r.status === 'rejected') continue
    const entry = byUser.get(r.user_id) ?? { user_id: r.user_id, sessions: 0, minutes: 0 }
    entry.sessions += 1
    entry.minutes += durationMinutes(r.clock_in, r.clock_out, now)
    byUser.set(r.user_id, entry)
  }
  return [...byUser.values()].sort((a, b) => b.minutes - a.minutes)
}

export interface AssigneeSummary {
  assignee_id: string | null
  counts: Record<TaskStatus, number>
  total: number
  overdue: number
}

const emptyCounts = (): Record<TaskStatus, number> => ({ todo: 0, in_progress: 0, review: 0, done: 0 })

export function summarizeTasks(tasks: Task[], today: string) {
  const byStatus = emptyCounts()
  const byAssignee = new Map<string | null, AssigneeSummary>()
  for (const t of tasks) {
    byStatus[t.status] += 1
    const entry = byAssignee.get(t.assignee_id) ?? { assignee_id: t.assignee_id, counts: emptyCounts(), total: 0, overdue: 0 }
    entry.counts[t.status] += 1
    entry.total += 1
    if (isOverdue(t, today)) entry.overdue += 1
    byAssignee.set(t.assignee_id, entry)
  }
  return { byStatus, byAssignee: [...byAssignee.values()].sort((a, b) => b.total - a.total) }
}

/** Overall progress of a project's tasks: counts plus the average progress percentage. */
export function projectProgress(tasks: Pick<Task, 'status' | 'progress' | 'due_date'>[], today: string) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const overdue = tasks.filter((t) => isOverdue(t, today)).length
  const avg = total === 0 ? 0 : Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / total)
  return { total, done, overdue, avgProgress: avg }
}
