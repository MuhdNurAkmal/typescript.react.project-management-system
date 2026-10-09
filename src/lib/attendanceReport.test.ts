import { describe, expect, it } from 'vitest'
import { detailCsv, monthlySummaryCsv, yearlySummaryCsv } from '@/lib/attendanceReport'

const names: Record<string, string> = { u1: 'Aina', u2: 'Budi' }
const nameOf = (id: string) => names[id] ?? 'Unknown'
const at = (month: number, day: number, h: number) => new Date(2026, month - 1, day, h, 0).toISOString()
const now = new Date(2026, 11, 31, 12, 0)

const rows = [
  { user_id: 'u2', clock_in: at(1, 5, 9), clock_out: at(1, 5, 17), status: 'approved' as const, note: null },
  { user_id: 'u1', clock_in: at(1, 6, 9), clock_out: at(1, 6, 13), status: 'pending' as const, note: 'half day' },
  { user_id: 'u1', clock_in: at(3, 2, 9), clock_out: at(3, 2, 11), status: 'approved' as const, note: null },
  { user_id: 'u1', clock_in: at(3, 3, 9), clock_out: at(3, 3, 10), status: 'rejected' as const, note: null },
]

describe('monthlySummaryCsv', () => {
  it('lists people alphabetically with totals, skipping rejected records', () => {
    const lines = monthlySummaryCsv(rows, nameOf, now).split('\r\n')
    expect(lines[0]).toBe('Person,Sessions,Total hours,Average hours per session')
    expect(lines[1]).toBe('Aina,2,6.00,3.00')
    expect(lines[2]).toBe('Budi,1,8.00,8.00')
    expect(lines[3]).toBe('All,3,14.00,4.67')
  })
})

describe('yearlySummaryCsv', () => {
  it('puts hours in the right month column and totals the year', () => {
    const lines = yearlySummaryCsv(rows, nameOf, now).split('\r\n')
    expect(lines[0]).toBe('Person,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Total hours,Sessions')
    expect(lines[1]).toBe('Aina,4.00,0.00,2.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,6.00,2')
    expect(lines[2]).toBe('Budi,8.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,8.00,1')
    expect(lines[3]).toBe('All,12.00,0.00,2.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,14.00,3')
  })
})

describe('detailCsv', () => {
  it('lists every session oldest first, including rejected ones', () => {
    const lines = detailCsv(rows, nameOf, now).split('\r\n')
    expect(lines).toHaveLength(5)
    expect(lines[1].startsWith('Budi,2026-01-05')).toBe(true)
    expect(lines[4]).toContain('rejected')
    expect(lines[2]).toContain('half day')
  })
})
