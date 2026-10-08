import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { GanttTab } from '@/components/gantt/GanttTab'
import { MembersTab } from '@/components/projects/MembersTab'
import { OverviewTab } from '@/components/projects/OverviewTab'
import { TasksTab } from '@/components/tasks/TasksTab'
import { RoleBadge, StatusBadge } from '@/components/projects/badges'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePermissions } from '@/hooks/usePermissions'
import { useProject } from '@/hooks/useProjectData'

export default function ProjectDetail() {
  const params = useParams()
  const projectId = params.projectId && /^\d+$/.test(params.projectId) ? Number(params.projectId) : undefined
  const { data: project, isLoading, error } = useProject(projectId)
  const perms = usePermissions(projectId)

  if (isLoading || perms.loading) return <p className="text-muted-foreground">Loading project…</p>
  if (error) return <p className="text-destructive">{error.message}</p>
  if (!project || !perms.isMember) {
    return (
      <div className="space-y-2">
        <p>Project not found, or you are not a member.</p>
        <Link to="/projects" className="underline">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Projects
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <StatusBadge status={project.status} />
        <RoleBadge name={perms.roleName} />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
        </TabsList>
        </div>
        <TabsContent value="overview" className="pt-4">
          <OverviewTab project={project} canManage={perms.canManageProject} />
        </TabsContent>
        <TabsContent value="members" className="pt-4">
          <MembersTab projectId={project.id} canManage={perms.canManageMembers} />
        </TabsContent>
        <TabsContent value="tasks" className="pt-4">
          <TasksTab projectId={project.id} canManage={perms.canManageTasks} />
        </TabsContent>
        <TabsContent value="gantt" className="pt-4">
          <GanttTab projectId={project.id} canManage={perms.canManageTasks} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
