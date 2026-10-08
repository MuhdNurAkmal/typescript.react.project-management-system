import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** The current user's attendance rows (newest first), optionally for one project. */
export function useMyAttendance(projectId?: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['attendance', 'mine', user?.id, projectId ?? 'all'],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('attendance').select('*').eq('user_id', user!.id).order('clock_in', { ascending: false }).limit(200)
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

/** The current user's single open session across all projects, if any. */
export function useOpenSession() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['attendance', 'open', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance').select('*').eq('user_id', user!.id).is('clock_out', null).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** All attendance rows of a project (PM only; RLS returns just your own rows otherwise). */
export function useProjectAttendance(projectId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['attendance', 'project', projectId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('project_id', projectId)
        .order('clock_in', { ascending: false })
        .limit(1000)
      if (error) throw error
      return data
    },
  })
}
