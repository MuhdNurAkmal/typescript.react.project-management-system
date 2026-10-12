import { describe, expect, it } from 'vitest'
import { checklistPercent, taskPercent } from '@/lib/checklist'

describe('checklist', () => {
  it('averages ticks and percentages together', () => {
    expect(checklistPercent([{ progress: 100 }, { progress: 0 }, { progress: 50 }])).toBe(50)
    expect(checklistPercent([{ progress: 100 }, { progress: 0 }, { progress: 0 }])).toBe(33)
  })

  it('is 0 for an empty checklist', () => {
    expect(checklistPercent([])).toBe(0)
  })

  it('shows the checklist average, or the task own value when there is none', () => {
    expect(taskPercent({ status: 'in_progress', progress: 10 }, [{ progress: 100 }, { progress: 50 }])).toBe(75)
    expect(taskPercent({ status: 'in_progress', progress: 10 }, [])).toBe(10)
  })

  it('counts a Done task as 100', () => {
    expect(taskPercent({ status: 'done', progress: 40 }, [{ progress: 20 }])).toBe(100)
  })
})
