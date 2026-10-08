import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ProjectForm, selectClass } from '@/components/projects/ProjectForm'
import { StatusBadge } from '@/components/projects/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { formToPayload, type ProjectFormValues } from '@/lib/projectValidation'
import { supabase } from '@/lib/supabase'
import type { Project, ProjectStatus } from '@/types/database'

const statuses: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children || '—'}</dd>
    </div>
  )
}

export function OverviewTab({ project, canManage }: { project: Project; canManage: boolean }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<ProjectStatus>(project.status)

  const save = useMutation({
    mutationFn: async (patch: Partial<Project>) => {
      const { error } = await supabase.from('projects').update(patch).eq('id', project.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['project', project.id] })
      await qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (editing) {
    const initial: ProjectFormValues = {
      name: project.name,
      description: project.description ?? '',
      type: project.type,
      sponsor: project.sponsor ?? '',
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
      budget: project.budget == null ? '' : String(project.budget),
    }
    return (
      <Card>
        <CardContent className="space-y-4">
          <ProjectForm
            initial={initial}
            submitLabel="Save changes"
            onSubmit={async (v) => {
              await save.mutateAsync(formToPayload(v))
              setEditing(false)
            }}
          />
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-6">
        <p className="whitespace-pre-wrap">{project.description || 'No description'}</p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Type"><span className="capitalize">{project.type}</span></Field>
          <Field label="Status"><StatusBadge status={project.status} /></Field>
          <Field label="Sponsor">{project.sponsor}</Field>
          <Field label="Start date">{project.start_date}</Field>
          <Field label="End date">{project.end_date}</Field>
          <Field label="Budget">{project.budget == null ? '' : `RM ${project.budget.toLocaleString()}`}</Field>
        </dl>
        {canManage && (
          <div className="flex flex-wrap items-end gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="status">Change status</Label>
              <select id="status" className={`${selectClass} w-44`} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="secondary" disabled={status === project.status || save.isPending} onClick={() => save.mutate({ status })}>
              Update status
            </Button>
            <Button onClick={() => setEditing(true)}>Edit details</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
