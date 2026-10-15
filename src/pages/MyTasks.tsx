import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { PageHeader } from '@/components/PageHeader'
import { PriorityBadge, TaskStatusBadge } from '@/components/tasks/badges'
import { QuickUpdateDialog } from '@/components/tasks/QuickUpdateDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMyTasks } from '@/hooks/useTasks'
import { isOverdue, todayString } from '@/lib/taskValidation'
import type { Task } from '@/types/database'

const groups = ['Overdue', 'Today', 'Next 7 days', 'Later', 'No due date'] as const
type Group = (typeof groups)[number]

function groupOf(t: Task, today: string, weekEnd: string): Group {
  if (!t.due_date) return 'No due date'
  if (isOverdue(t, today)) return 'Overdue'
  if (t.due_date === today) return 'Today'
  if (t.due_date <= weekEnd) return 'Next 7 days'
  return 'Later'
}

export default function MyTasks() {
  const { data, isLoading, error } = useMyTasks()
  const [updating, setUpdating] = useState<Task | null>(null)
  const today = todayString()
  const weekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  // pending = not done yet; the Done tab lists the finished ones, latest due date first
  const open = (data ?? []).filter(({ task }) => task.status !== 'done')
  const finished = (data ?? []).filter(({ task }) => task.status === 'done').sort((a, b) => (b.task.due_date ?? '').localeCompare(a.task.due_date ?? ''))
  const byGroup = (g: Group) =>
    open
      .filter(({ task }) => groupOf(task, today, weekEnd) === g)
      .sort((a, b) => (a.task.due_date ?? '').localeCompare(b.task.due_date ?? ''))

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Across all your projects" title="My tasks" description="Work assigned to you: pending first, and what you have finished." />
      {isLoading && <p className="text-muted-foreground">Loading tasks…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      <Tabs defaultValue="pending">
        <TabsList variant="line">
          <TabsTrigger value="pending">Pending ({open.length})</TabsTrigger>
          <TabsTrigger value="done">Done ({finished.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 pt-4">
      {data && open.length === 0 && <p className="text-muted-foreground">Nothing pending. Nice work.</p>}

      {groups.map((g) => {
        const items = byGroup(g)
        if (items.length === 0) return null
        return (
          <Card key={g}>
            <CardHeader>
              <CardTitle className={g === 'Overdue' ? 'text-destructive' : ''}>
                {g} ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {items.map(({ task, projectName }) => (
                <div key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-48 flex-1">
                    <div className="font-medium">{task.title}</div>
                    <Link to={`/projects/${task.project_id}`} className="text-sm text-muted-foreground hover:underline">
                      {projectName}
                    </Link>
                  </div>
                  <span className={`text-sm ${g === 'Overdue' ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                    {task.due_date ?? 'No due date'}
                  </span>
                  <PriorityBadge priority={task.priority} />
                  <TaskStatusBadge status={task.status} />
                  <span className="w-10 text-sm">{task.progress}%</span>
                  <Button size="sm" onClick={() => setUpdating(task)}>
                    Update
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
        </TabsContent>

        <TabsContent value="done" className="pt-4">
          {data && finished.length === 0 && <p className="text-muted-foreground">Nothing finished yet.</p>}
          {finished.length > 0 && (
            <Card>
              <CardContent className="divide-y">
                {finished.map(({ task, projectName }) => (
                  <div key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-48 flex-1">
                      <div className="font-medium">{task.title}</div>
                      <Link to={`/projects/${task.project_id}`} className="text-sm text-muted-foreground hover:underline">
                        {projectName}
                      </Link>
                    </div>
                    <span className="text-sm text-muted-foreground">{task.due_date ?? 'No due date'}</span>
                    <PriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                    <Button size="sm" onClick={() => setUpdating(task)}>
                      Update
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <QuickUpdateDialog task={updating} onClose={() => setUpdating(null)} />
    </div>
  )
}
