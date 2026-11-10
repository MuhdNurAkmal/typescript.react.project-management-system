import { addDays, format, parseISO } from 'date-fns'

/*
 * The attendance sheet: one row per person, one column per day.
 *   present - the person clocked in that day
 *   absent  - a weekday that has passed with no clock-in
 *   weekend - Saturday or Sunday (left blank, drawn blue)
 *   future  - a weekday that has not happened yet (left blank)
 * On a weekday with an approved leave or work-from-home request the cell shows its code instead (AL, MC, EL, UL, WFH).
 * Leave days are excused (not counted as missed); a work-from-home day counts like any other if the person clocked in.
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
  /** The leave / WFH code for each day (null when none); weekends never carry one. */
  codes: (string | null)[]
  /** Weekdays with a clock-in. */
  present: number
  /** Weekdays that have already passed (the days someone could have attended). */
  workdays: number
}

export interface SheetData {
  days: SheetDay[]
  rows: SheetRow[]
  /** The codes that appear in the sheet, with the full name, for the legend. */
  legend: { code: string; name: string }[]
}

export interface SheetLeaveType {
  id: number
  name: string
  blocks_clock_in: boolean
}

export interface SheetLeave {
  user_id: string
  leave_type_id: number
  start_date: string
  end_date: string
}

/** AL, MC, WFH, EL, UL for the standard types; any other type uses the initials of its name. */
export function leaveCode(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('annual')) return 'AL'
  if (n.includes('medical') || /\bmc\b/.test(n)) return 'MC'
  if (n.includes('work from home') || n.includes('wfh')) return 'WFH'
  if (n.includes('emergency')) return 'EL'
  if (n.includes('unpaid')) return 'UL'
  const initials = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join('')
  return initials.slice(0, 3) || '?'
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
  leaves: SheetLeave[] = [],
  types: SheetLeaveType[] = [],
): SheetData {
  const days = daysBetween(from, to)
  const attended = new Map<string, Set<string>>()
  for (const s of sessions) {
    const day = format(new Date(s.clock_in), 'yyyy-MM-dd')
    attended.set(s.user_id, (attended.get(s.user_id) ?? new Set()).add(day))
  }
  const typeOf = new Map(types.map((t) => [t.id, t]))
  const used = new Map<string, string>()
  const rows = people
    .map((p): SheetRow => {
      const mine = attended.get(p.id) ?? new Set<string>()
      const myLeave = leaves.filter((l) => l.user_id === p.id)
      let present = 0
      let workdays = 0
      const codes: (string | null)[] = days.map((d) => {
        if (d.weekend) return null
        const l = myLeave.find((x) => x.start_date <= d.date && d.date <= x.end_date)
        const t = l ? typeOf.get(l.leave_type_id) : undefined
        if (!t) return null
        const code = leaveCode(t.name)
        used.set(code, t.name)
        return code
      })
      const cells = days.map((d, i): DayState => {
        if (d.weekend) return 'weekend'
        const type = myLeave.find((x) => x.start_date <= d.date && d.date <= x.end_date)
        const remote = type ? typeOf.get(type.leave_type_id)?.blocks_clock_in === false : false
        // time off is excused: it is not a missed day and not a working day
        if (codes[i] && !remote) return 'future'
        if (mine.has(d.date)) {
          present += 1
          workdays += 1
          return 'present'
        }
        if (d.date > today) return 'future'
        workdays += 1
        return 'absent'
      })
      return { userId: p.id, name: p.name, cells, codes, present, workdays }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const legend = [...used.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code))
  return { days, rows, legend }
}

/** Splits a long list of days into pieces of at most `size`, so each piece fits on one page. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
