import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ActivityTab } from '@/components/projects/ActivityTab'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { GanttChart } from '@/components/gantt/GanttChart'
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
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-3">
            Project
            <StatusBadge status={project.status} />
            <RoleBadge name={perms.roleName} />
          </span>
        }
        title={project.name}
      />

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto overflow-y-hidden pb-1">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          {perms.isPm && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>
        </div>
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            {/* On phones the project details come first; on wide screens they sit on the right */}
            <div className="order-first lg:order-last">
              <OverviewTab project={project} canManage={perms.canManageProject} />
            </div>
            <div className="min-w-0 space-y-8">
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Timeline</h2>
                <GanttChart projectId={project.id} canManage={perms.canManageTasks} />
              </section>
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Members</h2>
                <MembersTab projectId={project.id} canManage={perms.canManageMembers} />
              </section>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="tasks" className="pt-4">
          <TasksTab projectId={project.id} canManage={perms.canManageTasks} />
        </TabsContent>
        <TabsContent value="board" className="pt-4">
          <KanbanBoard projectId={project.id} canManage={perms.canManageTasks} />
        </TabsContent>
        <TabsContent value="gantt" className="pt-4">
          <GanttTab projectId={project.id} canManage={perms.canManageTasks} />
        </TabsContent>
        {perms.isPm && (
          <TabsContent value="activity" className="pt-4">
            <ActivityTab projectId={project.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
