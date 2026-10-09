import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useOrg } from '@/hooks/useOrg'

/** The current user's attendance rows in the current company, newest first. */
export function useMyAttendance() {
  const { user } = useAuth()
  const { current } = useOrg()
  const orgId = current?.org.id
  return useQuery({
    queryKey: ['attendance', 'mine', user?.id, orgId],
    enabled: !!user && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user!.id)
        .eq('organization_id', orgId!)
        .order('clock_in', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
  })
}

/** Every open session of the current user: at most one per company, so there can be several. */
export function useOpenSessions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['attendance', 'open', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance').select('*').eq('user_id', user!.id).is('clock_out', null)
      if (error) throw error
      return data
    },
  })
}

/** The open session in the current company, if any. */
export function useOpenSession() {
  const { current } = useOrg()
  const query = useOpenSessions()
  return { ...query, data: query.data?.find((s) => s.organization_id === current?.org.id) ?? null }
}

/** Attendance of the other people in the current company (company admins only; RLS limits the rows). */
export function useTeamAttendance(enabled: boolean) {
  const { user } = useAuth()
  const { current } = useOrg()
  const orgId = current?.org.id
  return useQuery({
    queryKey: ['attendance', 'team', user?.id, orgId],
    enabled: enabled && !!user && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .neq('user_id', user!.id)
        .eq('organization_id', orgId!)
        .order('clock_in', { ascending: false })
        .limit(1000)
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
