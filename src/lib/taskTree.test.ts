import { describe, expect, it } from 'vitest'
import { tasksIn } from '@/lib/taskTree'

const t = (id: number, over: Partial<{ milestone_id: number | null; start_date: string | null; due_date: string | null }> = {}) => ({
  id,
  milestone_id: 1,
  start_date: null,
  due_date: null,
  ...over,
})

describe('task order', () => {
  const tasks = [
    t(1, { start_date: '2026-06-10', due_date: '2026-06-20' }),
    t(2, { start_date: '2026-06-01', due_date: '2026-06-09' }),
    t(5, { milestone_id: null, due_date: '2026-06-05' }),
  ]

  it('lists the tasks of a phase in date order', () => {
    expect(tasksIn(tasks, 1).map((x) => x.id)).toEqual([2, 1])
  })

  it('puts tasks without dates last', () => {
    const list = [t(10), t(11, { start_date: '2026-01-01' })]
    expect(tasksIn(list, 1).map((x) => x.id)).toEqual([11, 10])
  })
})
