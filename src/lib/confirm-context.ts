import { createContext } from 'react'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  /** Defaults to true: the confirm button is styled as destructive. */
  destructive?: boolean
  /** Style the confirm button yellow (deactivating, not deleting). Wins over `destructive`. */
  warning?: boolean
}

export const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)
