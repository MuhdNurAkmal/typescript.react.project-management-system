import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** True if the user is an active project manager on at least one project. */
export function useIsManager() {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['is-manager', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: memberships, error }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from('project_members').select('role_id').eq('user_id', user!.id).eq('is_active', true),
        supabase.from('roles').select('id, is_pm'),
      ])
      if (error) throw error
      if (rErr) throw rErr
      const pmRoles = new Set(roles.filter((r) => r.is_pm).map((r) => r.id))
      return memberships.some((m) => pmRoles.has(m.role_id))
    },
  })
  return data ?? false
}
