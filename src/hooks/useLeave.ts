import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useOrg } from '@/hooks/useOrg'

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

/** The current user's leave requests in the current company. */
export function useMyLeave() {
  const { user } = useAuth()
  const { current } = useOrg()
  const orgId = current?.org.id
  return useQuery({
    queryKey: ['leave', 'mine', user?.id, orgId],
    enabled: !!user && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user!.id)
        .eq('organization_id', orgId!)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Leave requests of the other people in the current company (company admins only). */
export function useTeamLeave(enabled: boolean) {
  const { user } = useAuth()
  const { current } = useOrg()
  const orgId = current?.org.id
  return useQuery({
    queryKey: ['leave', 'team', user?.id, orgId],
    enabled: enabled && !!user && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .neq('user_id', user!.id)
        .eq('organization_id', orgId!)
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
