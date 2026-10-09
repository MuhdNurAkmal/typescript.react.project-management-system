import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { RoleBadge, StatusBadge } from '@/components/projects/badges'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useOrg } from '@/hooks/useOrg'
import { useMyProjects } from '@/hooks/useProjectData'
import { useAuth } from '@/hooks/useAuth'
import { emptyProjectForm, formToPayload, type ProjectFormValues } from '@/lib/projectValidation'
import { supabase } from '@/lib/supabase'

export default function Projects() {
  const { user } = useAuth()
  const { current } = useOrg()
  const { data, isLoading, error } = useMyProjects()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const create = useMutation({
    mutationFn: async (v: ProjectFormValues) => {
      const { error } = await supabase.from('projects').insert({ ...formToPayload(v), created_by: user!.id, organization_id: current!.org.id })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
      setOpen(false)
    },
  })

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={current?.org.name}
        title="Projects"
        description="Everything you are part of in this company."
        actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus /> New project
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>You become the project manager automatically.</DialogDescription>
            </DialogHeader>
            <ProjectForm initial={emptyProjectForm} submitLabel="Create project" onSubmit={(v) => create.mutateAsync(v)} />
          </DialogContent>
        </Dialog>
        }
      />

      {isLoading && <p className="text-muted-foreground">Loading projects…</p>}
      {error && <p className="text-destructive">Could not load projects: {error.message}</p>}
      {data && data.length === 0 && (
        <p className="text-muted-foreground">You are not part of any project yet. Create one to get started.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map(({ project, role }) => (
          <Link key={project.id} to={`/projects/${project.id}`}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription className="line-clamp-2">{project.description || 'No description'}</CardDescription>
                <div className="flex flex-wrap gap-2 pt-2">
                  <StatusBadge status={project.status} />
                  <RoleBadge name={role?.name ?? null} />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
