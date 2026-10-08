import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * For projects the user manages: every task (for progress/overdue counts), the members,
 * and who is currently clocked in. Open sessions are only visible for people the user manages (RLS).
 */
export function useManagedOverview(projectIds: number[]) {
  const key = [...projectIds].sort((a, b) => a - b).join(',')
  return useQuery({
    queryKey: ['dashboard', 'managed', key],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const [tasks, members, open] = await Promise.all([
        supabase.from('tasks').select('*').in('project_id', projectIds),
        supabase.from('project_members').select('*').in('project_id', projectIds).eq('is_active', true),
        supabase.from('attendance').select('*').is('clock_out', null),
      ])
      if (tasks.error) throw tasks.error
      if (members.error) throw members.error
      if (open.error) throw open.error
      const userIds = [...new Set(open.data.map((o) => o.user_id))]
      const profiles = userIds.length ? await supabase.from('profiles').select('*').in('id', userIds) : { data: [], error: null }
      if (profiles.error) throw profiles.error
      return { tasks: tasks.data, members: members.data, open: open.data, profiles: profiles.data }
    },
  })
}

/** Attendance rows and profiles for a month (RLS: your own plus people you manage). */
export function useMonthAttendance(monthStart: Date, monthEnd: Date) {
  const from = monthStart.toISOString()
  const to = monthEnd.toISOString()
  return useQuery({
    queryKey: ['attendance', 'month', from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .gte('clock_in', from)
        .lt('clock_in', to)
        .order('clock_in')
        .limit(5000)
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
