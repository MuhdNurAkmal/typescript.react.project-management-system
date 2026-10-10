import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { OrganizationRole } from '@/types/database'

/** The company roles (owner, admin, member and any custom ones), owners first. */
export function useOrgRoles() {
  return useQuery({
    queryKey: ['org-roles'],
    queryFn: async (): Promise<OrganizationRole[]> => {
      const { data, error } = await supabase.from('organization_roles').select('*').order('id')
      if (error) throw error
      return data
    },
  })
}
