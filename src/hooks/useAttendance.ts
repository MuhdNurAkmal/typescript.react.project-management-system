import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** The current user's attendance rows, newest first. */
export function useMyAttendance() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['attendance', 'mine', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user!.id)
        .order('clock_in', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
  })
}

/** The current user's single open session, if any. */
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

/** Attendance of the people the current user manages (RLS limits rows; own rows excluded). */
export function useTeamAttendance(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['attendance', 'team', user?.id],
    enabled: enabled && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .neq('user_id', user!.id)
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
