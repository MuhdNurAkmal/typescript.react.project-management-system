import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AttendanceStatusBadge } from '@/components/attendance/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfirm } from '@/hooks/useConfirm'
import { useLeaveTypes, useMyLeave } from '@/hooks/useLeave'
import { leaveDays, overlapsExisting, validateLeaveDates } from '@/lib/leaveUtils'
import { supabase } from '@/lib/supabase'
import { todayString } from '@/lib/taskValidation'

/** Declare MC / annual leave / other absence in advance, and see your own requests. */
export function LeaveSection() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data: types } = useLeaveTypes()
  const { data: mine, isLoading, error } = useMyLeave()
  const [typeId, setTypeId] = useState<number | null>(null)
  const [start, setStart] = useState(todayString())
  const [end, setEnd] = useState(todayString())
  const [reason, setReason] = useState('')

  const selectedType = typeId ?? types?.[0]?.id ?? null
  const refresh = () => qc.invalidateQueries({ queryKey: ['leave'] })

  const submit = useMutation({
    mutationFn: async () => {
      const err = validateLeaveDates(start, end)
      if (err) throw new Error(err)
      if (overlapsExisting(mine ?? [], start, end)) throw new Error('You already have a leave request covering some of these dates')
      const { error } = await supabase
        .from('leave_requests')
        .insert({ leave_type_id: selectedType!, start_date: start, end_date: end, reason: reason.trim() || null })
      if (error) throw error
    },
    onSuccess: async () => {
      setReason('')
      toast.success('Leave request submitted')
      await refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancel = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('leave_requests').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    submit.mutate()
  }

  const typeName = (id: number) => types?.find((t) => t.id === id)?.name ?? 'Unknown'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Declare leave or absence</CardTitle>
          <CardDescription>
            Annual leave, medical leave (MC) and other absences. Once a manager approves it, you will not be able to clock in on
            those days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="l-type">Type</Label>
              <select id="l-type" className={selectClass} value={selectedType ?? ''} onChange={(e) => setTypeId(Number(e.target.value))}>
                {types?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden sm:block" />
            <div className="space-y-2">
              <Label htmlFor="l-start">From</Label>
              <Input id="l-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-end">To</Label>
              <Input id="l-end" type="date" required min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="l-reason">Reason (optional)</Label>
              <textarea id="l-reason" rows={2} className={`${selectClass} h-auto py-2`} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submit.isPending || selectedType === null}>
                {submit.isPending ? 'Submitting…' : 'Submit request'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My leave requests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {error && <p className="text-destructive">{error.message}</p>}
          {mine && mine.length === 0 && <p className="text-muted-foreground">No leave requests yet.</p>}
          {mine && mine.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Manager note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mine.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{typeName(r.leave_type_id)}</TableCell>
                    <TableCell>{r.start_date === r.end_date ? r.start_date : `${r.start_date} to ${r.end_date}`}</TableCell>
                    <TableCell>{leaveDays(r.start_date, r.end_date)}</TableCell>
                    <TableCell><AttendanceStatusBadge status={r.status} /></TableCell>
                    <TableCell className="max-w-48 truncate">{r.review_note}</TableCell>
                    <TableCell className="text-right">
                      {r.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={async () => (await confirm({ title: 'Cancel this leave request?', confirmLabel: 'Cancel request' })) && cancel.mutate(r.id)}>
                          Cancel
                        </Button>
                      )}
                    </TableCell>
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
