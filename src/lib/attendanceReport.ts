import { format } from 'date-fns'
import { durationMinutes, formatTime } from '@/lib/attendanceUtils'
import { summarizeAttendance, toCsv } from '@/lib/reportUtils'
import type { Attendance } from '@/types/database'

type Row = Pick<Attendance, 'user_id' | 'clock_in' | 'clock_out' | 'status' | 'note'>
type NameOf = (userId: string) => string

const hours = (minutes: number) => (minutes / 60).toFixed(2)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** One line per person: sessions, total hours and average hours per session. Rejected records are left out. */
export function monthlySummaryCsv(rows: Row[], nameOf: NameOf, now = new Date()) {
  const summary = summarizeAttendance(rows, now).sort((a, b) => nameOf(a.user_id).localeCompare(nameOf(b.user_id)))
  const lines = summary.map((s) => [nameOf(s.user_id), s.sessions, hours(s.minutes), hours(s.minutes / s.sessions)])
  const total = summary.reduce((acc, s) => ({ sessions: acc.sessions + s.sessions, minutes: acc.minutes + s.minutes }), { sessions: 0, minutes: 0 })
  lines.push(['All', total.sessions, hours(total.minutes), total.sessions ? hours(total.minutes / total.sessions) : '0.00'])
  return toCsv(['Person', 'Sessions', 'Total hours', 'Average hours per session'], lines)
}

/** One line per person with hours for each month of the year, then the year total. Rejected records are left out. */
export function yearlySummaryCsv(rows: Row[], nameOf: NameOf, now = new Date()) {
  const perUser = new Map<string, { months: number[]; sessions: number }>()
  for (const r of rows) {
    if (r.status === 'rejected') continue
    const entry = perUser.get(r.user_id) ?? { months: Array<number>(12).fill(0), sessions: 0 }
    entry.months[new Date(r.clock_in).getMonth()] += durationMinutes(r.clock_in, r.clock_out, now)
    entry.sessions += 1
    perUser.set(r.user_id, entry)
  }
  const people = [...perUser.entries()].sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])))
  const lines = people.map(([id, e]) => [nameOf(id), ...e.months.map(hours), hours(e.months.reduce((a, b) => a + b, 0)), e.sessions])
  const monthTotals = Array<number>(12).fill(0)
  let sessions = 0
  for (const [, e] of people) {
    e.months.forEach((m, i) => (monthTotals[i] += m))
    sessions += e.sessions
  }
  lines.push(['All', ...monthTotals.map(hours), hours(monthTotals.reduce((a, b) => a + b, 0)), sessions])
  return toCsv(['Person', ...MONTHS, 'Total hours', 'Sessions'], lines)
}

/** Every session in the period, oldest first, including rejected ones (the status column says which). */
export function detailCsv(rows: Row[], nameOf: NameOf, now = new Date()) {
  const sorted = [...rows].sort((a, b) => a.clock_in.localeCompare(b.clock_in))
  const lines = sorted.map((r) => [
    nameOf(r.user_id),
    format(new Date(r.clock_in), 'yyyy-MM-dd'),
    formatTime(r.clock_in),
    r.clock_out ? formatTime(r.clock_out) : '',
    hours(durationMinutes(r.clock_in, r.clock_out, now)),
    r.status,
    r.note,
  ])
  return toCsv(['Person', 'Date', 'Clock in', 'Clock out', 'Hours', 'Status', 'Note'], lines)
}
