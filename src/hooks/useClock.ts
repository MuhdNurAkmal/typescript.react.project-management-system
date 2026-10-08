import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOpenSession } from '@/hooks/useAttendance'
import { friendlyClockError } from '@/lib/attendanceUtils'
import { supabase } from '@/lib/supabase'

/** Shared clock in/out logic used by the floating button and the Attendance page. */
export function useClock() {
  const qc = useQueryClient()
  const { data: open, isLoading } = useOpenSession()

  const mutation = useMutation({
    mutationFn: async (kind: 'clock_in' | 'clock_out') => {
      const { error } = await supabase.rpc(kind)
      if (error) throw new Error(friendlyClockError(error.message, error.code))
    },
    onSuccess: async (_d, kind) => {
      toast.success(kind === 'clock_in' ? 'Clocked in' : 'Clocked out')
      await qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    open: open ?? null,
    loading: isLoading,
    pending: mutation.isPending,
    toggle: () => mutation.mutate(open ? 'clock_out' : 'clock_in'),
  }
}
