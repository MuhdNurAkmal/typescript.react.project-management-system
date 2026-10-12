import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** A project's milestones (phases), earliest first. */
export function useMilestones(projectId: number) {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('milestones').select('*').eq('project_id', projectId).order('start_date').order('end_date')
      if (error) throw error
      return data
    },
  })
}
