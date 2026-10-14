import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { GanttChart } from '@/components/gantt/GanttChart'
import { MilestoneProgress, MilestoneStatePill } from '@/components/milestones/MilestoneStatus'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm } from '@/hooks/useConfirm'
import { useMilestones } from '@/hooks/useMilestones'
import { useProjectTasks } from '@/hooks/useTasks'
import { milestoneProgress } from '@/lib/milestoneUtils'
import { supabase } from '@/lib/supabase'
import { todayString } from '@/lib/taskValidation'

interface Draft {
  id: number | null
  title: string
  start: string
  end: string
}

export function GanttTab({ projectId, canEdit, canManage }: { projectId: number; canEdit: boolean; canManage: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data: milestones } = useMilestones(projectId)
  const { data: taskData } = useProjectTasks(projectId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const today = todayString()

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['milestones', projectId] })
    await qc.invalidateQueries({ queryKey: ['tasks', projectId] })
  }
  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const row = { title: d.title.trim(), start_date: d.start, end_date: d.end }
      const { error } =
        d.id === null
          ? await supabase.from('milestones').insert({ project_id: projectId, ...row })
          : await supabase.from('milestones').update(row).eq('id', d.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refresh()
      setDraft(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const tick = useMutation({
    mutationFn: async (v: { id: number; completed: boolean }) => {
      const { error } = await supabase.from('milestones').update({ completed: v.completed }).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('milestones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    if (draft.end < draft.start) return toast.error('The end date cannot be before the start date')
    save.mutate(draft)
  }

  const tasks = taskData?.tasks ?? []
  return (
    <div className="space-y-4">
      <GanttChart projectId={projectId} canManage={canEdit} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Milestones</CardTitle>
            <CardDescription>A milestone is a phase with a start and an end date. Put tasks under it; they should all be done by the end date.</CardDescription>
          </div>
          {canManage && (
            <Button variant="success" size="sm" className="shrink-0" onClick={() => setDraft({ id: null, title: '', start: today, end: today })}>
              <Plus /> New milestone
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones?.length === 0 && <p className="text-sm text-muted-foreground">No milestones yet.{canManage ? ' Add the first phase of the project.' : ''}</p>}
          <ul className="divide-y">
            {milestones?.map((m) => {
              const p = milestoneProgress(m, tasks, today)
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-48 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${p.state === 'done' ? 'text-muted-foreground line-through' : ''}`}>{m.title}</span>
                      <MilestoneStatePill state={p.state} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {m.start_date} to {m.end_date}
                      {p.state !== 'done' && p.daysLeft >= 0 && ` · ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left`}
                      {p.state === 'overdue' && ` · ended ${-p.daysLeft} day${p.daysLeft === -1 ? '' : 's'} ago`}
                    </div>
                  </div>
                  <MilestoneProgress done={p.done} total={p.total} percent={p.percent} state={p.state} />
                  {canManage && (
                    <div className="flex items-center gap-2">
                      {p.total === 0 && (
                        <label className="flex items-center gap-1.5 text-sm">
                          <input type="checkbox" checked={m.completed} onChange={(e) => tick.mutate({ id: m.id, completed: e.target.checked })} />
                          Done
                        </label>
                      )}
                      <Button size="sm" onClick={() => setDraft({ id: m.id, title: m.title, start: m.start_date, end: m.end_date })}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => (await confirm({ title: `Delete milestone "${m.title}"?`, description: 'Its tasks are kept and move to Unplanned.', confirmLabel: 'Delete' })) && remove.mutate(m.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit milestone' : 'New milestone'}</DialogTitle>
            <DialogDescription>Every task under it should be done by the end date.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ms-title">Title</Label>
                <Input id="ms-title" required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ms-start">Starts</Label>
                  <Input id="ms-start" type="date" required value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ms-end">Ends</Label>
                  <Input id="ms-end" type="date" required value={draft.end} min={draft.start} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending || !draft.title.trim()}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

