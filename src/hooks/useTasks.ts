import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useProjectTasks(projectId: number | undefined) {
  return useQuery({
    queryKey: ['tasks', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId!)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      const ids = tasks.map((t) => t.id)
      const { data: deps, error: dErr } = ids.length
        ? await supabase.from('task_dependencies').select('*').in('task_id', ids)
        : { data: [], error: null }
      if (dErr) throw dErr
      return { tasks, deps }
    },
  })
}

/** Tasks assigned to the current user across all projects, with project names. */
export function useMyTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-tasks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: tasks, error } = await supabase.from('tasks').select('*').eq('assignee_id', user!.id)
      if (error) throw error
      const projectIds = [...new Set(tasks.map((t) => t.project_id))]
      const { data: projects, error: pErr } = projectIds.length
        ? await supabase.from('projects').select('id, name').in('id', projectIds)
        : { data: [], error: null }
      if (pErr) throw pErr
      return tasks.map((task) => ({
        task,
        projectName: projects.find((p) => p.id === task.project_id)?.name ?? 'Unknown project',
      }))
    },
  })
}
