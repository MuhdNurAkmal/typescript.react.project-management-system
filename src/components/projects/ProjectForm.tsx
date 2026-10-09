import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateProjectForm, type ProjectFormValues } from '@/lib/projectValidation'
import { errorMessage } from '@/lib/errors'

export const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  extra,
}: {
  initial: ProjectFormValues
  submitLabel: string
  onSubmit: (values: ProjectFormValues) => Promise<void>
  extra?: React.ReactNode
}) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof ProjectFormValues>(k: K, val: ProjectFormValues[K]) => setV((p) => ({ ...p, [k]: val }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const err = validateProjectForm(v)
    if (err) return toast.error(err)
    setBusy(true)
    try {
      await onSubmit(v)
    } catch (e2) {
      toast.error(errorMessage(e2, 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="p-name">Name</Label>
        <Input id="p-name" required value={v.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-desc">Description</Label>
        <textarea
          id="p-desc"
          rows={3}
          className={`${selectClass} h-auto py-2`}
          value={v.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-type">Type</Label>
          <select id="p-type" className={selectClass} value={v.type} onChange={(e) => set('type', e.target.value as ProjectFormValues['type'])}>
            <option value="grant">Grant</option>
            <option value="industrial">Industrial</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-sponsor">Sponsor</Label>
          <Input id="p-sponsor" value={v.sponsor} onChange={(e) => set('sponsor', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-start">Start date</Label>
          <Input id="p-start" type="date" value={v.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-end">End date</Label>
          <Input id="p-end" type="date" value={v.end_date} onChange={(e) => set('end_date', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-budget">Budget (RM)</Label>
          <Input id="p-budget" type="number" min="0" step="0.01" value={v.budget} onChange={(e) => set('budget', e.target.value)} />
        </div>
        {extra}
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
