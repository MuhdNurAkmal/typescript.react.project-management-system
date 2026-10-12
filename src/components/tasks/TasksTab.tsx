import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { selectClass } from '@/components/projects/ProjectForm'
import { PriorityBadge, TaskStatusBadge, statusLabels } from '@/components/tasks/badges'
import { StatusBar } from '@/components/tasks/StatusBar'
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog'
import { TaskDialog } from '@/components/tasks/TaskDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfirm } from '@/hooks/useConfirm'
import { useMilestones } from '@/hooks/useMilestones'
import { useProjectMembers } from '@/hooks/useProjectData'
import { useProjectTasks } from '@/hooks/useTasks'
import { summarizeTasks } from '@/lib/reportUtils'
import { isOverdue, todayString } from '@/lib/taskValidation'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'
import { cn } from '@/lib/utils'

export function TasksTab({ projectId, canEdit, canDelete, canManage }: { projectId: number; canEdit: boolean; canDelete: boolean; canManage: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data, isLoading, error } = useProjectTasks(projectId)
  const { data: members } = useProjectMembers(projectId)
  const { data: milestones } = useMilestones(projectId)
  const [milestoneFilter, setMilestoneFilter] = useState('')
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [editing, setEditing] = useState<Task | null | undefined>(undefined)
  const [viewingId, setViewingId] = useState<number | null>(null)

  const nameOf = (id: string | null) => {
    if (!id) return 'Unassigned'
    const p = members?.find((m) => m.member.user_id === id)?.profile
    return p?.full_name || p?.email || 'Unknown'
  }

  const viewing = data?.tasks.find((t) => t.id === viewingId) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.tasks ?? []).filter(
      (t) =>
        (!q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)) &&
        (!assignee || (assignee === 'none' ? t.assignee_ids.length === 0 : t.assignee_ids.includes(assignee))) &&
        (!milestoneFilter || (milestoneFilter === 'none' ? t.milestone_id === null : t.milestone_id === Number(milestoneFilter))) &&
        (!status || t.status === status) &&
        (!priority || t.priority === priority),
    )
  }, [data, search, assignee, milestoneFilter, status, priority])

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function onDelete(t: Task) {
    const ok = await confirm({ title: `Delete task "${t.title}"?`, description: 'This cannot be undone.', confirmLabel: 'Delete' })
    if (ok) remove.mutate(t.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <Input className="w-full sm:w-56 lg:w-auto lg:min-w-0 lg:flex-[2_1_10rem]" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={cn(selectClass, 'w-40 lg:w-auto lg:min-w-0 lg:max-w-48 lg:flex-[1_1_8rem]')} value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter by assignee">
          <option value="">All assignees</option>
          <option value="none">Unassigned</option>
          {members?.map(({ member, profile }) => (
            <option key={member.id} value={member.user_id}>
              {profile?.full_name || profile?.email}
            </option>
          ))}
        </select>
        <select className={cn(selectClass, 'w-40 lg:w-auto lg:min-w-0 lg:max-w-48 lg:flex-[1_1_8rem]')} value={milestoneFilter} onChange={(e) => setMilestoneFilter(e.target.value)} aria-label="Filter by milestone">
          <option value="">All milestones</option>
          <option value="none">Unplanned</option>
          {milestones?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <select className={cn(selectClass, 'w-36 lg:w-auto lg:min-w-0 lg:max-w-44 lg:flex-[1_1_7rem]')} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(statusLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className={cn(selectClass, 'w-36 lg:w-auto lg:min-w-0 lg:max-w-44 lg:flex-[1_1_7rem]')} value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {canEdit && (
          <Button className="ml-auto shrink-0" onClick={() => setEditing(null)}>
            <Plus /> New task
          </Button>
        )}
      </div>

      {data && data.tasks.length > 0 && (
        <Card>
          <CardContent>
            <StatusBar counts={summarizeTasks(data.tasks, todayString()).byStatus} />
          </CardContent>
        </Card>
      )}
      {isLoading && <p className="text-muted-foreground">Loading tasks…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && filtered.length === 0 && (
        <p className="text-muted-foreground">{data.tasks.length === 0 ? 'No tasks yet.' : 'No tasks match your filters.'}</p>
      )}
      {filtered.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <button className="text-left hover:underline" onClick={() => setViewingId(t.id)}>
                          {t.title}
                        </button>
                      </TableCell>
                      <TableCell>{t.assignee_ids.length ? t.assignee_ids.map(nameOf).join(', ') : 'Unassigned'}</TableCell>
                      <TableCell className="text-muted-foreground">{milestones?.find((m) => m.id === t.milestone_id)?.title ?? 'Unplanned'}</TableCell>
                      <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                      <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                      <TableCell className={isOverdue(t) ? 'font-medium text-destructive' : ''}>{t.due_date ?? '—'}</TableCell>
                      <TableCell>{t.progress}%</TableCell>
                      <TableCell className="space-x-2 text-right whitespace-nowrap">
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="sm" variant="outline" onClick={() => onDelete(t)}>
                            Delete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <TaskDialog projectId={projectId} task={editing} tasks={data?.tasks ?? []} deps={data?.deps ?? []} onClose={() => setEditing(undefined)} />
      )}
      <TaskDetailDialog task={viewing} canEdit={canEdit} canDelete={canDelete} canManage={canManage} onClose={() => setViewingId(null)} />
    </div>
  )
}
