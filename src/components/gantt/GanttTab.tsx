import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GanttChart, useMilestones } from '@/components/gantt/GanttChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm } from '@/hooks/useConfirm'
import { supabase } from '@/lib/supabase'

export function GanttTab({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data: milestones } = useMilestones(projectId)

  const refreshMilestones = () => qc.invalidateQueries({ queryKey: ['milestones', projectId] })
  const addMilestone = useMutation({
    mutationFn: async (v: { title: string; due_date: string }) => {
      const { error } = await supabase.from('milestones').insert({ project_id: projectId, ...v })
      if (error) throw error
    },
    onSuccess: refreshMilestones,
    onError: (e: Error) => toast.error(e.message),
  })
  const updateMilestone = useMutation({
    mutationFn: async (v: { id: number; completed: boolean }) => {
      const { error } = await supabase.from('milestones').update({ completed: v.completed }).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: refreshMilestones,
    onError: (e: Error) => toast.error(e.message),
  })
  const removeMilestone = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('milestones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refreshMilestones,
    onError: (e: Error) => toast.error(e.message),
  })

  const [msTitle, setMsTitle] = useState('')
  const [msDate, setMsDate] = useState('')
  function onAddMilestone(e: FormEvent) {
    e.preventDefault()
    addMilestone.mutate({ title: msTitle.trim(), due_date: msDate }, { onSuccess: () => { setMsTitle(''); setMsDate('') } })
  }

  return (
    <div className="space-y-4">
      <GanttChart projectId={projectId} canManage={canManage} />

      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && (
            <form onSubmit={onAddMilestone} className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1 space-y-2">
                <Label htmlFor="ms-title">Title</Label>
                <Input id="ms-title" required value={msTitle} onChange={(e) => setMsTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ms-date">Date</Label>
                <Input id="ms-date" type="date" required value={msDate} onChange={(e) => setMsDate(e.target.value)} />
              </div>
              <Button type="submit" disabled={addMilestone.isPending}>
                Add milestone
              </Button>
            </form>
          )}
          {milestones?.length === 0 && <p className="text-sm text-muted-foreground">No milestones yet.</p>}
          <ul className="divide-y">
            {milestones?.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={m.completed}
                    disabled={!canManage}
                    onChange={(e) => updateMilestone.mutate({ id: m.id, completed: e.target.checked })}
                  />
                  <span className={m.completed ? 'line-through' : ''}>{m.title}</span>
                </label>
                <span className="text-sm text-muted-foreground">{m.due_date}</span>
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => (await confirm({ title: `Delete milestone "${m.title}"?`, confirmLabel: 'Delete' })) && removeMilestone.mutate(m.id)}
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
