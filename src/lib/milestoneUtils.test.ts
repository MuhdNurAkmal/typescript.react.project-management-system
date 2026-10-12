import { describe, expect, it } from 'vitest'
import { daysUntil, milestoneProgress, taskOutsideMilestone } from '@/lib/milestoneUtils'

const m = { id: 1, start_date: '2026-06-01', end_date: '2026-06-30', completed: false }
const task = (over: Partial<{ milestone_id: number | null; parent_task_id: number | null; status: 'todo' | 'in_progress' | 'review' | 'done'; progress: number; start_date: string | null; due_date: string | null }> = {}) => ({
  milestone_id: 1,
  parent_task_id: null,
  status: 'todo' as const,
  progress: 0,
  start_date: '2026-06-02',
  due_date: '2026-06-20',
  ...over,
})

describe('daysUntil', () => {
  it('counts whole days, negative after the end', () => {
    expect(daysUntil('2026-06-30', '2026-06-20')).toBe(10)
    expect(daysUntil('2026-06-30', '2026-06-30')).toBe(0)
    expect(daysUntil('2026-06-30', '2026-07-02')).toBe(-2)
  })
})

describe('milestoneProgress', () => {
  it('counts only the tasks under this milestone', () => {
    const p = milestoneProgress(m, [task({ status: 'done', progress: 100 }), task(), task({ milestone_id: 2 }), task({ milestone_id: null })], '2026-06-01')
    expect(p).toMatchObject({ total: 2, done: 1, open: 1, percent: 50, state: 'on_track' })
  })

  it('is the average of the tasks percentages, with each task counted once', () => {
    const tasks = [
      task({ progress: 100, status: 'done' }),
      task({ progress: 50, status: 'in_progress' }),
      task({ progress: 0 }),
      task({ progress: 0, parent_task_id: 2 }), // a subtask: already inside its task's percentage
    ]
    expect(milestoneProgress(m, tasks, '2026-06-01')).toMatchObject({ total: 3, done: 1, percent: 50 })
  })

  it('is empty with no tasks and not due', () => {
    expect(milestoneProgress(m, [], '2026-06-01').state).toBe('empty')
  })

  it('is overdue once the end date passed with the milestone not done', () => {
    expect(milestoneProgress(m, [task()], '2026-07-01').state).toBe('overdue')
    expect(milestoneProgress(m, [], '2026-07-01').state).toBe('overdue')
  })

  it('is done when completed, even after the end date', () => {
    expect(milestoneProgress({ ...m, completed: true }, [task({ status: 'done', progress: 100 })], '2026-07-10')).toMatchObject({ state: 'done', percent: 100 })
  })

  it('is at risk within a week of the end with tasks open', () => {
    expect(milestoneProgress(m, [task()], '2026-06-24').state).toBe('at_risk')
    expect(milestoneProgress(m, [task()], '2026-06-22').state).toBe('on_track')
  })

  it('is at risk when an open task is planned after the end date', () => {
    expect(milestoneProgress(m, [task({ due_date: '2026-07-05' })], '2026-06-05').state).toBe('at_risk')
    expect(milestoneProgress(m, [task({ due_date: '2026-07-05', status: 'done' })], '2026-06-05').state).toBe('on_track')
  })
})

describe('taskOutsideMilestone', () => {
  it('warns about tasks planned outside the phase', () => {
    expect(taskOutsideMilestone({ start_date: '2026-06-05', due_date: '2026-06-25' }, m)).toBeNull()
    expect(taskOutsideMilestone({ start_date: null, due_date: '2026-07-01' }, m)).toBe('after')
    expect(taskOutsideMilestone({ start_date: '2026-05-20', due_date: null }, m)).toBe('before')
    expect(taskOutsideMilestone({ start_date: null, due_date: null }, m)).toBeNull()
  })
})
