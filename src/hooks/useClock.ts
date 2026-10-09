import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOpenSession } from '@/hooks/useAttendance'
import { useOrg } from '@/hooks/useOrg'
import { friendlyClockError } from '@/lib/attendanceUtils'
import { supabase } from '@/lib/supabase'

/** Shared clock in/out logic used by the floating button and the Attendance page. */
export function useClock() {
  const qc = useQueryClient()
  const { current, orgs } = useOrg()
  const { data: open, isLoading } = useOpenSession()

  const mutation = useMutation({
    mutationFn: async (kind: 'clock_in' | 'clock_out') => {
      const { error } =
        kind === 'clock_in' ? await supabase.rpc('clock_in', { p_organization_id: current!.org.id }) : await supabase.rpc('clock_out')
      if (error) throw new Error(friendlyClockError(error.message, error.code))
    },
    onSuccess: async (_d, kind) => {
      toast.success(kind === 'clock_in' ? `Clocked in at ${current?.org.name}` : 'Clocked out')
      await qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    open: open ?? null,
    /** The company an open session belongs to (may differ from the one currently shown). */
    openOrgName: open ? (orgs.find((e) => e.org.id === open.organization_id)?.org.name ?? 'another company') : null,
    openElsewhere: !!open && open.organization_id !== current?.org.id,
    canClock: !!current,
    loading: isLoading,
    pending: mutation.isPending,
    toggle: () => mutation.mutate(open ? 'clock_out' : 'clock_in'),
  }
}
