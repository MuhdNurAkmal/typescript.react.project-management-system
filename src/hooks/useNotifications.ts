import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** The latest notifications for the signed-in user, refreshed every 30 seconds. */
export function useNotifications() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = ['notifications', user?.id]

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
      if (error) throw error
      return data
    },
  })

  const markRead = useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase.from('notifications').update({ read: true }).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const unread = (query.data ?? []).filter((n) => !n.read)
  return { ...query, unread, markRead: markRead.mutate }
}
