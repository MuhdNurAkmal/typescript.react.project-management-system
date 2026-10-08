import { describe, expect, it } from 'vitest'
import { leaveDays, leaveOnDay, overlapsExisting, validateLeaveDates } from '@/lib/leaveUtils'
import { validateProjectForm, emptyProjectForm } from '@/lib/projectValidation'
import { csvEscape, projectProgress, summarizeAttendance, summarizeTasks, toCsv } from '@/lib/reportUtils'
import type { LeaveRequest, Task } from '@/types/database'

describe('csv', () => {
  it('quotes cells containing commas, quotes and newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })
  it('neutralises spreadsheet formulas but keeps plain numbers', () => {
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvEscape('@cmd')).toBe("'@cmd")
    expect(csvEscape('-5')).toBe('-5')
    expect(csvEscape(null)).toBe('')
  })
  it('joins rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x')
  })
})

describe('summarizeAttendance', () => {
  const now = new Date('2026-05-10T12:00:00Z')
  const rows = [
    { user_id: 'u1', clock_in: '2026-05-01T01:00:00Z', clock_out: '2026-05-01T09:00:00Z', status: 'approved' as const },
    { user_id: 'u1', clock_in: '2026-05-02T01:00:00Z', clock_out: '2026-05-02T03:00:00Z', status: 'pending' as const },
    { user_id: 'u2', clock_in: '2026-05-02T01:00:00Z', clock_out: '2026-05-02T02:00:00Z', status: 'rejected' as const },
  ]
  it('totals minutes per person and skips rejected records by default', () => {
    expect(summarizeAttendance(rows, now)).toEqual([{ user_id: 'u1', sessions: 2, minutes: 600 }])
  })
  it('can include rejected records', () => {
    expect(summarizeAttendance(rows, now, true)).toHaveLength(2)
  })
})

describe('task summaries', () => {
  const base = { project_id: 1, description: null, start_date: null, priority: 'medium', parent_task_id: null, created_by: 'x', created_at: '' } as const
  const tasks = [
    { ...base, id: 1, title: 'a', assignee_id: 'u1', due_date: '2026-05-01', status: 'todo', progress: 0 },
    { ...base, id: 2, title: 'b', assignee_id: 'u1', due_date: '2026-05-01', status: 'done', progress: 100 },
    { ...base, id: 3, title: 'c', assignee_id: null, due_date: '2026-06-01', status: 'in_progress', progress: 50 },
  ] as Task[]

  it('counts by status and assignee including overdue', () => {
    const s = summarizeTasks(tasks, '2026-05-10')
    expect(s.byStatus).toEqual({ todo: 1, in_progress: 1, review: 0, done: 1 })
    const u1 = s.byAssignee.find((a) => a.assignee_id === 'u1')!
    expect(u1).toMatchObject({ total: 2, overdue: 1 })
    expect(s.byAssignee.find((a) => a.assignee_id === null)!.total).toBe(1)
  })
  it('computes project progress', () => {
    expect(projectProgress(tasks, '2026-05-10')).toEqual({ total: 3, done: 1, overdue: 1, avgProgress: 50 })
    expect(projectProgress([], '2026-05-10').avgProgress).toBe(0)
  })
})

describe('leave helpers', () => {
  const req = (start: string, end: string, status: LeaveRequest['status']) => ({ start_date: start, end_date: end, status }) as LeaveRequest

  it('validates dates', () => {
    expect(validateLeaveDates('2026-05-02', '2026-05-01')).toMatch(/before/i)
    expect(validateLeaveDates('2026-05-01', '2026-05-01')).toBeNull()
  })
  it('counts days inclusively', () => {
    expect(leaveDays('2026-05-01', '2026-05-01')).toBe(1)
    expect(leaveDays('2026-05-01', '2026-05-05')).toBe(5)
  })
  it('finds leave covering a day by status', () => {
    const list = [req('2026-05-01', '2026-05-03', 'approved'), req('2026-05-10', '2026-05-12', 'pending')]
    expect(leaveOnDay(list, 'approved', '2026-05-02')).not.toBeNull()
    expect(leaveOnDay(list, 'approved', '2026-05-04')).toBeNull()
    expect(leaveOnDay(list, 'pending', '2026-05-11')).not.toBeNull()
  })
  it('detects overlaps but ignores rejected requests', () => {
    const list = [req('2026-05-01', '2026-05-03', 'approved'), req('2026-05-10', '2026-05-12', 'rejected')]
    expect(overlapsExisting(list, '2026-05-03', '2026-05-04')).toBe(true)
    expect(overlapsExisting(list, '2026-05-04', '2026-05-05')).toBe(false)
    expect(overlapsExisting(list, '2026-05-10', '2026-05-11')).toBe(false)
  })
})

describe('validateProjectForm', () => {
  it('requires a name and ordered dates and a non-negative budget', () => {
    expect(validateProjectForm(emptyProjectForm)).toMatch(/name/i)
    expect(validateProjectForm({ ...emptyProjectForm, name: 'X', start_date: '2026-02-01', end_date: '2026-01-01' })).toMatch(/end date/i)
    expect(validateProjectForm({ ...emptyProjectForm, name: 'X', budget: '-1' })).toMatch(/budget/i)
    expect(validateProjectForm({ ...emptyProjectForm, name: 'X', budget: '1000' })).toBeNull()
  })
})
