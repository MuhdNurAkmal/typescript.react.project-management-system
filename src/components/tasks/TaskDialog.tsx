import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { priorityLabels, statusLabels } from '@/components/tasks/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProjectMembers } from '@/hooks/useProjectData'
import { createsDependencyCycle, createsParentCycle, validateTaskDates } from '@/lib/taskValidation'
import { supabase } from '@/lib/supabase'
import type { Task, TaskDependency, TaskPriority, TaskStatus } from '@/types/database'

interface Props {
  projectId: number
  /** `undefined` = closed, `null` = create new, a task = edit it. */
  task: Task | null | undefined
  tasks: Task[]
  deps: TaskDependency[]
  onClose: () => void
}

export function TaskDialog({ task, ...rest }: Props) {
  return (
    <Dialog open={task !== undefined} onOpenChange={(o) => !o && rest.onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {task !== undefined && <Form key={task?.id ?? 'new'} task={task} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function Form({ projectId, task, tasks, deps, onClose }: Omit<Props, 'task'> & { task: Task | null }) {
  const qc = useQueryClient()
  const { data: members } = useProjectMembers(projectId)
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assignee, setAssignee] = useState(task?.assignee_id ?? '')
  const [start, setStart] = useState(task?.start_date ?? '')
  const [due, setDue] = useState(task?.due_date ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [parent, setParent] = useState<number | ''>(task?.parent_task_id ?? '')
  const [depIds, setDepIds] = useState<number[]>(
    task ? deps.filter((d) => d.task_id === task.id).map((d) => d.depends_on_task_id) : [],
  )

  const others = tasks.filter((t) => t.id !== task?.id)
  const activeMembers = members?.filter((m) => m.member.is_active) ?? []

  const save = useMutation({
    mutationFn: async () => {
      const dateErr = validateTaskDates(start, due)
      if (dateErr) throw new Error(dateErr)

      if (task) {
        const edges = new Map<number, number[]>()
        for (const d of deps) {
          if (d.task_id === task.id) continue
          edges.set(d.task_id, [...(edges.get(d.task_id) ?? []), d.depends_on_task_id])
        }
        if (createsDependencyCycle(task.id, depIds, edges)) throw new Error('Dependencies cannot form a cycle')
        const parentOf = new Map(tasks.map((t) => [t.id, t.parent_task_id] as const))
        if (createsParentCycle(task.id, parent === '' ? null : parent, parentOf)) {
          throw new Error('A task cannot be its own ancestor')
        }
      }

      const payload = {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assignee || null,
        start_date: start || null,
        due_date: due || null,
        priority,
        status,
        progress: status === 'done' ? 100 : (task?.progress ?? 0),
        parent_task_id: parent === '' ? null : parent,
      }

      let taskId = task?.id
      if (task) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', task.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('tasks').insert(payload).select('id').single()
        if (error) throw error
        taskId = data.id
      }

      // Replace dependencies (a new task cannot be in a cycle yet: nothing depends on it)
      const { error: delErr } = await supabase.from('task_dependencies').delete().eq('task_id', taskId!)
      if (delErr) throw delErr
      if (depIds.length) {
        const { error } = await supabase
          .from('task_dependencies')
          .insert(depIds.map((d) => ({ task_id: taskId!, depends_on_task_id: d })))
        if (error) throw error
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      await qc.invalidateQueries({ queryKey: ['my-tasks'] })
      toast.success(task ? 'Task updated' : 'Task created')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{task ? 'Edit task' : 'Create task'}</DialogTitle>
        <DialogDescription>Assign work to a project member.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="t-title">Title</Label>
          <Input id="t-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-desc">Description</Label>
          <textarea id="t-desc" rows={3} className={`${selectClass} h-auto py-2`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="t-assignee">Assignee</Label>
            <select id="t-assignee" className={selectClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {activeMembers.map(({ member, profile }) => (
                <option key={member.id} value={member.user_id}>
                  {profile?.full_name || profile?.email}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-priority">Priority</Label>
            <select id="t-priority" className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {Object.entries(priorityLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-start">Start date</Label>
            <Input id="t-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-due">Due date</Label>
            <Input id="t-due" type="date" value={due} min={start || undefined} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-status">Status</Label>
            <select id="t-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {Object.entries(statusLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-parent">Parent task</Label>
            <select id="t-parent" className={selectClass} value={parent} onChange={(e) => setParent(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">None</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Depends on</Label>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other tasks yet.</p>
          ) : (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2">
              {others.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={depIds.includes(t.id)}
                    onChange={(e) => setDepIds((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((x) => x !== t.id)))}
                  />
                  {t.title}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save task'}
          </Button>
        </div>
      </form>
    </>
  )
}
