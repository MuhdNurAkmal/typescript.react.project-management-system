import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Gantt, { type GanttTask } from 'frappe-gantt'
import { addSeconds, format } from 'date-fns'
import { toast } from 'sonner'
import '@/styles/frappe-gantt.css'
import { Button } from '@/components/ui/button'
import { AssigneeStack } from '@/components/tasks/AssigneeStack'
import { Card, CardContent } from '@/components/ui/card'
import { useMilestones } from '@/hooks/useMilestones'
import { useProjectMembers } from '@/hooks/useProjectData'
import { useProjectTasks } from '@/hooks/useTasks'
import { milestoneProgress } from '@/lib/milestoneUtils'
import { tasksIn } from '@/lib/taskTree'
import { supabase } from '@/lib/supabase'
import { todayString } from '@/lib/taskValidation'

/**
 * The chart only covers the dates the tasks use. For a project that ended in the past that left today outside it,
 * so the Today button had nowhere to go. This keeps the end of the chart at least a month past today.
 */
class ChartWithToday extends Gantt {
  setup_gantt_dates(refresh?: boolean) {
    super.setup_gantt_dates(refresh)
    const end = new Date()
    end.setMonth(end.getMonth() + 1)
    end.setHours(0, 0, 0, 0)
    if (!refresh && this.gantt_end < end) this.gantt_end = end
  }
}

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
  /** For a milestone row: its id and how many tasks it holds, so the row can be collapsed. */
  milestoneId?: number
  taskCount?: number
  id: string
  name: string
  assignees: string[]
  milestone: boolean
  done: boolean
  /** 0 = phase, 1 = task, 2 = subtask. */
  level: number
  /** 1, 2 ... for tasks and 1.1, 1.2 ... for subtasks. */
  /** For a milestone: its percentage. */
  /** Completion percentage. */
  percent: number
}

export function GanttChart({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useProjectTasks(projectId)
  const { data: milestones } = useMilestones(projectId)
  const { data: members } = useProjectMembers(projectId)
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<Gantt | null>(null)
  // milestones whose tasks are folded away, so only the phase bar and its progress show
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const keepScrollRef = useRef(false)
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('Month')
  const viewModeRef = useRef(viewMode)

  const { ganttTasks, unscheduled, listRows } = useMemo(() => {
    const scheduled: GanttTask[] = []
    const list: ListRow[] = []
    const skipped: string[] = []
    const ids = new Set<number>()
    const today = todayString()
    const nameOf = new Map((members ?? []).map((m) => [m.member.user_id, m.profile?.full_name || m.profile?.email || 'Unknown']))
    const tasks = data?.tasks ?? []

    const addTask = (t: (typeof tasks)[number], level: number) => {
      const start = t.start_date ?? t.due_date
      const end = t.due_date ?? t.start_date
      if (!start || !end) {
        skipped.push(t.title)
        return
      }
      ids.add(t.id)
      list.push({
        id: String(t.id),
        name: t.title,
        assignees: t.assignee_ids.map((id) => nameOf.get(id) ?? 'Unknown'),
        milestone: false,
        done: t.status === 'done',
        level,
        percent: t.status === 'done' ? 100 : t.progress,
      })
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

    // each milestone is a long bar for the whole phase; its tasks follow in date order
    for (const m of milestones ?? []) {
      const p = milestoneProgress(m, tasks, today)
      list.push({ id: `m-${m.id}`, name: m.title, assignees: [], milestone: true, milestoneId: m.id, taskCount: p.total, done: p.state === 'done', level: 0, percent: p.percent })
      scheduled.push({
        id: `m-${m.id}`,
        name: m.title,
        start: m.start_date,
        end: m.end_date,
        progress: p.percent,
        custom_class: p.state === 'overdue' ? 'gantt-milestone-overdue' : 'gantt-milestone',
      })
      if (!collapsed.has(m.id)) for (const task of tasksIn(tasks, m.id)) addTask(task, 1)
    }
    // tasks under no milestone come last
    const known = new Set((milestones ?? []).map((m) => m.id))
    const orphan = tasks.map((t) => (t.milestone_id !== null && !known.has(t.milestone_id) ? { ...t, milestone_id: null } : t))
    for (const task of tasksIn(orphan, null)) addTask(task, 0)

    for (const d of data?.deps ?? []) {
      if (!ids.has(d.task_id) || !ids.has(d.depends_on_task_id)) continue
      const task = scheduled.find((s) => s.id === String(d.task_id))!
      task.dependencies = [task.dependencies, String(d.depends_on_task_id)].filter(Boolean).join(',')
    }
    return { ganttTasks: scheduled, unscheduled: skipped, listRows: list }
  }, [data, milestones, members, collapsed])

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
    // folding a phase redraws the chart; keep the sideways scroll where it was
    const scroller = el.querySelector('.gantt-container')
    const savedLeft = keepScrollRef.current ? (scroller?.scrollLeft ?? 0) : 0
    const savedOuter = keepScrollRef.current ? (el.parentElement?.scrollLeft ?? 0) : 0
    el.innerHTML = ''
    ganttRef.current = null
    if (ganttTasks.length === 0) return
    ganttRef.current = new ChartWithToday(el, ganttTasks, {
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
      // show only the dates the project actually uses, starting from the earliest one
      infinite_padding: false,
      scroll_to: 'start',
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
    if (keepScrollRef.current) {
      keepScrollRef.current = false
      requestAnimationFrame(() => {
        el.querySelector('.gantt-container')?.scrollTo({ left: savedLeft, behavior: 'instant' })
        el.parentElement?.scrollTo({ left: savedOuter, behavior: 'instant' })
      })
    }
  }, [ganttTasks, canManage, projectId, qc])

  function toggle(id: number) {
    keepScrollRef.current = true
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }
  const allCollapsed = (milestones?.length ?? 0) > 0 && (milestones ?? []).every((m) => collapsed.has(m.id))
  function setAll(fold: boolean) {
    keepScrollRef.current = true
    setCollapsed(fold ? new Set((milestones ?? []).map((m) => m.id)) : new Set())
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {VIEW_MODES.map((m) => (
          <Button key={m} size="sm" variant={m === viewMode ? 'default' : 'outline'} onClick={() => setViewMode(m)}>
            {m}
          </Button>
        ))}
        {(milestones?.length ?? 0) > 0 && (
          <Button className="ml-auto" size="sm" variant="outline" onClick={() => setAll(!allCollapsed)}>
            {allCollapsed ? 'Expand ALL' : 'Collapse ALL'}
          </Button>
        )}
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
            <div className="w-64 shrink-0 border-r bg-card sm:w-80" aria-label="Task list">
              <div className="flex items-end border-b px-3 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase" style={{ height: HEADER_HEIGHT }}>
                <span className="flex-1">Task</span>
                <span className="w-24 shrink-0 sm:w-28">Assignee</span>
                <span className="w-10 shrink-0 text-right">%</span>
              </div>
              <ul>
                {listRows.map((r) => (
                  <li key={r.id} className={`flex items-center gap-2 border-b px-3 text-sm ${r.milestone ? 'bg-muted/50' : ''}`} style={{ height: ROW_HEIGHT }}>
                    {r.milestoneId !== undefined && (
                      <button
                        type="button"
                        onClick={() => toggle(r.milestoneId!)}
                        aria-expanded={!collapsed.has(r.milestoneId)}
                        aria-label={`${collapsed.has(r.milestoneId) ? 'Show' : 'Hide'} tasks of ${r.name}`}
                        title={collapsed.has(r.milestoneId) ? `Show ${r.taskCount} task(s)` : 'Hide tasks'}
                        className="-ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {collapsed.has(r.milestoneId) ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    )}
                    <span
                      style={{ paddingLeft: r.level * 14 }}
                      className={`min-w-0 flex-1 truncate ${r.done ? 'text-muted-foreground line-through' : r.milestone ? 'font-semibold' : 'font-medium'}`}
                      title={r.name}
                    >

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
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{r.percent}%</span>
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
