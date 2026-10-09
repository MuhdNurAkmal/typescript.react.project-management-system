import { useMemo, useState } from 'react'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { statusLabels } from '@/components/tasks/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMonthAttendance } from '@/hooks/useDashboard'
import { useMyProjects, useProjectMembers } from '@/hooks/useProjectData'
import { useProjectTasks } from '@/hooks/useTasks'
import { durationMinutes, formatDuration, formatTime } from '@/lib/attendanceUtils'
import { downloadCsv, summarizeAttendance, summarizeTasks, toCsv } from '@/lib/reportUtils'
import { todayString } from '@/lib/taskValidation'
import type { TaskStatus } from '@/types/database'

export default function Reports() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Export and review" title="Reports" description="Hours worked and task progress, ready to download." />
      <Tabs defaultValue="attendance">
        <TabsList variant="line">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="pt-4">
          <AttendanceReport />
        </TabsContent>
        <TabsContent value="tasks" className="pt-4">
          <TaskReport />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AttendanceReport() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const { start, end } = useMemo(() => {
    const d = new Date(`${month}-01T00:00:00`)
    return { start: startOfMonth(d), end: new Date(endOfMonth(d).getTime() + 1) }
  }, [month])
  const { data, isLoading, error } = useMonthAttendance(start, end)
  const now = new Date()

  const summary = summarizeAttendance(data?.rows ?? [], now)
  const nameOf = (id: string) => {
    const p = data?.profiles.find((x) => x.id === id)
    return p?.full_name || p?.email || 'Unknown'
  }
  const totalMinutes = summary.reduce((s, r) => s + r.minutes, 0)

  function exportSummary() {
    const rows = summary.map((r) => [nameOf(r.user_id), r.sessions, (r.minutes / 60).toFixed(2)])
    downloadCsv(`attendance-summary-${month}.csv`, toCsv(['Person', 'Sessions', 'Total hours'], rows))
  }
  function exportDetail() {
    const rows = (data?.rows ?? []).map((r) => [
      nameOf(r.user_id),
      format(new Date(r.clock_in), 'yyyy-MM-dd'),
      formatTime(r.clock_in),
      r.clock_out ? formatTime(r.clock_out) : '',
      (durationMinutes(r.clock_in, r.clock_out, now) / 60).toFixed(2),
      r.status,
      r.note,
    ])
    downloadCsv(`attendance-detail-${month}.csv`, toCsv(['Person', 'Date', 'Clock in', 'Clock out', 'Hours', 'Status', 'Note'], rows))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="rep-month">Month</Label>
          <Input id="rep-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </div>
        <Button variant="outline" disabled={summary.length === 0} onClick={exportSummary}>
          <Download /> Summary CSV
        </Button>
        <Button variant="outline" disabled={!data?.rows.length} onClick={exportDetail}>
          <Download /> Detailed CSV
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Company owners and admins see everyone in the company; other members see only themselves. Rejected records are excluded.</p>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && summary.length === 0 && <p className="text-muted-foreground">No attendance in this month.</p>}
      {summary.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Total hours</TableHead>
                  <TableHead>Average per session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>{nameOf(r.user_id)}</TableCell>
                    <TableCell>{r.sessions}</TableCell>
                    <TableCell>{formatDuration(r.minutes)}</TableCell>
                    <TableCell>{formatDuration(Math.round(r.minutes / r.sessions))}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-medium">All</TableCell>
                  <TableCell className="font-medium">{summary.reduce((s, r) => s + r.sessions, 0)}</TableCell>
                  <TableCell className="font-medium">{formatDuration(totalMinutes)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TaskReport() {
  const { data: projects } = useMyProjects()
  const [picked, setPicked] = useState<number | null>(null)
  const projectId = picked ?? projects?.[0]?.project.id
  const { data, isLoading, error } = useProjectTasks(projectId)
  const { data: members } = useProjectMembers(projectId)
  const today = todayString()

  const nameOf = (id: string | null) => {
    if (!id) return 'Unassigned'
    const p = members?.find((m) => m.member.user_id === id)?.profile
    return p?.full_name || p?.email || 'Unknown'
  }
  const summary = summarizeTasks(data?.tasks ?? [], today)
  const projectName = projects?.find((p) => p.project.id === projectId)?.project.name ?? 'project'

  function exportTasks() {
    const rows = (data?.tasks ?? []).map((t) => [
      t.title,
      nameOf(t.assignee_id),
      statusLabels[t.status],
      t.priority,
      t.start_date,
      t.due_date,
      t.progress,
    ])
    downloadCsv(`tasks-${projectName.replace(/\W+/g, '-')}-${today}.csv`, toCsv(['Task', 'Assignee', 'Status', 'Priority', 'Start', 'Due', 'Progress %'], rows))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="rep-project">Project</Label>
          <select id="rep-project" className={`${selectClass} w-64`} value={projectId ?? ''} onChange={(e) => setPicked(Number(e.target.value))}>
            {projects?.map(({ project }) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" disabled={!data?.tasks.length} onClick={exportTasks}>
          <Download /> Tasks CSV
        </Button>
      </div>

      {projects && projects.length === 0 && <p className="text-muted-foreground">You are not part of any project yet.</p>}
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
              <Card key={s}>
                <CardHeader>
                  <CardTitle className="text-sm font-normal text-muted-foreground">{statusLabels[s]}</CardTitle>
                  <div className="text-3xl font-semibold">{summary.byStatus[s]}</div>
                </CardHeader>
              </Card>
            ))}
          </div>
          {data.tasks.length === 0 ? (
            <p className="text-muted-foreground">No tasks in this project.</p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>By assignee</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignee</TableHead>
                      {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                        <TableHead key={s}>{statusLabels[s]}</TableHead>
                      ))}
                      <TableHead>Total</TableHead>
                      <TableHead>Overdue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.byAssignee.map((a) => (
                      <TableRow key={a.assignee_id ?? 'none'}>
                        <TableCell>{nameOf(a.assignee_id)}</TableCell>
                        {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                          <TableCell key={s}>{a.counts[s]}</TableCell>
                        ))}
                        <TableCell className="font-medium">{a.total}</TableCell>
                        <TableCell className={a.overdue ? 'font-medium text-destructive' : ''}>{a.overdue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
