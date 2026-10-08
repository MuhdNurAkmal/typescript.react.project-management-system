import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** The exact text the user must type before the button is enabled. */
  expected: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
}

/** GitHub-style confirmation: the action stays disabled until the name is typed exactly. */
export function TypeToConfirmDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <Body {...rest} onCancel={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function Body({ title, description, expected, confirmLabel, pending, onConfirm, onCancel }: Omit<Props, 'open' | 'onOpenChange'> & { onCancel: () => void }) {
  const [typed, setTyped] = useState('')
  const matches = typed === expected

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="type-confirm">
          Type <strong className="font-semibold text-foreground">{expected}</strong> to confirm
        </Label>
        <Input id="type-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" disabled={!matches || pending} onClick={onConfirm}>
          {pending ? 'Deleting…' : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  )
}
