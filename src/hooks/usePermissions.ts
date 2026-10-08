import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { permissionsFor } from '@/lib/permissions'

/**
 * The current user's role in a project plus permission flags used to hide UI.
 * The database (RLS) remains the real enforcement.
 */
export function usePermissions(projectId: number | undefined) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['membership', projectId, user?.id],
    enabled: !!projectId && !!user,
    queryFn: async () => {
      const { data: member, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId!)
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle()
      if (error) throw error
      if (!member) return null
      const { data: role, error: rErr } = await supabase.from('roles').select('*').eq('id', member.role_id).single()
      if (rErr) throw rErr
      return { member, role }
    },
  })

  return { loading: query.isLoading, ...permissionsFor(query.data?.role ?? null) }
}
