import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmContext, type ConfirmOptions } from '@/lib/confirm-context'

/** Renders one shared confirmation dialog; components ask for it through useConfirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function close(ok: boolean) {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!options} onOpenChange={(o) => !o && close(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>
            {options?.description && <DialogDescription>{options.description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={options?.destructive === false ? 'default' : 'destructive'} onClick={() => close(true)}>
              {options?.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
