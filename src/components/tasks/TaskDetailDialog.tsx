import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { PriorityBadge, TaskStatusBadge } from '@/components/tasks/badges'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useProjectMembers } from '@/hooks/useProjectData'
import { isOverdue } from '@/lib/taskValidation'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

interface Props {
  task: Task | null
  canManage: boolean
  onClose: () => void
}

/** Task details plus the comment thread. */
export function TaskDetailDialog({ task, ...rest }: Props) {
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && rest.onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">{task && <Body key={task.id} task={task} {...rest} />}</DialogContent>
    </Dialog>
  )
}

function Body({ task, canManage }: { task: Task; canManage: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: members } = useProjectMembers(task.project_id)
  const [text, setText] = useState('')

  const nameOf = (id: string | null) => {
    if (!id) return 'Unassigned'
    const p = members?.find((m) => m.member.user_id === id)?.profile
    return p?.full_name || p?.email || 'Former member'
  }

  const comments = useQuery({
    queryKey: ['comments', task.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at')
      if (error) throw error
      return data
    },
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['comments', task.id] })
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('task_comments').insert({ task_id: task.id, body: text.trim() })
      if (error) throw error
    },
    onSuccess: async () => {
      setText('')
      await refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('task_comments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (text.trim()) add.mutate()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{task.title}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          <span>{task.progress}% done</span>
        </DialogDescription>
      </DialogHeader>

      {task.description && <p className="text-sm whitespace-pre-wrap">{task.description}</p>}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Assignee</dt>
          <dd className="font-medium">{nameOf(task.assignee_id)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dates</dt>
          <dd className={`font-medium ${isOverdue(task) ? 'text-destructive' : ''}`}>
            {task.start_date ?? '?'} to {task.due_date ?? '?'}
          </dd>
        </div>
      </dl>

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
                    <button className="ml-auto text-xs text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(c.id)}>
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
