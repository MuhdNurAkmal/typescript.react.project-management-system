import { useEffect, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { AttendanceStatusBadge } from '@/components/attendance/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMyAttendance } from '@/hooks/useAttendance'
import { useClock } from '@/hooks/useClock'
import { useOrg } from '@/hooks/useOrg'
import { useLeaveTypes, useMyLeave } from '@/hooks/useLeave'
import {
  durationMinutes,
  formatDate,
  formatDuration,
  formatElapsed,
  formatTime,
  isStaleSession,
  minutesToday,
} from '@/lib/attendanceUtils'
import { leaveOnDay } from '@/lib/leaveUtils'
import { todayString } from '@/lib/taskValidation'

/** Clock in/out card plus personal history. Attendance is general: it is not tied to a project. */
export function MyAttendance() {
  const { open, openOrgName, openElsewhere, pending, toggle } = useClock()
  const { current } = useOrg()
  const { data: rows, isLoading, error } = useMyAttendance()
  const { data: leave } = useMyLeave()
  const { data: types } = useLeaveTypes()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const today = todayString()
  const approvedToday = leaveOnDay(leave ?? [], 'approved', today)
  const pendingToday = leaveOnDay(leave ?? [], 'pending', today)
  const leaveName = (id: number) => types?.find((t) => t.id === id)?.name ?? 'leave'
  const stale = open && isStaleSession(open, now)
  const blocked = !open && !!approvedToday

  return (
    <div className="space-y-4">
      {stale && open && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            You are still clocked in from{' '}
            <strong>
              {formatDate(open.clock_in)} {formatTime(open.clock_in)}
            </strong>
            . You probably forgot to clock out. Ask a company admin to correct the end time, or clock out now.
          </div>
        </div>
      )}
      {approvedToday && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/50 bg-blue-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-600" />
          <div>You are on approved {leaveName(approvedToday.leave_type_id)} today, so clocking in is disabled.</div>
        </div>
      )}
      {!approvedToday && pendingToday && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div>
            You have a pending {leaveName(pendingToday.leave_type_id)} request covering today. You can still clock in until it is
            approved.
          </div>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          {open ? (
            <>
              <div className="font-mono text-4xl tabular-nums">{formatElapsed(now.getTime() - new Date(open.clock_in).getTime())}</div>
              <p className="text-sm text-muted-foreground">
                Clocked in at {formatTime(open.clock_in)} in {openOrgName}
              </p>
              {openElsewhere && <p className="text-sm text-amber-600">This session belongs to another company. Clock out here before clocking in to {current?.org.name}.</p>}
            </>
          ) : (
            <p className="text-muted-foreground">You are not clocked in. Clocking in will record time for {current?.org.name}.</p>
          )}
          <Button size="lg" className="h-14 min-w-48 text-lg" variant={open ? 'destructive' : 'default'} disabled={pending || blocked} onClick={toggle}>
            {pending ? 'Please wait…' : open ? 'Clock out' : 'Clock in'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Today's total: <strong>{formatDuration(minutesToday(rows ?? [], now))}</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {error && <p className="text-destructive">{error.message}</p>}
          {rows && rows.length === 0 && <p className="text-muted-foreground">No attendance records yet.</p>}
          {rows && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock in</TableHead>
                  <TableHead>Clock out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.clock_in)}</TableCell>
                    <TableCell>{formatTime(r.clock_in)}</TableCell>
                    <TableCell>{r.clock_out ? formatTime(r.clock_out) : <em>in progress</em>}</TableCell>
                    <TableCell>{formatDuration(durationMinutes(r.clock_in, r.clock_out, now))}</TableCell>
                    <TableCell><AttendanceStatusBadge status={r.status} /></TableCell>
                    <TableCell className="max-w-48 truncate">{r.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
