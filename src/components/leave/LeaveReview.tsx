import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AttendanceStatusBadge } from '@/components/attendance/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLeaveTypes, useTeamLeave } from '@/hooks/useLeave'
import { leaveDays } from '@/lib/leaveUtils'
import { supabase } from '@/lib/supabase'
import type { LeaveRequest, LeaveStatus } from '@/types/database'

/** Manager view: approve or reject leave of the people on projects you manage. */
export function LeaveReview() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useTeamLeave(true)
  const { data: types } = useLeaveTypes()
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null)

  const nameOf = (id: string) => {
    const p = data?.profiles.find((x) => x.id === id)
    return p?.full_name || p?.email || 'Unknown'
  }
  const typeName = (id: number) => types?.find((t) => t.id === id)?.name ?? 'Unknown'

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && data.rows.length === 0 && <p className="text-muted-foreground">No leave requests from your team.</p>}
      {data && data.rows.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{nameOf(r.user_id)}</TableCell>
                    <TableCell>{typeName(r.leave_type_id)}</TableCell>
                    <TableCell>{r.start_date === r.end_date ? r.start_date : `${r.start_date} to ${r.end_date}`}</TableCell>
                    <TableCell>{leaveDays(r.start_date, r.end_date)}</TableCell>
                    <TableCell className="max-w-48 truncate">{r.reason}</TableCell>
                    <TableCell><AttendanceStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right">
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
            <Form
              key={reviewing.id}
              request={reviewing}
              name={nameOf(reviewing.user_id)}
              onCancel={() => setReviewing(null)}
              onDone={async () => {
                setReviewing(null)
                await qc.invalidateQueries({ queryKey: ['leave'] })
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Form({ request, name, onDone, onCancel }: { request: LeaveRequest; name: string; onDone: () => Promise<void>; onCancel: () => void }) {
  const [status, setStatus] = useState<LeaveStatus>(request.status)
  const [note, setNote] = useState(request.review_note ?? '')

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leave_requests').update({ status, review_note: note.trim() || null }).eq('id', request.id)
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Leave request updated')
      await onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Review leave request</DialogTitle>
        <DialogDescription>
          {name}: {request.start_date} to {request.end_date}
          {request.reason ? ` (${request.reason})` : ''}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lr-status">Decision</Label>
          <select id="lr-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as LeaveStatus)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lr-note">Note</Label>
          <textarea id="lr-note" rows={3} className={`${selectClass} h-auto py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
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
