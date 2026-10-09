import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AdminAuditEntry, AdminOrg, AdminOverview, AdminUser } from '@/types/database'

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async (): Promise<AdminOverview> => {
      const { data, error } = await supabase.rpc('admin_overview')
      if (error) throw error
      return data
    },
  })
}

export function useAdminUsers(query: string) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.rpc('admin_list_users', { p_query: query })
      if (error) throw error
      return data
    },
  })
}

export function useAdminOrgs() {
  return useQuery({
    queryKey: ['admin', 'orgs'],
    queryFn: async (): Promise<AdminOrg[]> => {
      const { data, error } = await supabase.rpc('admin_list_orgs')
      if (error) throw error
      return data
    },
  })
}

export function useAdminAudit() {
  return useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: async (): Promise<AdminAuditEntry[]> => {
      const { data, error } = await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return data
    },
  })
}

/** Runs one admin action, shows the result, and refreshes every admin list. */
export function useAdminAction<V>(run: (v: V) => PromiseLike<{ error: unknown }>, success: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await run(v)
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success(success)
      await qc.invalidateQueries({ queryKey: ['admin'] })
      await qc.invalidateQueries({ queryKey: ['orgs'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Action failed')),
  })
}
