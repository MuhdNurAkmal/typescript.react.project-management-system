import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Gantt, { type GanttTask } from 'frappe-gantt'
import { addSeconds, format } from 'date-fns'
import { toast } from 'sonner'
import '@/styles/frappe-gantt.css'
import { Button } from '@/components/ui/button'
import { AssigneeStack } from '@/components/tasks/AssigneeStack'
import { Card, CardContent } from '@/components/ui/card'
import { useProjectMembers } from '@/hooks/useProjectData'
import { useProjectTasks } from '@/hooks/useTasks'
import { supabase } from '@/lib/supabase'

const VIEW_MODES = ['Day', 'Week', 'Month'] as const
const statusClass = { todo: 'gantt-todo', in_progress: 'gantt-in-progress', review: 'gantt-review', done: 'gantt-done' }
const dateOnly = (d: Date) => format(d, 'yyyy-MM-dd')

// The task list on the left lines up with the chart on the right, row for row.
// frappe-gantt draws a header of upper + lower header + 10px, then rows that are bar_height + padding tall.
const BAR_HEIGHT = 30
const ROW_PADDING = 18
const ROW_HEIGHT = BAR_HEIGHT + ROW_PADDING
const HEADER_HEIGHT = 45 + 30 + 10
const GRID_BOTTOM = 8

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

interface ListRow {
  id: string
  name: string
  assignees: string[]
  milestone: boolean
  done: boolean
}

export function useMilestones(projectId: number) {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('milestones').select('*').eq('project_id', projectId).order('due_date')
      if (error) throw error
      return data
    },
  })
}

export function GanttChart({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useProjectTasks(projectId)
  const { data: milestones } = useMilestones(projectId)
  const { data: members } = useProjectMembers(projectId)
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<Gantt | null>(null)
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('Week')
  const viewModeRef = useRef(viewMode)

  const { ganttTasks, unscheduled, listRows } = useMemo(() => {
    const scheduled: GanttTask[] = []
    const list: ListRow[] = []
    const nameOf = new Map((members ?? []).map((m) => [m.member.user_id, m.profile?.full_name || m.profile?.email || 'Unknown']))
    const skipped: string[] = []
    const ids = new Set<number>()
    for (const t of data?.tasks ?? []) {
      const start = t.start_date ?? t.due_date
      const end = t.due_date ?? t.start_date
      if (!start || !end) {
        skipped.push(t.title)
        continue
      }
      ids.add(t.id)
      list.push({ id: String(t.id), name: t.title, assignees: t.assignee_ids.map((id) => nameOf.get(id) ?? 'Unknown'), milestone: false, done: t.status === 'done' })
      scheduled.push({
        id: String(t.id),
        name: t.title,
        start,
        end,
        progress: t.progress,
        custom_class: statusClass[t.status],
        description: t.description ?? '',
        dependencies: '',
      })
    }
    for (const d of data?.deps ?? []) {
      if (!ids.has(d.task_id) || !ids.has(d.depends_on_task_id)) continue
      const task = scheduled.find((s) => s.id === String(d.task_id))!
      task.dependencies = [task.dependencies, String(d.depends_on_task_id)].filter(Boolean).join(',')
    }
    for (const m of milestones ?? []) {
      list.push({ id: `m-${m.id}`, name: m.title, assignees: [], milestone: true, done: m.completed })
      scheduled.push({
        id: `m-${m.id}`,
        name: `◆ ${m.title}`,
        start: m.due_date,
        end: m.due_date,
        progress: m.completed ? 100 : 0,
        custom_class: 'gantt-milestone',
      })
    }
    return { ganttTasks: scheduled, unscheduled: skipped, listRows: list }
  }, [data, milestones, members])

  const reschedule = useMutation({
    mutationFn: async (v: { id: number; patch: { start_date?: string; due_date?: string; progress?: number } }) => {
      const { error } = await supabase.from('tasks').update(v.patch).eq('id', v.id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: (e: Error) => toast.error(e.message),
  })
  const rescheduleRef = useRef(reschedule.mutate)
  rescheduleRef.current = reschedule.mutate

  useEffect(() => {
    viewModeRef.current = viewMode
    ganttRef.current?.change_view_mode(viewMode, true)
  }, [viewMode])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.innerHTML = ''
    ganttRef.current = null
    if (ganttTasks.length === 0) return
    ganttRef.current = new Gantt(el, ganttTasks, {
      view_mode: viewModeRef.current,
      bar_height: BAR_HEIGHT,
      padding: ROW_PADDING,
      // the default popup writes the task name into the page as HTML; escape it so a task title cannot inject markup
      popup: (ctx: {
        task: GanttTask & { _start: Date; _end: Date }
        set_title: (v: string) => void
        set_subtitle: (v: string) => void
        set_details: (v: string) => void
      }) => {
        ctx.set_title(escapeHtml(ctx.task.name))
        ctx.set_subtitle(escapeHtml(ctx.task.description ?? ''))
        const from = format(ctx.task._start, 'MMM d')
        const to = format(addSeconds(ctx.task._end, -1), 'MMM d')
        ctx.set_details(`${from} - ${to}<br/>Progress: ${Math.floor(ctx.task.progress)}%`)
      },
      readonly: !canManage,
      today_button: true,
      scroll_to: 'today',
      on_date_change: (task, start, end) => {
        if (task.id.startsWith('m-')) {
          void qc.invalidateQueries({ queryKey: ['milestones', projectId] })
          return
        }
        rescheduleRef.current({ id: Number(task.id), patch: { start_date: dateOnly(start), due_date: dateOnly(end) } })
      },
      on_progress_change: (task, progress) => {
        if (task.id.startsWith('m-')) return
        rescheduleRef.current({ id: Number(task.id), patch: { progress: Math.round(progress) } })
      },
    })
  }, [ganttTasks, canManage, projectId, qc])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {VIEW_MODES.map((m) => (
          <Button key={m} size="sm" variant={m === viewMode ? 'default' : 'outline'} onClick={() => setViewMode(m)}>
            {m}
          </Button>
        ))}
        {!canManage && <span className="text-sm text-muted-foreground">Read-only: your role cannot reschedule tasks.</span>}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading chart…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && ganttTasks.length === 0 && (
        <p className="text-muted-foreground">Nothing to chart yet. Give tasks a start or due date, or add a milestone.</p>
      )}
      {ganttTasks.length > 0 && (
        <Card>
          <CardContent className="flex p-0">
            <div className="w-56 shrink-0 border-r bg-card sm:w-72" aria-label="Task list">
              <div className="flex items-end border-b px-3 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase" style={{ height: HEADER_HEIGHT }}>
                <span className="flex-1">Task</span>
                <span className="w-24 shrink-0 sm:w-28">Assignee</span>
              </div>
              <ul>
                {listRows.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 border-b px-3 text-sm" style={{ height: ROW_HEIGHT }}>
                    <span className={`min-w-0 flex-1 truncate ${r.done ? 'text-muted-foreground line-through' : 'font-medium'}`} title={r.name}>
                      {r.milestone ? '◆ ' : ''}
                      {r.name}
                    </span>
                    <span className="flex w-24 shrink-0 items-center gap-1.5 sm:w-28">
                      {r.assignees.length > 0 ? (
                        <>
                          <AssigneeStack names={r.assignees} max={2} />
                          {r.assignees.length === 1 && (
                            <span className="truncate text-xs text-muted-foreground" title={r.assignees[0]}>
                              {r.assignees[0]}
                            </span>
                          )}
                        </>
                      ) : (
                        !r.milestone && <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div style={{ height: GRID_BOTTOM }} />
            </div>
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div ref={containerRef} className="gantt-wrapper" />
            </div>
          </CardContent>
        </Card>
      )}
      {ganttTasks.length === 0 && <div ref={containerRef} className="gantt-wrapper" />}
      {unscheduled.length > 0 && <p className="text-sm text-muted-foreground">Not shown (no dates): {unscheduled.join(', ')}</p>}
    </div>
  )
}
