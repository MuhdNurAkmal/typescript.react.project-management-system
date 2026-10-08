import { format, startOfDay } from 'date-fns'

/** Duration in whole minutes between two ISO timestamps (clock out defaults to now). */
export function durationMinutes(clockIn: string, clockOut: string | null, now = new Date()) {
  const end = clockOut ? new Date(clockOut) : now
  return Math.max(0, Math.round((end.getTime() - new Date(clockIn).getTime()) / 60000))
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export const formatDate = (iso: string) => format(new Date(iso), 'dd MMM yyyy')
export const formatTime = (iso: string) => format(new Date(iso), 'HH:mm')

/** Minutes worked today (local time), clipping sessions that started before midnight. */
export function minutesToday(rows: { clock_in: string; clock_out: string | null }[], now = new Date()) {
  const midnight = startOfDay(now).getTime()
  let total = 0
  for (const r of rows) {
    const start = Math.max(new Date(r.clock_in).getTime(), midnight)
    const end = r.clock_out ? new Date(r.clock_out).getTime() : now.getTime()
    if (end > start) total += (end - start) / 60000
  }
  return Math.round(total)
}

/** An open session that started on an earlier local day: the user forgot to clock out. */
export function isStaleSession(session: { clock_in: string; clock_out: string | null }, now = new Date()) {
  return session.clock_out === null && new Date(session.clock_in) < startOfDay(now)
}

/** Value for <input type="datetime-local"> in local time. */
export const toLocalInput = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm")

export function friendlyClockError(message: string, code?: string) {
  if (code === '23505' || /already clocked in/i.test(message)) {
    return 'You are already clocked in. Clock out of your current session first.'
  }
  return message
}
