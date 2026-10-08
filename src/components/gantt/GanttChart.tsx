import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Gantt, { type GanttTask } from 'frappe-gantt'
import { format } from 'date-fns'
import { toast } from 'sonner'
import '@/styles/frappe-gantt.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useProjectTasks } from '@/hooks/useTasks'
import { supabase } from '@/lib/supabase'

const VIEW_MODES = ['Day', 'Week', 'Month'] as const
const statusClass = { todo: 'gantt-todo', in_progress: 'gantt-in-progress', review: 'gantt-review', done: 'gantt-done' }
const dateOnly = (d: Date) => format(d, 'yyyy-MM-dd')

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
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<Gantt | null>(null)
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('Week')
  const viewModeRef = useRef(viewMode)

  const { ganttTasks, unscheduled } = useMemo(() => {
    const scheduled: GanttTask[] = []
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
      scheduled.push({
        id: `m-${m.id}`,
        name: `◆ ${m.title}`,
        start: m.due_date,
        end: m.due_date,
        progress: m.completed ? 100 : 0,
        custom_class: 'gantt-milestone',
      })
    }
    return { ganttTasks: scheduled, unscheduled: skipped }
  }, [data, milestones])

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
        {!canManage && <span className="text-sm text-muted-foreground">Read-only: only the project manager can reschedule.</span>}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading chart…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && ganttTasks.length === 0 && (
        <p className="text-muted-foreground">Nothing to chart yet. Give tasks a start or due date, or add a milestone.</p>
      )}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <div ref={containerRef} className="gantt-wrapper" />
        </CardContent>
      </Card>
      {unscheduled.length > 0 && <p className="text-sm text-muted-foreground">Not shown (no dates): {unscheduled.join(', ')}</p>}
    </div>
  )
}
