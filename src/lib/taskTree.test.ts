import { describe, expect, it } from 'vitest'
import { leafTasks, orderedWithin, subtasksOf, taskCodes, topLevel } from '@/lib/taskTree'

const t = (id: number, over: Partial<{ parent_task_id: number | null; milestone_id: number | null; start_date: string | null; due_date: string | null }> = {}) => ({
  id,
  parent_task_id: null,
  milestone_id: 1,
  start_date: null,
  due_date: null,
  ...over,
})

describe('task tree', () => {
  const tasks = [
    t(1, { start_date: '2026-06-10', due_date: '2026-06-20' }),
    t(2, { start_date: '2026-06-01', due_date: '2026-06-09' }),
    t(3, { parent_task_id: 1, start_date: '2026-06-15', due_date: '2026-06-18' }),
    t(4, { parent_task_id: 1, start_date: '2026-06-10', due_date: '2026-06-12' }),
    t(5, { milestone_id: null, due_date: '2026-06-05' }),
  ]

  it('numbers tasks by date inside their phase, and subtasks as 1.1, 1.2', () => {
    const codes = taskCodes(tasks)
    expect(codes.get(2)).toBe('1')
    expect(codes.get(1)).toBe('2')
    expect(codes.get(4)).toBe('2.1')
    expect(codes.get(3)).toBe('2.2')
  })

  it('numbers tasks with no phase among themselves', () => {
    expect(taskCodes(tasks).get(5)).toBe('1')
  })

  it('lists each task followed by its subtasks, in date order', () => {
    expect(orderedWithin(tasks, 1).map((x) => [x.task.id, x.indent])).toEqual([
      [2, false],
      [1, false],
      [4, true],
      [3, true],
    ])
  })

  it('puts tasks without dates last', () => {
    const list = [t(10), t(11, { start_date: '2026-01-01' })]
    expect(orderedWithin(list, 1).map((x) => x.task.id)).toEqual([11, 10])
  })

  it('finds top-level tasks, subtasks and the leaves', () => {
    expect(topLevel(tasks).map((x) => x.id)).toEqual([1, 2, 5])
    expect(subtasksOf(tasks, 1).map((x) => x.id)).toEqual([4, 3])
    expect(leafTasks(tasks).map((x) => x.id).sort()).toEqual([2, 3, 4, 5])
  })
})
