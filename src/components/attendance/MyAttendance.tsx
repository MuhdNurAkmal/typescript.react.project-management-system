import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { AttendanceStatusBadge } from '@/components/attendance/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMyAttendance, useOpenSession } from '@/hooks/useAttendance'
import { useMyProjects } from '@/hooks/useProjectData'
import {
  durationMinutes,
  formatDate,
  formatDuration,
  formatElapsed,
  formatTime,
  friendlyClockError,
  isStaleSession,
  minutesToday,
} from '@/lib/attendanceUtils'
import { supabase } from '@/lib/supabase'

/** Clock in/out controls plus personal history. Pass projectId to fix it, or omit to pick a project. */
export function MyAttendance({ projectId }: { projectId?: number }) {
  const qc = useQueryClient()
  const { data: projects } = useMyProjects()
  const { data: open } = useOpenSession()
  const { data: rows, isLoading, error } = useMyAttendance(projectId)
  const [picked, setPicked] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const projectName = (id: number) => projects?.find((p) => p.project.id === id)?.project.name ?? `Project ${id}`
  const targetId = projectId ?? open?.project_id ?? picked ?? projects?.[0]?.project.id ?? null
  const clockedInElsewhere = !!open && open.project_id !== targetId
  const stale = open && isStaleSession(open, now)

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['attendance'] })
  }
  const clock = useMutation({
    mutationFn: async (kind: 'clock_in' | 'clock_out') => {
      const { error } = await supabase.rpc(kind, { p_project_id: kind === 'clock_out' ? (open?.project_id ?? targetId!) : targetId! })
      if (error) throw Object.assign(new Error(friendlyClockError(error.message, error.code)), { code: error.code })
    },
    onSuccess: async (_d, kind) => {
      toast.success(kind === 'clock_in' ? 'Clocked in' : 'Clocked out')
      await refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const todayRows = (rows ?? []).filter((r) => !projectId || r.project_id === projectId)

  return (
    <div className="space-y-4">
      {stale && open && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            You are still clocked in from <strong>{formatDate(open.clock_in)} {formatTime(open.clock_in)}</strong> in{' '}
            {projectName(open.project_id)}. You probably forgot to clock out. Ask your project manager to correct the
            end time, or clock out now.
          </div>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          {!projectId && (
            <select
              className={`${selectClass} max-w-xs`}
              value={targetId ?? ''}
              disabled={!!open}
              onChange={(e) => setPicked(Number(e.target.value))}
              aria-label="Project"
            >
              {projects?.map(({ project }) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          {open ? (
            <>
              <div className="font-mono text-4xl tabular-nums">{formatElapsed(now.getTime() - new Date(open.clock_in).getTime())}</div>
              <p className="text-sm text-muted-foreground">
                Clocked in at {formatTime(open.clock_in)} in {projectName(open.project_id)}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">You are not clocked in.</p>
          )}
          {clockedInElsewhere && (
            <p className="text-sm text-amber-600">You are clocked in to another project. Clock out there first.</p>
          )}
          <Button
            size="lg"
            className="h-14 min-w-48 text-lg"
            variant={open ? 'destructive' : 'default'}
            disabled={clock.isPending || targetId === null || clockedInElsewhere}
            onClick={() => clock.mutate(open ? 'clock_out' : 'clock_in')}
          >
            {clock.isPending ? 'Please wait…' : open ? 'Clock out' : 'Clock in'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Today's total: <strong>{formatDuration(minutesToday(todayRows, now))}</strong>
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
                  {!projectId && <TableHead>Project</TableHead>}
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
                    {!projectId && <TableCell>{projectName(r.project_id)}</TableCell>}
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
