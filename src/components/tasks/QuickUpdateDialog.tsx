import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { statusLabels } from '@/components/tasks/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import type { Task, TaskStatus } from '@/types/database'

/** Lets an assignee change only the status and progress of their own task. */
export function QuickUpdateDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{task && <Body key={task.id} task={task} onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function Body({ task, onClose }: { task: Task; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [progress, setProgress] = useState(task.progress)

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tasks')
        .update({ status, progress: status === 'done' ? 100 : progress })
        .eq('id', task.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tasks'] })
      await qc.invalidateQueries({ queryKey: ['my-tasks'] })
      toast.success('Task updated')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Update task</DialogTitle>
        <DialogDescription>{task.title}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="q-status">Status</Label>
          <select id="q-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-progress">Progress: {status === 'done' ? 100 : progress}%</Label>
          <input
            id="q-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            className="w-full"
            disabled={status === 'done'}
            value={status === 'done' ? 100 : progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}
