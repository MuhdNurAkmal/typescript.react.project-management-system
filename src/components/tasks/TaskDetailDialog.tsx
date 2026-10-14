import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { TeamPicker } from '@/components/tasks/TeamPicker'
import { Checklist } from '@/components/tasks/Checklist'
import { priorityLabels, statusLabels } from '@/components/tasks/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiCombobox } from '@/components/ui/multi-combobox'
import { useAuth } from '@/hooks/useAuth'
import { useConfirm } from '@/hooks/useConfirm'
import { useMilestones } from '@/hooks/useMilestones'
import { useProjectMembers } from '@/hooks/useProjectData'
import { useProjectTasks } from '@/hooks/useTasks'
import { outsideMessage, taskOutsideMilestone } from '@/lib/milestoneUtils'
import { checklistPercent } from '@/lib/checklist'
import { validateTaskDates } from '@/lib/taskValidation'
import { supabase } from '@/lib/supabase'
import type { Task, TaskPriority, TaskStatus } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  task: Task | null
  /** Can change the card (everyone except read-only roles). */
  canEdit: boolean
  /** The role may delete cards. */
  canDelete: boolean
  /** Project managers can also delete other people's comments. */
  canManage: boolean
  onClose: () => void
}

/** The card: edit it in place (changes save as you go), assign people, tick off its checklist, and talk about it. */
export function TaskDetailDialog({ task, ...rest }: Props) {
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && rest.onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">{task && <Body key={task.id} task={task} {...rest} />}</DialogContent>
    </Dialog>
  )
}

function Body({ task, canEdit, canDelete, canManage, onClose }: Props & { task: Task }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data: members } = useProjectMembers(task.project_id)
  const { data: milestones } = useMilestones(task.project_id)
  const { data: all } = useProjectTasks(task.project_id)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [start, setStart] = useState(task.start_date ?? '')
  const [due, setDue] = useState(task.due_date ?? '')
  const [progress, setProgress] = useState(task.progress)
  const [assignees, setAssignees] = useState(task.assignee_ids)
  const [text, setText] = useState('')

  const checklist = (all?.items ?? []).filter((i) => i.task_id === task.id)
  const hasChecklist = checklist.length > 0

  const activeMembers = members?.filter((m) => m.member.is_active) ?? []
  const nameOf = (id: string) => {
    const p = members?.find((m) => m.member.user_id === id)?.profile
    return p?.full_name || p?.email || 'Former member'
  }

  const refreshTasks = async () => {
    await qc.invalidateQueries({ queryKey: ['tasks', task.project_id] })
    await qc.invalidateQueries({ queryKey: ['milestones', task.project_id] })
    await qc.invalidateQueries({ queryKey: ['my-tasks'] })
  }

  const update = useMutation({
    mutationFn: async (patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'start_date' | 'due_date' | 'progress' | 'milestone_id'>>) => {
      const { error } = await supabase.from('tasks').update(patch).eq('id', task.id)
      if (error) throw error
    },
    onSettled: refreshTasks,
    onError: (e: Error) => toast.error(e.message),
  })

  const assign = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('set_task_assignees', { p_task_id: task.id, p_user_ids: ids })
      if (error) throw error
    },
    onSettled: refreshTasks,
    onError: (e: Error) => {
      setAssignees(task.assignee_ids)
      toast.error(e.message)
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshTasks()
      toast.success('Card deleted')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function saveTitle() {
    const t = title.trim()
    if (!t) return setTitle(task.title)
    if (t !== task.title) update.mutate({ title: t })
  }
  function saveDescription() {
    const d = description.trim()
    if (d !== (task.description ?? '')) update.mutate({ description: d || null })
  }
  function saveDates(nextStart: string, nextDue: string) {
    const err = validateTaskDates(nextStart, nextDue)
    if (err) return toast.error(err)
    update.mutate({ start_date: nextStart || null, due_date: nextDue || null })
  }
  function saveProgress() {
    const p = Math.min(100, Math.max(0, Math.round(Number(progress) || 0)))
    setProgress(p)
    if (p !== task.progress) update.mutate({ progress: p })
  }

  const comments = useQuery({
    queryKey: ['comments', task.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at')
      if (error) throw error
      return data
    },
  })
  const refreshComments = async () => {
    await qc.invalidateQueries({ queryKey: ['comments', task.id] })
    await qc.invalidateQueries({ queryKey: ['comment-counts'] })
  }
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('task_comments').insert({ task_id: task.id, body: text.trim() })
      if (error) throw error
    },
    onSuccess: async () => {
      setText('')
      await refreshComments()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const removeComment = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('task_comments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refreshComments,
    onError: (e: Error) => toast.error(e.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (text.trim()) add.mutate()
  }

  // with a checklist the percentage is the average of its items
  const shownProgress = hasChecklist ? (task.status === 'done' ? 100 : checklistPercent(checklist)) : progress
  const lockedHint = hasChecklist ? 'The percentage is the average of the checklist.' : null

  const chosenMilestone = milestones?.find((m) => m.id === task.milestone_id)
  const side = chosenMilestone ? taskOutsideMilestone({ start_date: start || null, due_date: due || null }, chosenMilestone) : null
  const warning = chosenMilestone && side ? outsideMessage(side, chosenMilestone) : null

  const field = 'space-y-1.5'
  return (
    <>
      <div className="space-y-1 pr-6">
        <DialogTitle className="sr-only">{task.title}</DialogTitle>
        <div className="flex items-center gap-2">
          <input
            aria-label="Card title"
            value={title}
            readOnly={!canEdit}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold outline-none read-only:cursor-default hover:border-input focus:border-ring focus:ring-3 focus:ring-ring/50 read-only:hover:border-transparent"
          />
        </div>
        <DialogDescription className="px-1">
          {canEdit ? 'Changes save as you make them.' : 'You can read this card and comment, but not change it.'}
        </DialogDescription>
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_14rem]">
        <div className="space-y-5">
          <div className={field}>
            <Label htmlFor="c-members">Members</Label>
            {canEdit ? (
              <MultiCombobox
                id="c-members"
                items={activeMembers.map(({ member, profile }) => ({ value: member.user_id, label: profile?.full_name || profile?.email || 'Unknown' }))}
                value={assignees}
                onChange={(ids) => {
                  setAssignees(ids)
                  assign.mutate(ids)
                }}
                placeholder="Add people to this card"
                emptyText="No member matches."
              />
            ) : (
              <p className="text-sm">{assignees.length ? assignees.map(nameOf).join(', ') : 'Nobody yet'}</p>
            )}
            {canEdit && (
              <TeamPicker
                projectId={task.project_id}
                value={assignees}
                activeIds={activeMembers.map((m) => m.member.user_id)}
                onChange={(ids) => {
                  setAssignees(ids)
                  assign.mutate(ids)
                }}
              />
            )}
          </div>

          <div className={field}>
            <Label htmlFor="c-milestone">Milestone</Label>
            <select
              id="c-milestone"
              className={selectClass}
              disabled={!canEdit}
              value={task.milestone_id ?? ''}
              onChange={(e) => update.mutate({ milestone_id: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">No milestone (unplanned)</option>
              {milestones?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.start_date} to {m.end_date})
                </option>
              ))}
            </select>
            {warning && (
              <p role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
                {warning}
              </p>
            )}
          </div>

          <div className={field}>
            <Label htmlFor="c-desc">Description</Label>
            <textarea
              id="c-desc"
              rows={4}
              readOnly={!canEdit}
              placeholder={canEdit ? 'Add a more detailed description…' : 'No description.'}
              className={cn(selectClass, 'h-auto py-2')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className={field}>
            <Label htmlFor="c-status">Status</Label>
            <select
              id="c-status"
              className={selectClass}
              disabled={!canEdit}
              value={task.status}
              onChange={(e) => {
                const status = e.target.value as TaskStatus
                setProgress(status === 'done' ? 100 : progress)
                update.mutate(status === 'done' ? { status, progress: 100 } : { status })
              }}
            >
              {Object.entries(statusLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label htmlFor="c-priority">Priority</Label>
            <select id="c-priority" className={selectClass} disabled={!canEdit} value={task.priority} onChange={(e) => update.mutate({ priority: e.target.value as TaskPriority })}>
              {Object.entries(priorityLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <div className={field}>
              <Label htmlFor="c-start">Start</Label>
              <Input
                id="c-start"
                type="date"
                disabled={!canEdit}
                value={start}
                onChange={(e) => {
                  setStart(e.target.value)
                  saveDates(e.target.value, due)
                }}
              />
            </div>
            <div className={field}>
              <Label htmlFor="c-due">Due</Label>
              <Input
                id="c-due"
                type="date"
                disabled={!canEdit}
                value={due}
                onChange={(e) => {
                  setDue(e.target.value)
                  saveDates(start, e.target.value)
                }}
              />
            </div>
          </div>
          <div className={field}>
            <Label htmlFor="c-progress">Progress (%)</Label>
            <Input
              id="c-progress"
              type="number"
              min={0}
              max={100}
              disabled={!canEdit || hasChecklist}
              value={shownProgress}
              onChange={(e) => setProgress(Number(e.target.value))}
              onBlur={saveProgress}
            />
          </div>
          {lockedHint && <p className="text-xs text-muted-foreground">{lockedHint}</p>}
          {canDelete && (
            <Button
              variant="destructive"
              className="w-full"
              disabled={remove.isPending}
              onClick={async () =>
                (await confirm({
                  title: `Delete "${task.title}"?`,
                  description: 'The card, its checklist and its comments are removed for good.',
                  confirmLabel: 'Delete',
                })) && remove.mutate()
              }
            >
              Delete card
            </Button>
          )}
        </div>
      </div>

      <Checklist task={task} items={checklist} canEdit={canEdit} />

      <section className="space-y-3 border-t pt-3">
        <h3 className="text-sm font-semibold">Comments {comments.data ? `(${comments.data.length})` : ''}</h3>
        {comments.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {comments.error && <p className="text-sm text-destructive">{comments.error.message}</p>}
        {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>}
        <ul className="space-y-3">
          {comments.data?.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar name={nameOf(c.user_id)} size="sm" />
              <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{nameOf(c.user_id)}</span>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  {(c.user_id === user?.id || canManage) && (
                    <button className="ml-auto text-xs text-muted-foreground hover:text-destructive" onClick={() => removeComment.mutate(c.id)}>
                      Delete
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={onSubmit} className="flex gap-2">
          <textarea
            rows={2}
            maxLength={2000}
            placeholder="Write a comment…"
            className="min-h-9 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={add.isPending || !text.trim()}>
            Send
          </Button>
        </form>
      </section>
    </>
  )
}
