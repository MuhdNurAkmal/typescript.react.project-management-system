import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Inbox, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { RoleBadge, StatusBadge } from '@/components/projects/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useOrg } from '@/hooks/useOrg'
import { useMyProjects } from '@/hooks/useProjectData'
import { useAuth } from '@/hooks/useAuth'
import { emptyProjectForm, formToPayload, type ProjectFormValues } from '@/lib/projectValidation'
import { supabase } from '@/lib/supabase'

export default function Projects() {
  const { user } = useAuth()
  const { current } = useOrg()
  const { data, isLoading, error, refetch } = useMyProjects()
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
    <div className="space-y-6">
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

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading projects">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-5 w-1/3 animate-pulse rounded-full bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
      {error && (
        <Card role="alert">
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
              <AlertCircle className="size-5" />
            </span>
            <p className="font-medium">Could not load projects</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
      {data && data.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
              <Inbox className="size-5" />
            </span>
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground">Create your first project to start planning.</p>
            <Button size="sm" className="mt-1" onClick={() => setOpen(true)}>
              <Plus /> New project
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map(({ project, role }) => (
          <Link key={project.id} to={`/projects/${project.id}`}>
            <Card className="h-full transition-shadow hover:shadow-lift">
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
