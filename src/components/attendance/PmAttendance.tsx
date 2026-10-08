import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { AttendanceStatusBadge } from '@/components/attendance/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProjectAttendance } from '@/hooks/useAttendance'
import { useProjectMembers } from '@/hooks/useProjectData'
import { durationMinutes, formatDate, formatDuration, formatTime, isStaleSession, toLocalInput } from '@/lib/attendanceUtils'
import { supabase } from '@/lib/supabase'
import type { Attendance, AttendanceStatus } from '@/types/database'

export function PmAttendance({ projectId }: { projectId: number }) {
  const qc = useQueryClient()
  const { data: rows, isLoading, error } = useProjectAttendance(projectId, true)
  const { data: members } = useProjectMembers(projectId)
  const [person, setPerson] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reviewing, setReviewing] = useState<Attendance | null>(null)
  const now = new Date()

  const nameOf = (userId: string) => {
    const p = members?.find((m) => m.member.user_id === userId)?.profile
    return p?.full_name || p?.email || 'Unknown'
  }

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((r) => {
        const day = format(new Date(r.clock_in), 'yyyy-MM-dd')
        return (!person || r.user_id === person) && (!from || day >= from) && (!to || day <= to)
      }),
    [rows, person, from, to],
  )
  const total = filtered.reduce((sum, r) => sum + durationMinutes(r.clock_in, r.clock_out, now), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="a-person">Person</Label>
          <select id="a-person" className={`${selectClass} w-48`} value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Everyone</option>
            {members?.map(({ member, profile }) => (
              <option key={member.id} value={member.user_id}>
                {profile?.full_name || profile?.email}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="a-from">From</Label>
          <Input id="a-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="a-to">To</Label>
          <Input id="a-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          {filtered.length} records, <strong>{formatDuration(total)}</strong> total
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {rows && filtered.length === 0 && <p className="text-muted-foreground">No attendance records match.</p>}
      {filtered.length > 0 && (
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
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{nameOf(r.user_id)}</TableCell>
                    <TableCell>{formatDate(r.clock_in)}</TableCell>
                    <TableCell>{formatTime(r.clock_in)}</TableCell>
                    <TableCell>
                      {r.clock_out ? formatTime(r.clock_out) : <em className={isStaleSession(r, now) ? 'text-destructive' : ''}>{isStaleSession(r, now) ? 'forgot to clock out?' : 'in progress'}</em>}
                    </TableCell>
                    <TableCell>{formatDuration(durationMinutes(r.clock_in, r.clock_out, now))}</TableCell>
                    <TableCell><AttendanceStatusBadge status={r.status} /></TableCell>
                    <TableCell className="max-w-48 truncate">{r.note}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => setReviewing(r)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
  const [status, setStatus] = useState<AttendanceStatus>(row.status)
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
      const { error } = await supabase.from('attendance').update({ status, note: note.trim() || null }).eq('id', row.id)
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
        <DialogTitle>Review attendance</DialogTitle>
        <DialogDescription>
          {name}, {formatDate(row.clock_in)} from {formatTime(row.clock_in)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="r-status">Status</Label>
          <select id="r-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-out">Clock out (correct if forgotten)</Label>
          <Input id="r-out" type="datetime-local" min={toLocalInput(row.clock_in)} value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-note">Note</Label>
          <textarea id="r-note" rows={3} className={`${selectClass} h-auto py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
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
