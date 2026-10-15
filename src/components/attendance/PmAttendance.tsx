import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { AttendanceReportDownload } from '@/components/attendance/AttendanceReportDownload'
import { selectClass } from '@/components/projects/ProjectForm'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTeamAttendance } from '@/hooks/useAttendance'
import { durationMinutes, formatDate, formatDuration, formatTime, isStaleSession, toLocalInput } from '@/lib/attendanceUtils'
import { supabase } from '@/lib/supabase'
import type { Attendance } from '@/types/database'
import { cn } from '@/lib/utils'

/** Manager view: attendance of everyone on the projects you manage. */
export function PmAttendance() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useTeamAttendance(true)
  const [person, setPerson] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reviewing, setReviewing] = useState<Attendance | null>(null)
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(0)
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')

  const nameOf = (userId: string) => {
    const p = data?.profiles.find((x) => x.id === userId)
    return p?.full_name || p?.email || 'Unknown'
  }

  const filtered = useMemo(
    () =>
      (data?.rows ?? []).filter((r) => {
        const day = format(new Date(r.clock_in), 'yyyy-MM-dd')
        return (!person || r.user_id === person) && (!from || day >= from) && (!to || day <= to)
      }),
    [data, person, from, to],
  )
  const total = filtered.reduce((sum, r) => sum + durationMinutes(r.clock_in, r.clock_out, now), 0)

  // today: everyone who clocked in today, plus anyone still clocked in from an earlier day
  const todayRows = (data?.rows ?? []).filter((r) => format(new Date(r.clock_in), 'yyyy-MM-dd') === today || r.clock_out === null)
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages - 1)
  const shown = filtered.slice(current * pageSize, current * pageSize + pageSize)

  const table = (rows: Attendance[]) => (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{nameOf(r.user_id)}</TableCell>
                <TableCell>{formatDate(r.clock_in)}</TableCell>
                <TableCell>{formatTime(r.clock_in)}</TableCell>
                <TableCell>
                  {r.clock_out ? (
                    <>
                      {formatTime(r.clock_out)}
                      {r.auto_closed && (
                        <span className="ml-1.5" title="Closed automatically at 23:59. Edit it if the real end time is known.">
                          <Pill tone="amber">auto</Pill>
                        </span>
                      )}
                    </>
                  ) : (
                    <em className={isStaleSession(r, now) ? 'text-destructive' : ''}>
                      {isStaleSession(r, now) ? 'forgot to clock out?' : 'in progress'}
                    </em>
                  )}
                </TableCell>
                <TableCell>{formatDuration(durationMinutes(r.clock_in, r.clock_out, now))}</TableCell>
                <TableCell className="max-w-48 truncate">{r.note}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" onClick={() => setReviewing(r)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      <AttendanceReportDownload />
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      <Tabs defaultValue="today">
        <TabsList variant="line">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-3 pt-4">
          {data && (
            <p className="text-sm text-muted-foreground">
              {formatDate(now.toISOString())}: {new Set(todayRows.map((r) => r.user_id)).size} people, {todayRows.filter((r) => r.clock_out === null).length} still clocked in
            </p>
          )}
          {data && todayRows.length === 0 && <p className="text-muted-foreground">Nobody has clocked in today.</p>}
          {todayRows.length > 0 && table(todayRows)}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="a-person">Person</Label>
              <select
                id="a-person"
                className={cn(selectClass, 'w-48')}
                value={person}
                onChange={(e) => {
                  setPerson(e.target.value)
                  setPage(0)
                }}
              >
                <option value="">Everyone</option>
                {data?.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-from">From</Label>
              <Input
                id="a-from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setPage(0)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-to">To</Label>
              <Input
                id="a-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value)
                  setPage(0)
                }}
              />
            </div>
            <p className="pb-2 text-sm text-muted-foreground">
              {filtered.length} records, <strong>{formatDuration(total)}</strong> total
            </p>
          </div>
          {data && filtered.length === 0 && <p className="text-muted-foreground">No attendance records match.</p>}
          {filtered.length > 0 && (
            <>
              {table(shown)}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  Rows per page
                  <select
                    aria-label="Rows per page"
                    className={cn(selectClass, 'w-20')}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(0)
                    }}
                  >
                    {[5, 10, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">
                    {current * pageSize + 1}-{Math.min(filtered.length, (current + 1) * pageSize)} of {filtered.length}
                  </span>
                  <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          {reviewing && (
            <ReviewForm
              key={reviewing.id}
              row={reviewing}
              name={nameOf(reviewing.user_id)}
              onDone={async () => {
                setReviewing(null)
                await qc.invalidateQueries({ queryKey: ['attendance'] })
              }}
              onCancel={() => setReviewing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReviewForm({ row, name, onDone, onCancel }: { row: Attendance; name: string; onDone: () => Promise<void>; onCancel: () => void }) {
  const [note, setNote] = useState(row.note ?? '')
  const [clockOut, setClockOut] = useState(row.clock_out ? toLocalInput(row.clock_out) : '')
  const originalOut = row.clock_out ? toLocalInput(row.clock_out) : ''

  const save = useMutation({
    mutationFn: async () => {
      if (clockOut && clockOut !== originalOut) {
        const { error } = await supabase.rpc('pm_set_clock_out', {
          p_attendance_id: row.id,
          p_clock_out: new Date(clockOut).toISOString(),
        })
        if (error) throw error
      }
      const { error } = await supabase.from('attendance').update({ note: note.trim() || null }).eq('id', row.id)
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Attendance updated')
      await onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit attendance</DialogTitle>
        <DialogDescription>
          {name}, {formatDate(row.clock_in)} from {formatTime(row.clock_in)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="r-out">Clock out (correct if forgotten)</Label>
          <Input id="r-out" type="datetime-local" min={toLocalInput(row.clock_in)} value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-note">Note</Label>
          <textarea id="r-note" rows={3} className={cn(selectClass, 'h-auto py-2')} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}
