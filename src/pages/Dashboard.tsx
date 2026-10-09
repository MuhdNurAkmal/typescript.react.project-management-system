import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/projects/badges'
import { PriorityBadge, TaskStatusBadge } from '@/components/tasks/badges'
import { AlertTriangle, CalendarCheck, Clock, ListTodo } from 'lucide-react'
import { KpiTile } from '@/components/KpiTile'
import { Pill } from '@/components/Pill'
import { StatusBar } from '@/components/tasks/StatusBar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useMyAttendance, useOpenSession } from '@/hooks/useAttendance'
import { useManagedOverview } from '@/hooks/useDashboard'
import { useOrg } from '@/hooks/useOrg'
import { useMyProjects } from '@/hooks/useProjectData'
import { useMyTasks } from '@/hooks/useTasks'
import { formatDuration, formatTime, minutesToday } from '@/lib/attendanceUtils'
import { projectProgress, summarizeTasks } from '@/lib/reportUtils'
import { addDays, format } from 'date-fns'
import { isOverdue, todayString } from '@/lib/taskValidation'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const { data: projects } = useMyProjects()
  const managed = (projects ?? []).filter((p) => p.role?.is_pm)
  const today = todayString()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Hello, {profile?.full_name || user?.email}</h1>
      <Kpis today={today} />
      {managed.length > 0 && <ManagedProjects projects={managed} today={today} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingTasks today={today} />
        <TodayAttendance />
      </div>
    </div>
  )
}

function ManagedProjects({ projects, today }: { projects: NonNullable<ReturnType<typeof useMyProjects>['data']>; today: string }) {
  const { data, isLoading, error } = useManagedOverview(projects.map((p) => p.project.id))
  const { isAdmin } = useOrg()
  const nameOf = (id: string) => {
    const p = data?.profiles.find((x) => x.id === id)
    return p?.full_name || p?.email || 'Unknown'
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Projects you manage</h2>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map(({ project }) => {
          const tasks = data?.tasks.filter((t) => t.project_id === project.id) ?? []
          const stats = projectProgress(tasks, today)
          const memberIds = new Set(data?.members.filter((m) => m.project_id === project.id).map((m) => m.user_id))
          const clockedIn = data?.open.filter((o) => memberIds.has(o.user_id)) ?? []
          return (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <div className="flex gap-2 pt-1">
                    <StatusBadge status={project.status} />
                    {stats.overdue > 0 && <Pill tone="red">{stats.overdue} overdue</Pill>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="mb-1 flex justify-between">
                      <span>
                        {stats.done}/{stats.total} tasks done
                      </span>
                      <span>{stats.avgProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${stats.avgProgress}%` }} />
                    </div>
                  </div>
                  <StatusBar counts={summarizeTasks(tasks, today).byStatus} />
                  {isAdmin && (
                    <div>
                      <span className="text-muted-foreground">Clocked in now: </span>
                      {clockedIn.length === 0 ? 'nobody' : clockedIn.map((o) => nameOf(o.user_id)).join(', ')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function Kpis({ today }: { today: string }) {
  const { data } = useMyTasks()
  const { data: rows } = useMyAttendance()
  const weekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd')
  const open = (data ?? []).map((d) => d.task).filter((t) => t.status !== 'done')
  const overdue = open.filter((t) => isOverdue(t, today)).length
  const dueSoon = open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd).length

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile icon={ListTodo} label="Open tasks" value={open.length} />
      <KpiTile icon={AlertTriangle} label="Overdue" value={overdue} tone={overdue > 0 ? 'red' : 'green'} />
      <KpiTile icon={CalendarCheck} label="Due in 7 days" value={dueSoon} tone="amber" />
      <KpiTile icon={Clock} label="Hours today" value={formatDuration(minutesToday(rows ?? []))} tone="green" />
    </div>
  )
}

function UpcomingTasks({ today }: { today: string }) {
  const { data, isLoading } = useMyTasks()
  const upcoming = (data ?? [])
    .filter(({ task }) => task.status !== 'done')
    .sort((a, b) => (a.task.due_date ?? '9999').localeCompare(b.task.due_date ?? '9999'))
    .slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <CardTitle>My upcoming tasks</CardTitle>
        <CardDescription>
          <Link to="/my-tasks" className="underline">
            See all
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {data && upcoming.length === 0 && <p className="text-muted-foreground">Nothing assigned to you right now.</p>}
        {upcoming.map(({ task, projectName }) => (
          <div key={task.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <div className="min-w-40 flex-1">
              <div className="font-medium">{task.title}</div>
              <div className="text-muted-foreground">{projectName}</div>
            </div>
            <span className={isOverdue(task, today) ? 'font-medium text-destructive' : 'text-muted-foreground'}>{task.due_date ?? 'No due date'}</span>
            <PriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TodayAttendance() {
  const { data: rows } = useMyAttendance()
  const { data: open } = useOpenSession()
  const todayRows = (rows ?? []).filter((r) => minutesToday([r]) > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's attendance</CardTitle>
        <CardDescription>
          <Link to="/attendance" className="underline">
            Attendance page
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{open ? `Clocked in since ${formatTime(open.clock_in)}` : 'Not clocked in'}</p>
        <p>
          Total today: <strong>{formatDuration(minutesToday(rows ?? []))}</strong> across {todayRows.length} session
          {todayRows.length === 1 ? '' : 's'}
        </p>
      </CardContent>
    </Card>
  )
}
