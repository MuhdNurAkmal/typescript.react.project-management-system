import { addDays, format, parseISO } from 'date-fns'

/*
 * The attendance sheet: one row per person, one column per day.
 *   present - the person clocked in that day
 *   absent  - a weekday that has passed with no clock-in
 *   weekend - Saturday or Sunday (left blank, drawn blue)
 *   future  - a weekday that has not happened yet (left blank)
 * Pure functions so they can be tested; the PDF only draws what they return.
 */
export type DayState = 'present' | 'absent' | 'weekend' | 'future'

export interface SheetDay {
  /** yyyy-MM-dd */
  date: string
  weekend: boolean
}

export interface SheetRow {
  userId: string
  name: string
  cells: DayState[]
  /** Weekdays with a clock-in. */
  present: number
  /** Weekdays that have already passed (the days someone could have attended). */
  workdays: number
}

export interface SheetData {
  days: SheetDay[]
  rows: SheetRow[]
}

/** Every date from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): SheetDay[] {
  const days: SheetDay[] = []
  for (let d = parseISO(from); format(d, 'yyyy-MM-dd') <= to; d = addDays(d, 1)) {
    const dow = d.getDay()
    days.push({ date: format(d, 'yyyy-MM-dd'), weekend: dow === 0 || dow === 6 })
  }
  return days
}

export function buildSheet(
  sessions: { user_id: string; clock_in: string }[],
  people: { id: string; name: string }[],
  from: string,
  to: string,
  today: string,
): SheetData {
  const days = daysBetween(from, to)
  const attended = new Map<string, Set<string>>()
  for (const s of sessions) {
    const day = format(new Date(s.clock_in), 'yyyy-MM-dd')
    attended.set(s.user_id, (attended.get(s.user_id) ?? new Set()).add(day))
  }
  const rows = people
    .map((p): SheetRow => {
      const mine = attended.get(p.id) ?? new Set<string>()
      let present = 0
      let workdays = 0
      const cells = days.map((d): DayState => {
        if (d.weekend) return 'weekend'
        if (mine.has(d.date)) {
          present += 1
          workdays += 1
          return 'present'
        }
        if (d.date > today) return 'future'
        workdays += 1
        return 'absent'
      })
      return { userId: p.id, name: p.name, cells, present, workdays }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return { days, rows }
}

/** Splits a long list of days into pieces of at most `size`, so each piece fits on one page. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
