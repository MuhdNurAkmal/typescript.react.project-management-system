import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlignLeft, MessageSquare, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { AssigneeStack } from '@/components/tasks/AssigneeStack'
import { PriorityBadge, statusLabels } from '@/components/tasks/badges'
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { useMilestones } from '@/hooks/useMilestones'
import { useProjectMembers } from '@/hooks/useProjectData'
import { useProjectTasks } from '@/hooks/useTasks'
import { byDate, subtasksOf, taskCodes, topLevel } from '@/lib/taskTree'
import { isOverdue } from '@/lib/taskValidation'
import { supabase } from '@/lib/supabase'
import type { Milestone, Task, TaskStatus } from '@/types/database'
import { cn } from '@/lib/utils'

const columns: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
const accent: Record<TaskStatus, string> = {
  todo: 'bg-muted-foreground/40',
  in_progress: 'bg-info',
  review: 'bg-warning',
  done: 'bg-success',
}

/**
 * Trello-style board. Anyone who can edit can add cards, drag them between columns, open them and assign people.
 * `canDelete` (a power of the role) lets them delete cards.
 */
export function KanbanBoard({ projectId, canEdit, canDelete, canManage }: { projectId: number; canEdit: boolean; canDelete: boolean; canManage: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useProjectTasks(projectId)
  const { data: members } = useProjectMembers(projectId)
  const { data: milestones } = useMilestones(projectId)
  const [milestoneFilter, setMilestoneFilter] = useState('')
  const [dragId, setDragId] = useState<number | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  const allTasks = data?.tasks ?? []
  const open = allTasks.find((t) => t.id === openId) ?? null
  const codes = taskCodes(allTasks)
  const tasks = topLevel(allTasks).filter((t) => !milestoneFilter || (milestoneFilter === 'none' ? t.milestone_id === null : t.milestone_id === Number(milestoneFilter)))

  const counts = useQuery({
    queryKey: ['comment-counts', projectId, tasks.map((t) => t.id).join(',')],
    enabled: tasks.length > 0,
    queryFn: async () => {
      const { data: rows, error: e } = await supabase.from('task_comments').select('task_id').in('task_id', tasks.map((t) => t.id))
      if (e) throw e
      const byTask = new Map<number, number>()
      for (const r of rows) byTask.set(r.task_id, (byTask.get(r.task_id) ?? 0) + 1)
      return byTask
    },
  })

  const nameOf = (id: string) => {
    const p = members?.find((m) => m.member.user_id === id)?.profile
    return p?.full_name || p?.email || 'Unknown'
  }

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    await qc.invalidateQueries({ queryKey: ['my-tasks'] })
  }

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: TaskStatus }) => {
      const { error: e } = await supabase
        .from('tasks')
        .update(status === 'done' ? { status, progress: 100 } : { status })
        .eq('id', id)
      if (e) throw e
    },
    onSettled: refresh,
    onError: (e: Error) => toast.error(e.message),
  })

  const create = useMutation({
    mutationFn: async ({ title, status }: { title: string; status: TaskStatus }) => {
      const { error: e } = await supabase
        .from('tasks')
        .insert({ project_id: projectId, title, status, progress: status === 'done' ? 100 : 0 })
      if (e) throw e
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })

  function drop(status: TaskStatus) {
    const task = allTasks.find((t) => t.id === dragId)
    setDragId(null)
    setOver(null)
    if (task && task.status !== status && canEdit && subtasksOf(allTasks, task.id).length === 0) move.mutate({ id: task.id, status })
  }

  if (isLoading) return <p className="text-muted-foreground">Loading board…</p>
  if (error) return <p className="text-destructive">{error.message}</p>

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by milestone"
          className={cn(selectClass, 'w-56')}
          value={milestoneFilter}
          onChange={(e) => setMilestoneFilter(e.target.value)}
        >
          <option value="">All milestones</option>
          <option value="none">Unplanned (no milestone)</option>
          {milestones?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {canEdit ? 'Add cards, drag them between columns, and click a card to edit it, assign people and comment.' : 'You can look at the cards and comment, but not change them.'}
      </p>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((status) => {
          const items = tasks.filter((t) => t.status === status).sort(byDate)
          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(status)
              }}
              onDragLeave={() => setOver((o) => (o === status ? null : o))}
              onDrop={() => drop(status)}
              className={`rounded-xl bg-muted/60 p-2.5 transition-colors ${over === status ? 'bg-accent' : ''}`}
            >
              <h3 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold">
                <span aria-hidden className={`size-2.5 rounded-full ${accent[status]}`} />
                {statusLabels[status]}
                <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">{items.length}</span>
              </h3>
              <div className="space-y-2">
                {items.map((t) => (
                  <Card
                    key={t.id}
                    task={t}
                    names={t.assignee_ids.map(nameOf)}
                    code={codes.get(t.id)}
                    subtasks={subtasksOf(allTasks, t.id)}
                    milestone={milestones?.find((m) => m.id === t.milestone_id)}
                    comments={counts.data?.get(t.id) ?? 0}
                    draggable={canEdit && subtasksOf(allTasks, t.id).length === 0}
                    dragging={dragId === t.id}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setOver(null)
                    }}
                    onOpen={() => setOpenId(t.id)}
                    onMove={canEdit && subtasksOf(allTasks, t.id).length === 0 ? (s) => move.mutate({ id: t.id, status: s }) : undefined}
                  />
                ))}
              </div>
              {canEdit && <Composer onAdd={(title) => create.mutateAsync({ title, status })} />}
            </section>
          )
        })}
      </div>
      <TaskDetailDialog task={open} canEdit={canEdit} canDelete={canDelete} canManage={canManage} onOpenTask={setOpenId} onClose={() => setOpenId(null)} />
    </>
  )
}

function Card({
  task,
  names,
  code,
  subtasks,
  milestone,
  comments,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onMove,
}: {
  task: Task
  names: string[]
  code?: string
  subtasks: Task[]
  milestone?: Milestone
  comments: number
  draggable: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onOpen: () => void
  onMove?: (status: TaskStatus) => void
}) {
  const overdue = isOverdue(task)
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`space-y-2 rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:shadow-lift ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragging ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {milestone && <span className="rounded bg-primary-soft px-1.5 py-0.5 text-xs font-medium text-accent-foreground">◆ {milestone.title}</span>}
      </div>
      <div className="text-sm font-medium break-words">
        {code && <span className="mr-1.5 text-xs font-normal text-muted-foreground tabular-nums">{code}</span>}
        {task.title}
      </div>
      {subtasks.length > 0 && (
        <div title="The percentage is the average of the subtasks">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>
              {subtasks.filter((x) => x.status === 'done').length}/{subtasks.length} subtasks
            </span>
            <span>{task.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {task.due_date && (
          <span className={`rounded px-1.5 py-0.5 ${task.status === 'done' ? 'bg-success-soft text-success-foreground' : overdue ? 'bg-danger-soft text-danger-foreground' : 'bg-muted'}`}>
            {task.due_date}
          </span>
        )}
        {task.description && <AlignLeft className="size-3.5" aria-label="Has a description" />}
        {comments > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3.5" /> {comments}
          </span>
        )}
        <span className="ml-auto">
          <AssigneeStack names={names} />
        </span>
      </div>
      {onMove && (
        // touch screens cannot drag, so offer a plain select there
        <select
          aria-label={`Move ${task.title}`}
          className={cn(selectClass, 'hidden h-8 text-xs [@media(hover:none)]:block')}
          value={task.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMove(e.target.value as TaskStatus)}
        >
          {columns.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      )}
    </article>
  )
}

/** "+ Add a card" at the bottom of a column: type a title, press Enter. */
function Composer({ onAdd }: { onAdd: (title: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const t = title.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      await onAdd(t)
      setTitle('')
    } catch {
      // the mutation already showed the error; keep the text so it is not lost
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <Plus className="size-4" /> Add a card
      </button>
    )

  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <textarea
        autoFocus
        rows={2}
        maxLength={200}
        aria-label="Card title"
        placeholder="Enter a title for this card…"
        className="w-full resize-none rounded-lg border border-input bg-card px-2.5 py-2 text-sm shadow-soft outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) void submit()
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={busy || !title.trim()}>
          Add card
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Close" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </div>
    </form>
  )
}
