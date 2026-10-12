import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Task, TaskRow } from '@/types/database'

/** Adds the ids of everyone assigned to each task (they live in their own table). */
export async function withAssignees(tasks: TaskRow[]): Promise<Task[]> {
  if (tasks.length === 0) return []
  const { data, error } = await supabase.from('task_assignees').select('*').in('task_id', tasks.map((t) => t.id))
  if (error) throw error
  const byTask = new Map<number, string[]>()
  for (const a of data) byTask.set(a.task_id, [...(byTask.get(a.task_id) ?? []), a.user_id])
  return tasks.map((t) => ({ ...t, assignee_ids: byTask.get(t.id) ?? [] }))
}

export function useProjectTasks(projectId: number | undefined) {
  return useQuery({
    queryKey: ['tasks', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId!)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      const tasks = await withAssignees(rows)
      const ids = tasks.map((t) => t.id)
      const { data: deps, error: dErr } = ids.length
        ? await supabase.from('task_dependencies').select('*').in('task_id', ids)
        : { data: [], error: null }
      if (dErr) throw dErr
      const { data: items, error: cErr } = await supabase
        .from('task_checklist_items')
        .select('*')
        .eq('project_id', projectId!)
        .order('id')
      if (cErr) throw cErr
      return { tasks, deps, items }
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
      const { data: mine, error: aErr } = await supabase.from('task_assignees').select('task_id').eq('user_id', user!.id)
      if (aErr) throw aErr
      const { data: rows, error } = mine.length
        ? await supabase.from('tasks').select('*').in('id', mine.map((m) => m.task_id))
        : { data: [] as TaskRow[], error: null }
      if (error) throw error
      const tasks = await withAssignees(rows)
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
