import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { LeaveRequest, LeaveStatus } from '@/types/database'

export function validateLeaveDates(start: string, end: string): string | null {
  if (!start || !end) return 'Choose a start and end date'
  if (end < start) return 'End date cannot be before start date'
  return null
}

/** Inclusive number of calendar days. */
export function leaveDays(start: string, end: string) {
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1
}

/** The first request with the given status whose date range includes `day` (yyyy-mm-dd). */
export function leaveOnDay(requests: LeaveRequest[], status: LeaveStatus, day: string) {
  return requests.find((r) => r.status === status && r.start_date <= day && day <= r.end_date) ?? null
}

/** True if the range overlaps another pending/approved request of the same user. */
export function overlapsExisting(requests: LeaveRequest[], start: string, end: string) {
  return requests.some((r) => r.status !== 'rejected' && r.start_date <= end && start <= r.end_date)
}
