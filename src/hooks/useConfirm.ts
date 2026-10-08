import { useContext } from 'react'
import { ConfirmContext } from '@/lib/confirm-context'

/** Returns confirm(options): Promise<boolean>, resolved when the user answers the dialog. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
