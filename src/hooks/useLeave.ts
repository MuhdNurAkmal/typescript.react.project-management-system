import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_types').select('*').order('id')
      if (error) throw error
      return data
    },
  })
}

export function useMyLeave() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['leave', 'mine', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Leave requests of the people the current user manages (own requests excluded). */
export function useTeamLeave(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['leave', 'team', user?.id],
    enabled: enabled && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .neq('user_id', user!.id)
        .order('start_date', { ascending: false })
      if (error) throw error
      const ids = [...new Set(data.map((r) => r.user_id))]
      const { data: profiles, error: pErr } = ids.length
        ? await supabase.from('profiles').select('*').in('id', ids)
        : { data: [], error: null }
      if (pErr) throw pErr
      return { rows: data, profiles }
    },
  })
}
