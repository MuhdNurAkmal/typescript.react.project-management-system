import { describe, expect, it } from 'vitest'
import { milestoneActual, taskActual } from '@/lib/actualDates'

const task = (over: Partial<Parameters<typeof taskActual>[0]> = {}) => ({
  status: 'todo',
  start_date: '2026-03-01',
  due_date: '2026-03-10',
  actual_start: null,
  actual_end: null,
  ...over,
})

describe('taskActual', () => {
  it('has no bar before the task starts', () => {
    expect(taskActual(task(), '2026-03-05')).toBeNull()
  })

  it('runs to today while the task is still going', () => {
    expect(taskActual(task({ status: 'in_progress', actual_start: '2026-03-02' }), '2026-03-05')).toEqual({
      start: '2026-03-02',
      end: '2026-03-05',
      ongoing: true,
      late: false,
    })
  })

  it('is late once today passes the planned end', () => {
    expect(taskActual(task({ status: 'in_progress', actual_start: '2026-03-02' }), '2026-03-12')?.late).toBe(true)
  })

  it('uses the real end when finished, late or not', () => {
    const onTime = taskActual(task({ status: 'done', actual_start: '2026-03-02', actual_end: '2026-03-09' }), '2026-04-01')
    expect(onTime).toMatchObject({ end: '2026-03-09', ongoing: false, late: false })
    const slipped = taskActual(task({ status: 'done', actual_start: '2026-03-02', actual_end: '2026-03-14' }), '2026-04-01')
    expect(slipped).toMatchObject({ end: '2026-03-14', late: true })
  })

  it('a finished task without an end date is a one-day bar, not a running one', () => {
    expect(taskActual(task({ status: 'done', actual_start: '2026-03-02' }), '2026-04-01')).toMatchObject({ end: '2026-03-02', ongoing: false })
  })
})

describe('milestoneActual', () => {
  const t = (over = {}) => task(over)

  it('has no bar until a task has started', () => {
    expect(milestoneActual([t(), t()], '2026-03-31', '2026-03-05')).toBeNull()
  })

  it('starts at the first actual start and runs to today while tasks are open', () => {
    const bar = milestoneActual([t({ status: 'in_progress', actual_start: '2026-03-04' }), t({ status: 'in_progress', actual_start: '2026-03-02' }), t()], '2026-03-31', '2026-03-08')
    expect(bar).toEqual({ start: '2026-03-02', end: '2026-03-08', ongoing: true, late: false })
  })

  it('ends at the last actual end once everything is done', () => {
    const bar = milestoneActual(
      [t({ status: 'done', actual_start: '2026-03-02', actual_end: '2026-03-20' }), t({ status: 'done', actual_start: '2026-03-03', actual_end: '2026-04-02' })],
      '2026-03-31',
      '2026-05-01',
    )
    expect(bar).toEqual({ start: '2026-03-02', end: '2026-04-02', ongoing: false, late: true })
  })
})
