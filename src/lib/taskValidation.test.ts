import { describe, expect, it } from 'vitest'
import { createsDependencyCycle, createsParentCycle, isOverdue, validateTaskDates } from '@/lib/taskValidation'

describe('validateTaskDates', () => {
  it('accepts equal, ordered or missing dates', () => {
    expect(validateTaskDates('2026-01-01', '2026-01-01')).toBeNull()
    expect(validateTaskDates('2026-01-01', '2026-02-01')).toBeNull()
    expect(validateTaskDates('', '2026-02-01')).toBeNull()
    expect(validateTaskDates('2026-01-01', '')).toBeNull()
  })

  it('rejects a due date before the start date', () => {
    expect(validateTaskDates('2026-02-01', '2026-01-31')).toMatch(/before start/i)
  })
})

describe('isOverdue', () => {
  const today = '2026-05-10'
  it('is overdue when past due and not done', () => {
    expect(isOverdue({ due_date: '2026-05-09', status: 'todo' }, today)).toBe(true)
  })
  it('is not overdue on the due date, when done, or without a due date', () => {
    expect(isOverdue({ due_date: today, status: 'todo' }, today)).toBe(false)
    expect(isOverdue({ due_date: '2026-05-01', status: 'done' }, today)).toBe(false)
    expect(isOverdue({ due_date: null, status: 'todo' }, today)).toBe(false)
  })
})

describe('createsDependencyCycle', () => {
  // 2 depends on 3, 3 depends on 4
  const edges = new Map<number, number[]>([
    [2, [3]],
    [3, [4]],
  ])

  it('rejects a self dependency', () => {
    expect(createsDependencyCycle(1, [1], edges)).toBe(true)
  })
  it('rejects a direct cycle', () => {
    expect(createsDependencyCycle(3, [2], edges)).toBe(true)
  })
  it('rejects an indirect cycle', () => {
    expect(createsDependencyCycle(4, [2], edges)).toBe(true)
  })
  it('allows a valid dependency', () => {
    expect(createsDependencyCycle(1, [2, 3], edges)).toBe(false)
    expect(createsDependencyCycle(2, [4], edges)).toBe(false)
  })
  it('terminates on pre-existing cycles elsewhere in the graph', () => {
    const loop = new Map<number, number[]>([
      [5, [6]],
      [6, [5]],
    ])
    expect(createsDependencyCycle(1, [5], loop)).toBe(false)
  })
})

describe('createsParentCycle', () => {
  // 3 -> 2 -> 1 (child -> parent)
  const parentOf = new Map<number, number | null>([
    [1, null],
    [2, 1],
    [3, 2],
  ])
  it('rejects being your own parent or ancestor', () => {
    expect(createsParentCycle(1, 1, parentOf)).toBe(true)
    expect(createsParentCycle(1, 3, parentOf)).toBe(true)
  })
  it('allows a valid parent or none', () => {
    expect(createsParentCycle(3, 1, parentOf)).toBe(false)
    expect(createsParentCycle(3, null, parentOf)).toBe(false)
  })
})
