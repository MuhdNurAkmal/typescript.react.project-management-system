import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOpenSessions } from '@/hooks/useAttendance'
import { useOrg } from '@/hooks/useOrg'
import { errorMessage } from '@/lib/errors'
import { friendlyClockError } from '@/lib/attendanceUtils'
import { supabase } from '@/lib/supabase'

/**
 * Clock in/out for the current company, shared by the floating button and the Attendance page.
 * A person can be clocked in to several companies at once; each company has its own session.
 */
export function useClock() {
  const qc = useQueryClient()
  const { current, orgs } = useOrg()
  const { data: sessions = [], isLoading } = useOpenSessions()
  const orgId = current?.org.id

  const open = sessions.find((s) => s.organization_id === orgId) ?? null
  const others = sessions
    .filter((s) => s.organization_id !== orgId)
    .map((s) => ({ session: s, orgName: orgs.find((e) => e.org.id === s.organization_id)?.org.name ?? 'another company' }))

  const mutation = useMutation({
    mutationFn: async (kind: 'clock_in' | 'clock_out') => {
      const { error } = await supabase.rpc(kind, { p_organization_id: orgId! })
      if (error) throw new Error(friendlyClockError(errorMessage(error), error.code))
    },
    onSuccess: async (_d, kind) => {
      toast.success(kind === 'clock_in' ? `Clocked in at ${current?.org.name}` : `Clocked out of ${current?.org.name}`)
      await qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    /** The open session in the current company, if any. */
    open,
    /** Open sessions in other companies. */
    others,
    canClock: !!current,
    loading: isLoading,
    pending: mutation.isPending,
    toggle: () => mutation.mutate(open ? 'clock_out' : 'clock_in'),
  }
}
