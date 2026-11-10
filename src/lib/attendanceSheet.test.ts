import { describe, expect, it } from 'vitest'
import { buildSheet, chunk, daysBetween, leaveCode } from '@/lib/attendanceSheet'

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

describe('leave codes', () => {
  const types = [
    { id: 1, name: 'Annual leave', blocks_clock_in: true },
    { id: 2, name: 'Medical leave (MC)', blocks_clock_in: true },
    { id: 3, name: 'Emergency leave', blocks_clock_in: true },
    { id: 4, name: 'Unpaid leave', blocks_clock_in: true },
    { id: 5, name: 'Work from home', blocks_clock_in: false },
    { id: 6, name: 'Other', blocks_clock_in: true },
  ]

  it('writes the standard types as AL, MC, EL, UL and WFH, and others as their initials', () => {
    expect(types.map((t) => leaveCode(t.name))).toEqual(['AL', 'MC', 'EL', 'UL', 'WFH', 'O'])
    expect(leaveCode('Study leave')).toBe('SL')
  })

  const people = [{ id: 'u1', name: 'Aina' }]
  // Mon 1 to Sun 7 June 2026, today is Wed the 3rd
  const make = (leave: { leave_type_id: number; start_date: string; end_date: string }, clocked: string[] = []) =>
    buildSheet(
      clocked.map((d) => ({ user_id: 'u1', clock_in: new Date(`${d}T09:00:00`).toISOString() })),
      people,
      '2026-06-01',
      '2026-06-07',
      '2026-06-03',
      [{ user_id: 'u1', ...leave }],
      types,
    )

  it('puts the code on every weekday of an approved leave, but not on weekends', () => {
    const row = make({ leave_type_id: 1, start_date: '2026-06-02', end_date: '2026-06-07' }).rows[0]
    expect(row.codes).toEqual([null, 'AL', 'AL', 'AL', 'AL', null, null])
  })

  it('does not count leave days as missed', () => {
    const row = make({ leave_type_id: 2, start_date: '2026-06-01', end_date: '2026-06-02' }).rows[0]
    // Mon and Tue are on MC, Wed is a missed day, Thu and Fri have not happened yet
    expect(row).toMatchObject({ present: 0, workdays: 1 })
  })

  it('counts a work-from-home day like a normal day: present when clocked in, missed when not', () => {
    const wfh = { leave_type_id: 5, start_date: '2026-06-01', end_date: '2026-06-02' }
    const row = make(wfh, ['2026-06-01']).rows[0]
    expect(row.codes.slice(0, 2)).toEqual(['WFH', 'WFH'])
    expect(row.cells.slice(0, 2)).toEqual(['present', 'absent'])
    expect(row).toMatchObject({ present: 1, workdays: 3 })
  })

  it('lists the codes used for the legend', () => {
    const sheet = make({ leave_type_id: 3, start_date: '2026-06-02', end_date: '2026-06-02' })
    expect(sheet.legend).toEqual([{ code: 'EL', name: 'Emergency leave' }])
  })
})
