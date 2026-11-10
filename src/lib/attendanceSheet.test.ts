import { describe, expect, it } from 'vitest'
import { buildSheet, chunk, daysBetween } from '@/lib/attendanceSheet'

const at = (day: string, h = 9) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).toISOString()

describe('daysBetween', () => {
  it('lists every date, both ends included, and marks Saturdays and Sundays', () => {
    // 2026-06-01 is a Monday
    const days = daysBetween('2026-06-05', '2026-06-08')
    expect(days.map((d) => d.date)).toEqual(['2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08'])
    expect(days.map((d) => d.weekend)).toEqual([false, true, true, false])
  })

  it('is a single day when from and to are the same', () => {
    expect(daysBetween('2026-06-03', '2026-06-03')).toHaveLength(1)
  })
})

describe('buildSheet', () => {
  const people = [
    { id: 'u2', name: 'Budi' },
    { id: 'u1', name: 'Aina' },
  ]
  const sessions = [
    { user_id: 'u1', clock_in: at('2026-06-01') },
    { user_id: 'u1', clock_in: at('2026-06-01', 14) }, // a second session on the same day counts once
    { user_id: 'u1', clock_in: at('2026-06-03') },
    { user_id: 'u2', clock_in: at('2026-06-02') },
    { user_id: 'u2', clock_in: at('2026-06-06') }, // clocked in on a Saturday: the cell stays a weekend cell
  ]
  const sheet = buildSheet(sessions, people, '2026-06-01', '2026-06-08', '2026-06-05')

  it('lists people alphabetically', () => {
    expect(sheet.rows.map((r) => r.name)).toEqual(['Aina', 'Budi'])
  })

  it('marks present, absent, weekend and upcoming days', () => {
    // Mon Tue Wed Thu Fri Sat Sun Mon, today is Friday the 5th
    expect(sheet.rows[0].cells).toEqual(['present', 'absent', 'present', 'absent', 'absent', 'weekend', 'weekend', 'future'])
    expect(sheet.rows[1].cells).toEqual(['absent', 'present', 'absent', 'absent', 'absent', 'weekend', 'weekend', 'future'])
  })

  it('counts present days against the weekdays that have passed', () => {
    expect(sheet.rows[0]).toMatchObject({ present: 2, workdays: 5 })
    expect(sheet.rows[1]).toMatchObject({ present: 1, workdays: 5 })
  })

  it('shows someone with no sessions as absent on every past weekday', () => {
    const empty = buildSheet([], [{ id: 'x', name: 'Zed' }], '2026-06-01', '2026-06-02', '2026-06-30')
    expect(empty.rows[0].cells).toEqual(['absent', 'absent'])
  })
})

describe('chunk', () => {
  it('splits a list into pieces no longer than the size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
