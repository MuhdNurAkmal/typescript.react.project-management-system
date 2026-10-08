import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { PriorityBadge, statusLabels } from '@/components/tasks/badges'
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog'
import { selectClass } from '@/components/projects/ProjectForm'
import { useAuth } from '@/hooks/useAuth'
import { useProjectMembers } from '@/hooks/useProjectData'
import { useProjectTasks } from '@/hooks/useTasks'
import { isOverdue } from '@/lib/taskValidation'
import { supabase } from '@/lib/supabase'
import type { Task, TaskStatus } from '@/types/database'

const columns: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
const accent: Record<TaskStatus, string> = {
  todo: 'border-t-slate-300',
  in_progress: 'border-t-sky-400',
  review: 'border-t-amber-400',
  done: 'border-t-emerald-400',
}

/** Kanban view of a project's tasks. PMs can move any task; assignees can move their own. */
export function KanbanBoard({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, isLoading, error } = useProjectTasks(projectId)
  const { data: members } = useProjectMembers(projectId)
  const [dragId, setDragId] = useState<number | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)
  const [open, setOpen] = useState<Task | null>(null)

  const nameOf = (id: string | null) => {
    if (!id) return null
    const p = members?.find((m) => m.member.user_id === id)?.profile
    return p?.full_name || p?.email || 'Unknown'
  }
  const canMove = (t: Task) => canManage || t.assignee_id === user?.id

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: TaskStatus }) => {
      const { error } = await supabase
        .from('tasks')
        .update(status === 'done' ? { status, progress: 100 } : { status })
        .eq('id', id)
      if (error) throw error
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      await qc.invalidateQueries({ queryKey: ['my-tasks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function drop(status: TaskStatus) {
    const task = data?.tasks.find((t) => t.id === dragId)
    setDragId(null)
    setOver(null)
    if (task && task.status !== status && canMove(task)) move.mutate({ id: task.id, status })
  }

  if (isLoading) return <p className="text-muted-foreground">Loading board…</p>
  if (error) return <p className="text-destructive">{error.message}</p>
  const tasks = data?.tasks ?? []
  if (tasks.length === 0) return <p className="text-muted-foreground">No tasks yet. Create some in the Tasks tab.</p>

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {canManage ? 'Drag any card to change its status.' : 'Drag your own cards to change their status.'} Click a card for details and comments.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((status) => {
          const items = tasks.filter((t) => t.status === status)
          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(status)
              }}
              onDragLeave={() => setOver((o) => (o === status ? null : o))}
              onDrop={() => drop(status)}
              className={`min-h-40 rounded-xl border border-t-4 bg-muted/40 p-3 transition-colors ${accent[status]} ${over === status ? 'bg-accent' : ''}`}
            >
              <h3 className="mb-3 flex items-center justify-between text-sm font-semibold">
                {statusLabels[status]}
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">{items.length}</span>
              </h3>
              <div className="space-y-2">
                {items.map((t) => {
                  const movable = canMove(t)
                  const assignee = nameOf(t.assignee_id)
                  return (
                    <article
                      key={t.id}
                      draggable={movable}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null)
                        setOver(null)
                      }}
                      onClick={() => setOpen(t)}
                      className={`space-y-2 rounded-lg border bg-card p-3 shadow-xs ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragId === t.id ? 'opacity-50' : ''}`}
                    >
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        {t.due_date && <span className={`text-xs ${isOverdue(t) ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>{t.due_date}</span>}
                        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                          {assignee ? <Avatar name={assignee} size="sm" /> : 'Unassigned'}
                        </span>
                      </div>
                      {movable && (
                        // touch screens cannot drag, so offer a plain select as well
                        <select
                          aria-label={`Move ${t.title}`}
                          className={`${selectClass} h-7 text-xs`}
                          value={t.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => move.mutate({ id: t.id, status: e.target.value as TaskStatus })}
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
                })}
              </div>
            </section>
          )
        })}
      </div>
      <TaskDetailDialog task={open} canManage={canManage} onClose={() => setOpen(null)} />
    </>
  )
}
