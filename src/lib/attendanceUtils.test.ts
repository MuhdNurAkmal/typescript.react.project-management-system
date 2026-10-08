import { describe, expect, it } from 'vitest'
import { durationMinutes, formatDuration, formatElapsed, friendlyClockError, isStaleSession, minutesToday } from '@/lib/attendanceUtils'

describe('durationMinutes', () => {
  it('measures a closed session', () => {
    expect(durationMinutes('2026-05-10T01:00:00Z', '2026-05-10T09:30:00Z')).toBe(510)
  })
  it('uses now for an open session', () => {
    expect(durationMinutes('2026-05-10T01:00:00Z', null, new Date('2026-05-10T01:45:00Z'))).toBe(45)
  })
  it('never returns a negative duration', () => {
    expect(durationMinutes('2026-05-10T05:00:00Z', '2026-05-10T04:00:00Z')).toBe(0)
  })
})

describe('formatting', () => {
  it('formats durations as hours and minutes', () => {
    expect(formatDuration(0)).toBe('0h 00m')
    expect(formatDuration(510)).toBe('8h 30m')
  })
  it('formats elapsed time as HH:MM:SS and clamps negatives', () => {
    expect(formatElapsed(3_723_000)).toBe('01:02:03')
    expect(formatElapsed(-5000)).toBe('00:00:00')
  })
})

describe('minutesToday', () => {
  const now = new Date(2026, 4, 10, 15, 0, 0) // local 15:00
  it('sums sessions today, including an open one', () => {
    const rows = [
      { clock_in: new Date(2026, 4, 10, 9, 0).toISOString(), clock_out: new Date(2026, 4, 10, 12, 0).toISOString() },
      { clock_in: new Date(2026, 4, 10, 14, 0).toISOString(), clock_out: null },
    ]
    expect(minutesToday(rows, now)).toBe(180 + 60)
  })
  it('clips a session that started before midnight', () => {
    const rows = [{ clock_in: new Date(2026, 4, 9, 22, 0).toISOString(), clock_out: new Date(2026, 4, 10, 2, 0).toISOString() }]
    expect(minutesToday(rows, now)).toBe(120)
  })
  it('ignores sessions from earlier days', () => {
    const rows = [{ clock_in: new Date(2026, 4, 8, 9, 0).toISOString(), clock_out: new Date(2026, 4, 8, 17, 0).toISOString() }]
    expect(minutesToday(rows, now)).toBe(0)
  })
})

describe('isStaleSession', () => {
  const now = new Date(2026, 4, 10, 9, 0)
  it('flags an open session from a previous day', () => {
    expect(isStaleSession({ clock_in: new Date(2026, 4, 9, 17, 0).toISOString(), clock_out: null }, now)).toBe(true)
  })
  it('does not flag today or closed sessions', () => {
    expect(isStaleSession({ clock_in: new Date(2026, 4, 10, 8, 0).toISOString(), clock_out: null }, now)).toBe(false)
    expect(isStaleSession({ clock_in: new Date(2026, 4, 9, 8, 0).toISOString(), clock_out: new Date(2026, 4, 9, 17, 0).toISOString() }, now)).toBe(false)
  })
})

describe('friendlyClockError', () => {
  it('explains a double clock-in', () => {
    expect(friendlyClockError('duplicate key value', '23505')).toMatch(/already clocked in/i)
    expect(friendlyClockError('You are already clocked in. Clock out first.')).toMatch(/already clocked in/i)
  })
  it('passes other messages through', () => {
    expect(friendlyClockError('You are on approved leave today')).toBe('You are on approved leave today')
  })
})
